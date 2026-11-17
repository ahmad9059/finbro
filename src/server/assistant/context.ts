import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";

import {
  currentMonthPK,
  daysBetween,
  formatMonth,
  monthRange,
  shiftMonth,
  todayPK,
} from "~/lib/dates";
import { formatDate, formatPKR, formatPercent } from "~/lib/format";
import { loadAssetViews } from "~/server/api/helpers";
import { db } from "~/server/db";
import { expense, expenseCategory, subscription } from "~/server/db/schema";
import { findPsxSymbol } from "~/server/prices/symbols";

import { analyzePortfolio, renderHealth } from "./analytics";
import { textOrNull } from "./validation";

export type AssistantContext = {
  today: string;
  month: string;
  monthLabel: string;
  netWorth: number;
  holdings: {
    id: number;
    kind: string;
    name: string;
    symbol: string | null;
    institution: string | null;
    /** PSX sector for stocks, when the directory has one. */
    sector: string | null;
    units: number;
    avgCost: number;
    /** Cost basis of what is still held. */
    cost: number;
    price: number | null;
    priceAsOf: string | null;
    value: number;
    unrealized: number;
    unrealizedPct: number;
    realized: number;
    income: number;
    profitRate: number | null;
  }[];
  byKind: { kind: string; value: number; share: number }[];
  spending: {
    month: string;
    total: number;
    previousTotal: number;
    /** Average of the last three complete months with spending; null with no history. */
    avgMonthly3: number | null;
    count: number;
    categories: { name: string; total: number; share: number }[];
    recent: {
      id: number;
      date: string;
      title: string;
      amount: number;
      category: string;
    }[];
  };
  subscriptions: {
    id: number;
    name: string;
    amount: number;
    cycle: string;
    nextDueDate: string;
    daysUntil: number;
    status: string;
    category: string;
  }[];
  /** What the active subscriptions cost per month (yearly plans divided by 12). */
  subscriptionMonthly: number;
  categories: string[];
};

