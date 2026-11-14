import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { assetKindSchema, manualPriceInput } from "~/lib/schemas";
import { getOwnedAsset } from "~/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { asset } from "~/server/db/schema";
import { searchFunds } from "~/server/prices/funds";
import { fetchStockPrice } from "~/server/prices/psx";
import { refreshPrices } from "~/server/prices/refresh";

export const priceRouter = createTRPCRouter({
  lookupStock: protectedProcedure
    .input(z.object({ symbol: z.string().min(1).max(20) }))
    .query(async ({ input }) => fetchStockPrice(input.symbol)),

  searchFunds: protectedProcedure
    .input(z.object({ query: z.string().max(80), moneyMarket: z.boolean() }))
    .query(async ({ input }) => searchFunds(input.query, input.moneyMarket)),

  refresh: protectedProcedure
    .input(z.object({ kind: assetKindSchema.optional() }))
    .mutation(async ({ ctx, input }) =>
      refreshPrices(ctx.db, ctx.session.user.id, { kind: input.kind }),
    ),

  setManual: protectedProcedure
    .input(manualPriceInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const row = await getOwnedAsset(ctx.db, userId, input.assetId);
      if (row.kind === "savings") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Savings accounts have no price.",
        });
      }
      await ctx.db
        .update(asset)
        .set({
          lastPrice: input.price,
          priceAsOf: input.date,
          priceSource: "manual",
        })
        .where(and(eq(asset.id, row.id), eq(asset.userId, userId)));
      return { id: row.id };
    }),
});
