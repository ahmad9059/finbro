import { TRPCError } from "@trpc/server";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { DEFAULT_CATEGORIES } from "~/lib/categories";
import { categoryInput } from "~/lib/schemas";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Db } from "~/server/db";
import { expense, expenseCategory, subscription } from "~/server/db/schema";

/** Inserts any default category the user does not have yet. Safe to repeat. */
export async function ensureDefaultCategories(database: Db, userId: string) {
  await database
    .insert(expenseCategory)
    .values(DEFAULT_CATEGORIES.map((name) => ({ userId, name })))
    .onConflictDoNothing();
}

const idInput = z.object({ id: z.number().int() });

export const categoryRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    let rows = await ctx.db
      .select()
      .from(expenseCategory)
      .where(eq(expenseCategory.userId, userId))
      .orderBy(asc(expenseCategory.name));
    if (rows.length === 0) {
      await ensureDefaultCategories(ctx.db, userId);
      rows = await ctx.db
        .select()
        .from(expenseCategory)
        .where(eq(expenseCategory.userId, userId))
        .orderBy(asc(expenseCategory.name));
    }

    const [expenseCounts, subscriptionCounts] = await Promise.all([
      ctx.db
        .select({ id: expense.categoryId, n: count() })
        .from(expense)
        .where(eq(expense.userId, userId))
        .groupBy(expense.categoryId),
      ctx.db
        .select({ id: subscription.categoryId, n: count() })
        .from(subscription)
        .where(eq(subscription.userId, userId))
        .groupBy(subscription.categoryId),
    ]);
    const used = new Map<number, number>();
    for (const row of [...expenseCounts, ...subscriptionCounts]) {
      used.set(row.id, (used.get(row.id) ?? 0) + row.n);
    }
    return rows.map((row) => ({ ...row, usage: used.get(row.id) ?? 0 }));
  }),

  create: protectedProcedure.input(categoryInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .insert(expenseCategory)
      .values({ userId: ctx.session.user.id, name: input.name })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You already have a category with that name.",
      });
    }
    return row;
  }),

  rename: protectedProcedure
    .input(categoryInput.extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [clash] = await ctx.db
        .select({ id: expenseCategory.id })
        .from(expenseCategory)
        .where(
          and(eq(expenseCategory.userId, userId), eq(expenseCategory.name, input.name)),
        );
      if (clash && clash.id !== input.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a category with that name.",
        });
      }
      await ctx.db
        .update(expenseCategory)
        .set({ name: input.name })
        .where(and(eq(expenseCategory.id, input.id), eq(expenseCategory.userId, userId)));
      return { id: input.id };
    }),

  delete: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const [[e], [s]] = await Promise.all([
      ctx.db
        .select({ n: count() })
        .from(expense)
        .where(and(eq(expense.userId, userId), eq(expense.categoryId, input.id))),
      ctx.db
        .select({ n: count() })
        .from(subscription)
        .where(and(eq(subscription.userId, userId), eq(subscription.categoryId, input.id))),
    ]);
    const inUse = (e?.n ?? 0) + (s?.n ?? 0);
    if (inUse > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `${inUse} ${inUse === 1 ? "item uses" : "items use"} this category. Rename it instead, or move them first.`,
      });
    }
    await ctx.db
      .delete(expenseCategory)
      .where(and(eq(expenseCategory.id, input.id), eq(expenseCategory.userId, userId)));
    return { id: input.id };
  }),
});