const round = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Everything the assistant needs to know about the account, in one query set. */
export async function loadAssistantContext(
  userId: string,
): Promise<AssistantContext> {
  const today = todayPK();
  const month = currentMonthPK();
  const range = monthRange(month);
  const previous = monthRange(shiftMonth(month, -1));

  // Three complete months before this one, for a spending baseline.
  const trailingStart = monthRange(shiftMonth(month, -3)).start;

  const [
    views,
    spentRows,
    previousRows,
    categoryRows,
    recentRows,
    subRows,
    categoryList,
    trailingRows,
  ] = await Promise.all([
    loadAssetViews(db, userId),
    db
      .select({
        total: sql<string>`coalesce(sum(${expense.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(expense)
      .where(
        and(
          eq(expense.userId, userId),
          gte(expense.date, range.start),
          lt(expense.date, range.end),
        ),
      ),
    db
      .select({ total: sql<string>`coalesce(sum(${expense.amount}), 0)` })
      .from(expense)
      .where(
        and(
          eq(expense.userId, userId),
          gte(expense.date, previous.start),
          lt(expense.date, previous.end),
        ),
      ),
    db
      .select({
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
      .groupBy(expenseCategory.name)
      .orderBy(desc(sql`sum(${expense.amount})`)),
    db
      .select({
        id: expense.id,
        date: expense.date,
        title: expense.title,
        amount: expense.amount,
        category: expenseCategory.name,
      })
      .from(expense)
      .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
      .where(eq(expense.userId, userId))
      .orderBy(desc(expense.date), desc(expense.id))
      .limit(15),
    db
      .select({
        id: subscription.id,
        name: subscription.name,
        amount: subscription.amount,
        cycle: subscription.cycle,
        nextDueDate: subscription.nextDueDate,
        status: subscription.status,
        category: expenseCategory.name,
      })
      .from(subscription)
      .innerJoin(
        expenseCategory,
        eq(subscription.categoryId, expenseCategory.id),
      )
      .where(eq(subscription.userId, userId))
      .orderBy(asc(subscription.nextDueDate)),
    db
      .select({ name: expenseCategory.name })
      .from(expenseCategory)
      .where(eq(expenseCategory.userId, userId))
      .orderBy(asc(expenseCategory.name)),
    db
      .select({
        month: sql<string>`to_char(${expense.date}, 'YYYY-MM')`,
        total: sql<string>`sum(${expense.amount})`,
      })
      .from(expense)
      .where(
        and(
          eq(expense.userId, userId),
          gte(expense.date, trailingStart),
          lt(expense.date, range.start),
        ),
      )
      .groupBy(sql`to_char(${expense.date}, 'YYYY-MM')`),
  ]);

  const holdings = views
    .map(({ asset, position }) => ({
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      symbol: asset.symbol,
      institution: asset.institution,
      sector:
        asset.kind === "stock" && asset.symbol
          ? textOrNull(findPsxSymbol(asset.symbol)?.sector)
          : null,
      units: position.units,
      avgCost: position.avgCost,
      cost: position.cost,
      price: asset.lastPrice,
      priceAsOf: asset.priceAsOf,
      value: position.marketValue,
      unrealized: position.unrealized,
      unrealizedPct: position.unrealizedPct,
      realized: position.realized,
      income: position.income,
      profitRate: asset.profitRate,
    }))
    .sort((a, b) => b.value - a.value);

  const netWorth = round(holdings.reduce((sum, row) => sum + row.value, 0));
  const kindTotals = new Map<string, number>();
  for (const row of holdings) {
    kindTotals.set(row.kind, (kindTotals.get(row.kind) ?? 0) + row.value);
  }

  const total = round(Number(spentRows[0]?.total ?? 0));
  const previousTotal = round(Number(previousRows[0]?.total ?? 0));
  const trailing = trailingRows
    .map((row) => Number(row.total))
    .filter((value) => value > 0);
  const avgMonthly3 =
    trailing.length > 0
      ? round(trailing.reduce((sum, value) => sum + value, 0) / trailing.length)
      : null;
  const subscriptionMonthly = round(
    subRows
      .filter((row) => row.status === "active")
      .reduce(
        (sum, row) =>
          sum + (row.cycle === "yearly" ? row.amount / 12 : row.amount),
        0,
      ),
  );

  return {
    today,
    month,
    monthLabel: formatMonth(month),
    netWorth,
    holdings,
    byKind: [...kindTotals.entries()].map(([kind, value]) => ({
      kind,
      value: round(value),
      share: netWorth > 0 ? round(value / netWorth) : 0,
    })),
    spending: {
      month,
      total,
      previousTotal,
      avgMonthly3,
      count: Number(spentRows[0]?.count ?? 0),
      categories: categoryRows.map((row) => ({
        name: row.name,
        total: round(Number(row.total)),
        share: total > 0 ? round(Number(row.total) / total) : 0,
      })),
      recent: recentRows.map((row) => ({ ...row, amount: round(row.amount) })),
    },
    subscriptions: subRows.map((row) => ({
      ...row,
      daysUntil: daysBetween(today, row.nextDueDate),
    })),
    subscriptionMonthly,
    categories: categoryList.map((row) => row.name),
  };
}

const KIND_LABELS: Record<string, string> = {
  stock: "PSX stock",
  mutual_fund: "mutual fund",
  money_market: "money market fund",
  savings: "savings account",
};

/** A compact, readable snapshot for the system prompt. */
export function renderContext(context: AssistantContext): string {
  const lines: string[] = [];

  lines.push(
    `Today: ${formatDate(context.today)} (Asia/Karachi). Current month: ${context.monthLabel} (${context.month}).`,
  );
  lines.push(`Net worth: ${formatPKR(context.netWorth)}.`);

  if (context.byKind.length > 0) {
    lines.push(
      `By kind: ${context.byKind
        .map(
          (row) =>
            `${KIND_LABELS[row.kind] ?? row.kind} ${formatPKR(row.value)} (${formatPercent(row.share, { signed: false })})`,
        )
        .join(", ")}.`,
    );
  }

  if (context.holdings.length > 0) {
    lines.push(...renderHealth(analyzePortfolio(context)));
  }

  if (context.holdings.length === 0) {
    lines.push("Holdings: none yet.");
  } else {
    lines.push("Holdings (largest first):");
    for (const row of context.holdings.slice(0, 40)) {
      if (row.kind === "savings") {
        lines.push(
          `- ${row.name}${row.institution ? ` (${row.institution})` : ""} | savings account | id ${row.id} | balance ${formatPKR(row.value)} | profit ${formatPKR(row.income)} | rate ${row.profitRate ?? "—"}%`,
        );
        continue;
      }
      lines.push(
        `- ${row.symbol ? `${row.symbol} ` : ""}${row.name}${row.institution ? ` (${row.institution})` : ""} | ${KIND_LABELS[row.kind] ?? row.kind}${row.sector ? ` · ${row.sector}` : ""} | id ${row.id} | ${row.units} units | avg cost ${row.avgCost} | price ${row.price ?? "none"}${row.priceAsOf ? ` (${formatDate(row.priceAsOf)})` : ""} | value ${formatPKR(row.value)} | unrealized ${formatPKR(row.unrealized)} (${formatPercent(row.unrealizedPct)}) | realized ${formatPKR(row.realized)} | dividends ${formatPKR(row.income)}`,
      );
    }
  }

  lines.push(
    `Spending in ${context.monthLabel}: ${formatPKR(context.spending.total)} across ${context.spending.count} entries; previous month ${formatPKR(context.spending.previousTotal)}.`,
  );
  if (context.spending.categories.length > 0) {
    lines.push(
      `Top categories: ${context.spending.categories
        .slice(0, 8)
        .map(
          (row) =>
            `${row.name} ${formatPKR(row.total)} (${formatPercent(row.share, { signed: false })})`,
        )
        .join(", ")}.`,
    );
  }
  if (context.spending.recent.length > 0) {
    lines.push("Recent expenses (newest first):");
    for (const row of context.spending.recent) {
      lines.push(
        `- id ${row.id} | ${formatDate(row.date)} | ${row.title} | ${row.category} | ${formatPKR(row.amount)}`,
      );
    }
  }

  if (context.subscriptions.length > 0) {
    lines.push("Subscriptions:");
    for (const row of context.subscriptions) {
      lines.push(
        `- id ${row.id} | ${row.name} | ${formatPKR(row.amount)} ${row.cycle} | next ${formatDate(row.nextDueDate)} (${row.daysUntil >= 0 ? `in ${row.daysUntil}d` : `${-row.daysUntil}d overdue`}) | ${row.status} | ${row.category}`,
      );
    }
  } else {
    lines.push("Subscriptions: none.");
  }

  lines.push(`Expense categories: ${context.categories.join(", ") || "none"}.`);

  return lines.join("\n");
}
