import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { todayPK } from "~/lib/dates";
import { allowedTxnKinds, summarize, type Txn } from "~/lib/portfolio";
import {
  assetInput,
  assetKindSchema,
  assetUpdateInput,
  isoDate,
  openingTxnShape,
  refineTxn,
} from "~/lib/schemas";
import {
  getOwnedAsset,
  loadAssetViews,
  positionOrThrow,
  toTxn,
} from "~/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { asset, assetTxn } from "~/server/db/schema";

const createInput = assetInput
  .extend({
    price: z.number().positive().nullable().default(null),
    priceAsOf: isoDate.nullable().default(null),
    priceSource: z.enum(["auto", "manual"]).default("manual"),
    /** Optional first transaction, entered together with the asset. */
    opening: openingTxnShape.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "stock" && !value.symbol) {
      ctx.addIssue({
        code: "custom",
        path: ["symbol"],
        message: "Enter the PSX symbol.",
      });
    }
    if (value.opening) refineTxn(value.opening, ctx);
  });

export const assetRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ kind: assetKindSchema }))
    .query(async ({ ctx, input }) => {
      const items = await loadAssetViews(ctx.db, ctx.session.user.id, input.kind);
      const summary = summarize(
        items.map(({ asset: a, position }) => ({ kind: a.kind, position })),
      );
      return { items, totals: summary.byKind[input.kind] };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const row = await getOwnedAsset(ctx.db, userId, input.id);
      const txns = await ctx.db
        .select()
        .from(assetTxn)
        .where(and(eq(assetTxn.assetId, row.id), eq(assetTxn.userId, userId)))
        .orderBy(desc(assetTxn.date), desc(assetTxn.id));
      const position = positionOrThrow(row.kind, row.lastPrice, txns.map(toTxn));
      return { asset: row, position, txns };
    }),

  create: protectedProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const { price, priceAsOf, priceSource, opening, ...fields } = input;

    if (opening && !allowedTxnKinds(fields.kind).includes(opening.kind)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That transaction type is not valid here.",
      });
    }
    if (opening) {
      positionOrThrow(fields.kind, price, [
        { ...normalizeOpening(opening), id: 0 } satisfies Txn,
      ]);
    }

    return ctx.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(asset)
        .values({
          ...fields,
          userId,
          lastPrice: price,
          priceAsOf: price === null ? null : (priceAsOf ?? todayPK()),
          priceSource: price === null ? null : priceSource,
          priceCheckedAt: price !== null && priceSource === "auto" ? new Date() : null,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (opening) {
        await tx.insert(assetTxn).values({
          ...normalizeOpening(opening),
          userId,
          assetId: created.id,
        });
      }
      return created;
    });
  }),

  update: protectedProcedure
    .input(assetUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, price, priceAsOf, priceSource, ...fields } = input;
      const existing = await getOwnedAsset(ctx.db, ctx.session.user.id, id);
      if (existing.kind === "stock" && !fields.symbol) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A stock needs its PSX symbol.",
        });
      }
      await ctx.db
        .update(asset)
        .set({
          ...fields,
          ...(price === null
            ? {}
            : {
                lastPrice: price,
                priceAsOf: priceAsOf ?? todayPK(),
                priceSource: priceSource ?? "manual",
              }),
        })
        .where(and(eq(asset.id, id), eq(asset.userId, ctx.session.user.id)));
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await getOwnedAsset(ctx.db, ctx.session.user.id, input.id);
      await ctx.db
        .delete(asset)
        .where(and(eq(asset.id, input.id), eq(asset.userId, ctx.session.user.id)));
      return { id: input.id };
    }),
});

/** Bonus units cost nothing; savings movements have no units. */
export function normalizeOpening<
  T extends { kind: string; units: number | null; unitPrice: number | null; amount: number },
>(txn: T): T {
  if (txn.kind === "bonus") return { ...txn, amount: 0 };
  if (["deposit", "withdrawal", "profit", "dividend"].includes(txn.kind)) {
    return { ...txn, units: null, unitPrice: null };
  }
  return txn;
}
