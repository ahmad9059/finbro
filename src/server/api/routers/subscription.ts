import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";

import {
  addCycle,
  currentMonthPK,
  daysBetween,
  monthRange,
  todayPK,
} from "~/lib/dates";
import {
  markPaidInput,
  subscriptionInput,
} from "~/lib/schemas";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Db } from "~/server/db";
import { expense, expenseCategory, subscription } from "~/server/db/schema";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const statusInput = z.object({
  id: z.number().int(),
  status: z.enum(["active", "paused"]),
});

async function getOwned(database: Db, userId: string, id: number) {
  const [row] = await database
    .select()
    .from(subscription)
    .where(and(eq(subscription.id, id), eq(subscription.userId, userId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found." });
  }
  return row;
}

export const subscriptionRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await ctx.db
      .select({
        id: subscription.id,
        name: subscription.name,
        amount: subscription.amount,
        cycle: subscription.cycle,
        nextDueDate: subscription.nextDueDate,
        status: subscription.status,
        notes: subscription.notes,
        categoryId: subscription.categoryId,
        categoryName: expenseCategory.name,
      })
      .from(subscription)
      .innerJoin(expenseCategory, eq(subscription.categoryId, expenseCategory.id))
      .where(eq(subscription.userId, userId))
      .orderBy(asc(subscription.nextDueDate));

    const today = todayPK();
    const in30 = addCycle(today, "monthly");
    const thisMonth = currentMonthPK();
    const range = monthRange(thisMonth);

    const [[paidThisMonth], [paidThisYear]] = await Promise.all([
      ctx.db
        .select({ total: sql<string>`coalesce(sum(${expense.amount}), 0)` })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            gte(expense.date, range.start),
            lt(expense.date, range.end),
            sql`${expense.subscriptionId} is not null`,
          ),
        ),
      ctx.db
        .select({ total: sql<string>`coalesce(sum(${expense.amount}), 0)` })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            sql`${expense.subscriptionId} is not null`,
            gte(expense.date, `${thisMonth.slice(0, 4)}-01-01`),
            lt(expense.date, `${Number(thisMonth.slice(0, 4)) + 1}-01-01`),
          ),
        ),
    ]);

    const active = rows.filter((row) => row.status === "active");
    const monthlyCost = active.reduce(
      (sum, row) => sum + (row.cycle === "monthly" ? row.amount : row.amount / 12),
      0,
    );

    return {
      items: rows.map((row) => ({
        ...row,
        daysUntil: daysBetween(today, row.nextDueDate),
        overdue: row.status === "active" && row.nextDueDate < today,
      })),
      monthlyCost: round(monthlyCost),
      yearlyCost: round(monthlyCost * 12),
      dueThisMonth: active.filter(
        (row) => row.nextDueDate >= range.start && row.nextDueDate < range.end,
      ).length,
      dueIn30Days: active.filter((row) => row.nextDueDate < in30).length,
      paidThisMonth: round(Number(paidThisMonth?.total ?? 0)),
      paidThisYear: round(Number(paidThisYear?.total ?? 0)),
      today,
    };
  }),

  create: protectedProcedure
    .input(subscriptionInput)
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(subscription)
        .values({
          ...input,
          userId: ctx.session.user.id,
          billingDay: Number(input.nextDueDate.slice(8, 10)),
        })
        .returning({ id: subscription.id });
      return row;
    }),

  update: protectedProcedure
    .input(subscriptionInput.extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      await getOwned(ctx.db, ctx.session.user.id, id);
      await ctx.db
        .update(subscription)
        .set({ ...fields, billingDay: Number(fields.nextDueDate.slice(8, 10)) })
        .where(and(eq(subscription.id, id), eq(subscription.userId, ctx.session.user.id)));
      return { id };
    }),

  setStatus: protectedProcedure.input(statusInput).mutation(async ({ ctx, input }) => {
    await getOwned(ctx.db, ctx.session.user.id, input.id);
    await ctx.db
      .update(subscription)
      .set({ status: input.status })
      .where(
        and(eq(subscription.id, input.id), eq(subscription.userId, ctx.session.user.id)),
      );
    return { id: input.id, status: input.status };
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await getOwned(ctx.db, ctx.session.user.id, input.id);
      await ctx.db
        .delete(subscription)
        .where(
          and(eq(subscription.id, input.id), eq(subscription.userId, ctx.session.user.id)),
        );
      return { id: input.id };
    }),

  /**
   * Records a real expense and moves the due date forward. Returns the previous
   * due date so the client can offer an undo.
   */
  markPaid: protectedProcedure.input(markPaidInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const row = await getOwned(ctx.db, userId, input.id);

    return ctx.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(expense)
        .values({
          userId,
          date: input.date,
          amount: input.amount,
          categoryId: row.categoryId,
          title: row.name,
          subscriptionId: row.id,
        })
        .returning({ id: expense.id });

      const nextDueDate = addCycle(row.nextDueDate, row.cycle, row.billingDay);
      await tx
        .update(subscription)
        .set({ nextDueDate })
        .where(and(eq(subscription.id, row.id), eq(subscription.userId, userId)));

      return {
        expenseId: created?.id ?? null,
        previousDueDate: row.nextDueDate,
        nextDueDate,
      };
    });
  }),

  /** Removes the expense created by markPaid and restores the due date. */
  undoMarkPaid: protectedProcedure
    .input(z.object({ expenseId: z.number().int(), previousDueDate: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.db.transaction(async (tx) => {
        const deleted = await tx
          .delete(expense)
          .where(
            and(
              eq(expense.id, input.expenseId),
              eq(expense.userId, userId),
              sql`${expense.subscriptionId} is not null`,
            ),
          )
          .returning({ subscriptionId: expense.subscriptionId });
        const subscriptionId = deleted[0]?.subscriptionId;
        if (subscriptionId == null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Nothing to undo." });
        }
        await tx
          .update(subscription)
          .set({ nextDueDate: input.previousDueDate })
          .where(and(eq(subscription.id, subscriptionId), eq(subscription.userId, userId)));
        return { id: input.expenseId };
      });
    }),
});
