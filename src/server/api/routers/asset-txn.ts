import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { allowedTxnKinds, type Txn } from "~/lib/portfolio";
import { txnInput, txnUpdateInput } from "~/lib/schemas";
import {
  getOwnedAsset,
  positionOrThrow,
  toTxn,
  type DbOrTx,
} from "~/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assetTxn } from "~/server/db/schema";

import { normalizeOpening } from "./asset";



async function history(database: DbOrTx, userId: string, assetId: number) {
  return database
    .select()
    .from(assetTxn)
    .where(and(eq(assetTxn.assetId, assetId), eq(assetTxn.userId, userId)));
}

export const assetTxnRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ assetId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await getOwnedAsset(ctx.db, userId, input.assetId);
      return ctx.db
        .select()
        .from(assetTxn)
        .where(and(eq(assetTxn.assetId, input.assetId), eq(assetTxn.userId, userId)))
        .orderBy(desc(assetTxn.date), desc(assetTxn.id));
    }),

  create: protectedProcedure.input(txnInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const parent = await getOwnedAsset(ctx.db, userId, input.assetId);
    if (!allowedTxnKinds(parent.kind).includes(input.kind)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That transaction type is not valid here.",
      });
    }
    const values = normalizeOpening(input);

    return ctx.db.transaction(async (tx) => {
      const existing = (await history(tx, userId, parent.id)).map(toTxn);
      const candidate: Txn = { ...values, id: Number.MAX_SAFE_INTEGER };
      positionOrThrow(parent.kind, parent.lastPrice, [...existing, candidate]);
      const [row] = await tx
        .insert(assetTxn)
        .values({ ...values, userId })
        .returning({ id: assetTxn.id });
      return row;
    });
  }),

  update: protectedProcedure.input(txnUpdateInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const { id, ...rest } = input;
    const parent = await getOwnedAsset(ctx.db, userId, input.assetId);
    if (!allowedTxnKinds(parent.kind).includes(rest.kind)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That transaction type is not valid here.",
      });
    }
    const values = normalizeOpening(rest);

    return ctx.db.transaction(async (tx) => {
      const existing = await history(tx, userId, parent.id);
      if (!existing.some((row) => row.id === id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found." });
      }
      const next = existing.map((row) =>
        row.id === id ? { ...toTxn(row), ...values, id } : toTxn(row),
      );
      positionOrThrow(parent.kind, parent.lastPrice, next);
      await tx
        .update(assetTxn)
        .set(values)
        .where(and(eq(assetTxn.id, id), eq(assetTxn.userId, userId)));
      return { id };
    });
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int(), assetId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const parent = await getOwnedAsset(ctx.db, userId, input.assetId);

      return ctx.db.transaction(async (tx) => {
        const existing = await history(tx, userId, parent.id);
        if (!existing.some((row) => row.id === input.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found." });
        }
        positionOrThrow(
          parent.kind,
          parent.lastPrice,
          existing.filter((row) => row.id !== input.id).map(toTxn),
        );
        await tx
          .delete(assetTxn)
          .where(and(eq(assetTxn.id, input.id), eq(assetTxn.userId, userId)));
        return { id: input.id };
      });
    }),
});
