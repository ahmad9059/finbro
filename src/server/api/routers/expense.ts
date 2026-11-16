import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";

import {
  currentMonthPK,
  daysInMonth,
  formatMonth,
  monthRange,
  shiftMonth,
  todayPK,
} from "~/lib/dates";
import { expenseInput, isoMonth } from "~/lib/schemas";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Db } from "~/server/db";
import { expense, expenseCategory } from "~/server/db/schema";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const monthInput = z.object({ month: isoMonth });

export const expenseRouter = createTRPCRouter({
  list: protectedProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const { start, end } = monthRange(input.month);
    return ctx.db
      .select({
        id: expense.id,
        date: expense.date,
        amount: expense.amount,
        title: expense.title,
        notes: expense.notes,
        categoryId: expense.categoryId,
        categoryName: expenseCategory.name,
        subscriptionId: expense.subscriptionId,
      })
      .from(expense)
      .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
      .where(
        and(
          eq(expense.userId, ctx.session.user.id),
          gte(expense.date, start),
          lt(expense.date, end),
        ),
      )
      .orderBy(desc(expense.date), desc(expense.id));
  }),

  /** Totals for the month, the month before, and per category. */
  summary: protectedProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const range = monthRange(input.month);
    const previous = monthRange(shiftMonth(input.month, -1));

    const sumFor = (r: { start: string; end: string }) =>
      ctx.db
        .select({ total: sql<string>`coalesce(sum(${expense.amount}), 0)` })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            gte(expense.date, r.start),
            lt(expense.date, r.end),
          ),
        );
    const [[current], [prior], byCategory] = await Promise.all([
      sumFor(range),
      sumFor(previous),
      ctx.db
        .select({
          categoryId: expenseCategory.id,
          name: expenseCategory.name,
          total: sql<string>`sum(${expense.amount})`,
        })
        .from(expense)
        .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
        .where(
          and(
            eq(expense.userId, userId),
            gte(expense.date, range.start),
            lt(expense.date, range.end),
          ),
        )
        .groupBy(expenseCategory.id, expenseCategory.name)
        .orderBy(desc(sql`sum(${expense.amount})`)),
    ]);

    const total = round(Number(current?.total ?? 0));
    const previousTotal = round(Number(prior?.total ?? 0));

    const isCurrentMonth = input.month === currentMonthPK();
    const [year, monthNumber] = input.month.split("-").map(Number) as [number, number];
    const monthDays = daysInMonth(year, monthNumber);
    const elapsed = isCurrentMonth ? Number(todayPK().slice(8, 10)) : monthDays;
    return {
      month: input.month,
      label: formatMonth(input.month),
      dailyAverage: round(total / Math.max(elapsed, 1)),
      projected: isCurrentMonth ? round((total / Math.max(elapsed, 1)) * monthDays) : null,
      total,
      previousTotal,
      difference: round(total - previousTotal),
      categories: byCategory.map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        total: round(Number(row.total)),
        share: total > 0 ? Number(row.total) / total : 0,
      })),
      isCurrentMonth,
    };
  }),

  /** Totals for the last six months, oldest first. */
  trend: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const thisMonth = currentMonthPK();
    const months = Array.from({ length: 6 }, (_, i) =>
      shiftMonth(thisMonth, i - 5),
    );
    const first = months[0]!;
    const last = months[months.length - 1]!;
    const rows = await ctx.db
      .select({
        month: sql<string>`to_char(${expense.date}, 'YYYY-MM')`,
        total: sql<string>`sum(${expense.amount})`,
      })
      .from(expense)
      .where(
        and(
          eq(expense.userId, userId),
          gte(expense.date, `${first}-01`),
          lt(expense.date, monthRange(last).end),
        ),
      )
      .groupBy(sql`to_char(${expense.date}, 'YYYY-MM')`);

    const totals = new Map(rows.map((row) => [row.month, round(Number(row.total))]));
    return months.map((month) => ({
      month,
      total: totals.get(month) ?? 0,
      isCurrent: month === thisMonth,
    }));
  }),

  create: protectedProcedure.input(expenseInput).mutation(async ({ ctx, input }) => {
    await assertCategory(ctx.db, ctx.session.user.id, input.categoryId);
    const [row] = await ctx.db
      .insert(expense)
      .values({ ...input, userId: ctx.session.user.id })
      .returning({ id: expense.id });
    return row;
  }),

  update: protectedProcedure
    .input(expenseInput.extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      await assertCategory(ctx.db, ctx.session.user.id, fields.categoryId);
      const updated = await ctx.db
        .update(expense)
        .set(fields)
        .where(and(eq(expense.id, id), eq(expense.userId, ctx.session.user.id)))
        .returning({ id: expense.id });
      if (updated.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
      }
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(expense)
        .where(and(eq(expense.id, input.id), eq(expense.userId, ctx.session.user.id)))
        .returning({ id: expense.id });
      if (deleted.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
      }
      return { id: input.id };
    }),
});

async function assertCategory(database: Db, userId: string, categoryId: number) {
  const [row] = await database
    .select({ id: expenseCategory.id })
    .from(expenseCategory)
    .where(and(eq(expenseCategory.id, categoryId), eq(expenseCategory.userId, userId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a category." });
  }
}
