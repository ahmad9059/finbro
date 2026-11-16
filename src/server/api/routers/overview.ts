import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

import {
  addCycle,
  currentMonthPK,
  daysBetween,
  monthRange,
  todayPK,
} from "~/lib/dates";
import { ASSET_KINDS, summarize } from "~/lib/portfolio";
import { loadAssetViews } from "~/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Db } from "~/server/db";
import {
  expense,
  expenseCategory,
  portfolioSnapshot,
  subscription,
} from "~/server/db/schema";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const overviewRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const today = todayPK();
    const month = currentMonthPK();
    const range = monthRange(month);

    const views = await loadAssetViews(ctx.db, userId);
    const summary = summarize(
      views.map(({ asset: a, position }) => ({ kind: a.kind, position })),
    );

    const [[spent], snapshots, dueRows] = await Promise.all([
      ctx.db
        .select({ total: sql<string>`coalesce(sum(${expense.amount}), 0)` })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            gte(expense.date, range.start),
            lt(expense.date, range.end),
          ),
        ),
      ctx.db
        .select({
          date: portfolioSnapshot.date,
          kind: portfolioSnapshot.kind,
          marketValue: portfolioSnapshot.marketValue,
          costBasis: portfolioSnapshot.costBasis,
        })
        .from(portfolioSnapshot)
        .where(eq(portfolioSnapshot.userId, userId))
        .orderBy(asc(portfolioSnapshot.date)),
      ctx.db
        .select({
          id: subscription.id,
          name: subscription.name,
          amount: subscription.amount,
          nextDueDate: subscription.nextDueDate,
          categoryName: expenseCategory.name,
        })
        .from(subscription)
        .innerJoin(expenseCategory, eq(subscription.categoryId, expenseCategory.id))
        .where(and(eq(subscription.userId, userId), eq(subscription.status, "active")))
        .orderBy(asc(subscription.nextDueDate))
        .limit(20),
    ]);

    const topHoldings = views
      .filter(({ asset: a, position }) => a.kind !== "savings" && position.marketValue > 0)
      .sort((a, b) => b.position.marketValue - a.position.marketValue)
      .slice(0, 5)
      .map(({ asset: a, position }) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        symbol: a.symbol,
        institution: a.institution,
        marketValue: position.marketValue,
        unrealized: position.unrealized,
        unrealizedPct: position.unrealizedPct,
      }));

    const holdings = views.filter(({ asset: a }) => a.kind !== "savings");
    const ranked = holdings
      .filter(({ position }) => position.cost > 0 && position.units > 0)
      .sort((a, b) => b.position.unrealizedPct - a.position.unrealizedPct);
    const pick = ({ asset: a, position }: (typeof ranked)[number]) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      unrealized: position.unrealized,
      unrealizedPct: position.unrealizedPct,
    });
    const largest = [...views].sort(
      (a, b) => b.position.marketValue - a.position.marketValue,
    )[0];
    const insights = {
      best: ranked.length > 1 ? pick(ranked[0]!) : null,
      worst: ranked.length > 1 ? pick(ranked[ranked.length - 1]!) : null,
      largest:
        largest && summary.total.marketValue > 0
          ? {
              name: largest.asset.name,
              share: largest.position.marketValue / summary.total.marketValue,
            }
          : null,
      income: round(views.reduce((sum, { position }) => sum + position.income, 0)),
      realized: round(views.reduce((sum, { position }) => sum + position.realized, 0)),
    };
    const in30 = addCycle(today, "monthly");
    const due = dueRows.map((row) => ({
      ...row,
      daysUntil: daysBetween(today, row.nextDueDate),
      overdue: row.nextDueDate < today,
    }));

    return {
      today,
      month,
      monthLabel: range.start,
      netWorth: summary.total.marketValue,
      unrealized: summary.total.unrealized,
      unrealizedPct: summary.total.unrealizedPct,
      spentThisMonth: round(Number(spent?.total ?? 0)),
      dueIn30Days: due.filter((row) => row.nextDueDate <= in30).length,
      overdueCount: due.filter((row) => row.overdue).length,
      allocation: ASSET_KINDS.map((kind) => ({
        kind,
        marketValue: summary.byKind[kind].marketValue,
        share: summary.byKind[kind].share,
        count: summary.byKind[kind].count,
      })).filter((row) => row.marketValue > 0),
      insights,
      // The stored history ends at the last evening run; today's live total
      // is appended so the line always meets the headline number.
      snapshots: withToday(
        totalsByDate(snapshots),
        today,
        summary.total.marketValue,
        summary.total.cost,
      ),
      byKind: ASSET_KINDS.map((kind) => ({
        kind,
        points: snapshots
          .filter((row) => row.kind === kind)
          .map((row) => ({ date: row.date, value: round(Number(row.marketValue)) })),
      })).filter((series) => series.points.some((point) => point.value > 0)),
      upcoming: due.filter((row) => row.nextDueDate <= in30).slice(0, 5),
      topHoldings,
      hasAnything: views.length > 0,
    };
  }),

  /** Writes today's snapshot rows. Run by the daily job; safe to repeat. */
  snapshot: protectedProcedure.mutation(async ({ ctx }) => {
    return writeSnapshot(ctx.db, ctx.session.user.id);
  }),
});

/** Adds the per-kind rows up to one total per day. */
function totalsByDate(
  rows: { date: string; kind: string; marketValue: number; costBasis: number }[],
) {
  const totals = new Map<string, { value: number; invested: number }>();
  for (const row of rows) {
    const entry = totals.get(row.date) ?? { value: 0, invested: 0 };
    entry.value += Number(row.marketValue);
    entry.invested += Number(row.costBasis);
    totals.set(row.date, entry);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, t]) => ({
      date,
      value: round(t.value),
      invested: round(t.invested),
    }));
}

function withToday(
  points: { date: string; value: number; invested: number }[],
  today: string,
  value: number,
  invested: number,
) {
  if (points.length === 0) return points;
  const live = { date: today, value: round(value), invested: round(invested) };
  const last = points[points.length - 1]!;
  return last.date === today ? [...points.slice(0, -1), live] : [...points, live];
}

export async function writeSnapshot(
  database: Db,
  userId: string,
  date = todayPK(),
) {
  const views = await loadAssetViews(database, userId);
  const summary = summarize(
    views.map(({ asset: a, position }) => ({ kind: a.kind, position })),
  );

  await database.transaction(async (tx) => {
    for (const kind of ASSET_KINDS) {
      const totals = summary.byKind[kind];
      await tx
        .insert(portfolioSnapshot)
        .values({
          userId,
          date,
          kind,
          marketValue: totals.marketValue,
          costBasis: totals.cost,
        })
        .onConflictDoUpdate({
          target: [
            portfolioSnapshot.userId,
            portfolioSnapshot.date,
            portfolioSnapshot.kind,
          ],
          set: { marketValue: totals.marketValue, costBasis: totals.cost },
        });
    }
  });

  return { date, netWorth: summary.total.marketValue };
}
