import { tool } from "ai";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  addCycle,
  addDays,
  currentMonthPK,
  daysBetween,
  monthRange,
  todayPK,
} from "~/lib/dates";
import { formatDate, formatPKR, formatUnits } from "~/lib/format";
import { computePosition, PortfolioError } from "~/lib/portfolio";
import { loadAssetViews, toTxn, type DbOrTx } from "~/server/api/helpers";
import { db } from "~/server/db";
import {
  asset,
  assetTxn,
  expense,
  expenseCategory,
  subscription,
  type Asset,
} from "~/server/db/schema";
import { fetchFundNav, listFunds, searchFunds } from "~/server/prices/funds";
import { fetchStockPrice } from "~/server/prices/psx";
import { findPsxSymbol, searchPsxSymbols } from "~/server/prices/symbols";

import { analyzePortfolio } from "./analytics";
import { loadAssistantContext } from "./context";
import { renderNotes, retrieveKnowledge } from "./knowledge/retrieve";
import { evaluateTrade, type Confirmation } from "./trade";
import {
  checkDate,
  isUnusualPrice,
  pickMatch,
  priceDeviation,
  round,
  textOrNull,
  type Check,
} from "./validation";

/* ---------------------------------- inputs --------------------------------- */

const MAX_AMOUNT = 1_000_000_000_000;

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .optional()
  .describe(
    "YYYY-MM-DD, Pakistan time. Defaults to today. Never in the future.",
  );

const positive = z.number().positive().max(MAX_AMOUNT);
const nonNegative = z.number().min(0).max(MAX_AMOUNT);

const kindSchema = z.enum(["stock", "mutual_fund", "money_market", "savings"]);
const txnKindSchema = z.enum([
  "buy",
  "sell",
  "bonus",
  "dividend",
  "deposit",
  "withdrawal",
  "profit",
]);

const confirmSchema = z
  .array(z.enum(["unusual_price", "duplicate"]))
  .optional()
  .describe(
    "Only after the owner has explicitly confirmed an unusual price or a possible duplicate that a previous call flagged.",
  );

const holdingRef = {
  holding: z
    .string()
    .min(1)
    .optional()
    .describe("PSX symbol or part of the holding's name."),
  holdingId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The holding's id from the snapshot. Preferred when known."),
};

const tradeFields = {
  ...holdingRef,
  kind: txnKindSchema,
  units: positive
    .optional()
    .describe("Units or shares, for buy, sell and bonus."),
  price: nonNegative.optional().describe("Price per unit."),
  amount: nonNegative
    .optional()
    .describe("Cash amount. Computed from units × price when omitted."),
  fees: nonNegative.default(0).describe("Brokerage, taxes and loads in PKR."),
  date: optionalDate,
};

/* -------------------------------- shared bits ------------------------------- */

type Failure = { ok: false; error: string; needsConfirmation?: Confirmation[] };
const refuse = (
  error: string,
  needsConfirmation?: Confirmation[],
): Failure => ({
  ok: false,
  error,
  ...(needsConfirmation ? { needsConfirmation } : {}),
});

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

type HoldingRef = { holding?: string; holdingId?: number };

/** One of the owner's holdings, or the reason there is not exactly one. */
async function resolveHolding(
  exec: DbOrTx,
  userId: string,
  ref: HoldingRef,
  lock = false,
): Promise<Check<Asset>> {
  if (ref.holdingId) {
    const query = exec
      .select()
      .from(asset)
      .where(and(eq(asset.id, ref.holdingId), eq(asset.userId, userId)))
      .limit(1);
    const [row] = await (lock ? query.for("update") : query);
    return row
      ? { ok: true, value: row }
      : { ok: false, error: `No holding has id ${ref.holdingId}.` };
  }
  const needle = ref.holding?.trim();
  if (!needle)
    return { ok: false, error: "Say which holding: its symbol, name or id." };

  const query = exec
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.userId, userId),
        or(
          sql`upper(${asset.symbol}) = ${needle.toUpperCase()}`,
          ilike(asset.name, `%${escapeLike(needle)}%`),
        ),
      ),
    )
    .orderBy(asc(asset.id))
    .limit(6);
  const rows = await (lock ? query.for("update") : query);
  return pickMatch(rows, needle, "holding");
}

async function resolveCategory(
  exec: DbOrTx,
  userId: string,
  name: string | undefined,
  fallback: string,
): Promise<Check<{ id: number; name: string }>> {
  const wanted = (name ?? fallback).trim();
  const rows = await exec
    .select({ id: expenseCategory.id, name: expenseCategory.name })
    .from(expenseCategory)
    .where(eq(expenseCategory.userId, userId));
  const lower = wanted.toLowerCase();
  const exact = rows.find((row) => row.name.toLowerCase() === lower);
  if (exact) return { ok: true, value: exact };
  const partial = rows.filter((row) => row.name.toLowerCase().includes(lower));
  if (partial.length === 1) return { ok: true, value: partial[0]! };
  if (partial.length > 1) return pickMatch(partial, wanted, "category");
  return {
    ok: false,
    error: `No category called "${wanted}". Existing categories: ${rows.map((row) => row.name).join(", ")}.`,
  };
}

async function resolveSubscription(
  exec: DbOrTx,
  userId: string,
  ref: { subscription?: string; subscriptionId?: number },
) {
  if (ref.subscriptionId) {
    const [row] = await exec
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.id, ref.subscriptionId),
          eq(subscription.userId, userId),
        ),
      )
      .limit(1);
    return row
      ? ({ ok: true, value: row } as const)
      : ({
          ok: false,
          error: `No subscription has id ${ref.subscriptionId}.`,
        } as const);
  }
  const needle = ref.subscription?.trim();
  if (!needle)
    return {
      ok: false,
      error: "Say which subscription: its name or id.",
    } as const;
  const rows = await exec
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, userId),
        ilike(subscription.name, `%${escapeLike(needle)}%`),
      ),
    )
    .orderBy(asc(subscription.id))
    .limit(6);
  return pickMatch(rows, needle, "subscription");
}

const asOf = (value: string | null) => (value ? formatDate(value) : "no date");

/** Read tools, checks, and the approval-gated write tools, bound to one account. */
export function createAssistantTools({ userId }: { userId: string }) {
  async function positions() {
    const views = await loadAssetViews(db, userId);
    return views.map(({ asset: a, position }) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      symbol: a.symbol,
      sector: a.symbol ? textOrNull(findPsxSymbol(a.symbol)?.sector) : null,
      institution: a.institution,
      units: position.units,
      avgCost: position.avgCost,
      cost: position.cost,
      price: a.lastPrice,
      priceAsOf: a.priceAsOf,
      value: position.marketValue,
      unrealized: position.unrealized,
      unrealizedPct: position.unrealizedPct,
      realized: position.realized,
      income: position.income,
      profitRate: a.profitRate,
    }));
  }

  return {
    /* ------------------------------- reading ------------------------------- */

    portfolio_summary: tool({
      description:
        "Net worth, the split by asset kind, and the largest holdings. Use this first for any 'how am I doing' question.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await positions();
        return {
          ok: true,
          netWorth: round(rows.reduce((sum, row) => sum + row.value, 0)),
          byKind: rows.reduce<Record<string, number>>((acc, row) => {
            acc[row.kind] = round((acc[row.kind] ?? 0) + row.value);
            return acc;
          }, {}),
          top: rows
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
            .map((row) => ({
              name: row.name,
              symbol: row.symbol,
              value: row.value,
              unrealized: row.unrealized,
            })),
        };
      },
    }),

    portfolio_health: tool({
      description:
        "Computed diagnostics: allocation, liquid runway in months of spending, single-stock and sector concentration, best and worst holdings, stale prices, subscription burn, spending pace, and flags with severity. Use it for any review or 'what should I do' question, and after changes.",
      inputSchema: z.object({}),
      execute: async () => {
        const context = await loadAssistantContext(userId);
        return { ok: true, ...analyzePortfolio(context) };
      },
    }),

    list_holdings: tool({
      description:
        "Every holding and account with units, average cost, latest price, value, profit and sector. Optional kind filter.",
      inputSchema: z.object({
        kind: kindSchema.optional().describe("Limit to one kind of asset."),
      }),
      execute: async ({ kind }) => {
        const rows = (await positions()).filter(
          (row) => !kind || row.kind === kind,
        );
        return { ok: true, count: rows.length, holdings: rows };
      },
    }),

    list_transactions: tool({
      description:
        "Transaction history, most recent first. Pass a holding (symbol, name or id) for one asset, or omit it for everything.",
      inputSchema: z.object({
        ...holdingRef,
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ holding, holdingId, limit }) => {
        let assetId: number | undefined;
        if (holding || holdingId) {
          const target = await resolveHolding(db, userId, {
            holding,
            holdingId,
          });
          if (!target.ok) return refuse(target.error);
          assetId = target.value.id;
        }
        const rows = await db
          .select({
            id: assetTxn.id,
            assetId: assetTxn.assetId,
            name: asset.name,
            symbol: asset.symbol,
            kind: assetTxn.kind,
            date: assetTxn.date,
            units: assetTxn.units,
            unitPrice: assetTxn.unitPrice,
            amount: assetTxn.amount,
            fees: assetTxn.fees,
            notes: assetTxn.notes,
          })
          .from(assetTxn)
          .innerJoin(asset, eq(asset.id, assetTxn.assetId))
          .where(
            and(
              eq(assetTxn.userId, userId),
              assetId ? eq(assetTxn.assetId, assetId) : undefined,
            ),
          )
          .orderBy(desc(assetTxn.date), desc(assetTxn.id))
          .limit(limit);
        return { ok: true, count: rows.length, transactions: rows };
      },
    }),

    expense_report: tool({
      description:
        "Spending for a month: total, previous month, per-category totals and the entries. Defaults to the current month.",
      inputSchema: z.object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("YYYY-MM. Defaults to the current month."),
      }),
      execute: async ({ month }) => {
        const target = month ?? currentMonthPK();
        const range = monthRange(target);
        const rows = await db
          .select({
            id: expense.id,
            date: expense.date,
            title: expense.title,
            amount: expense.amount,
            category: expenseCategory.name,
            subscriptionId: expense.subscriptionId,
          })
          .from(expense)
          .innerJoin(
            expenseCategory,
            eq(expense.categoryId, expenseCategory.id),
          )
          .where(
            and(
              eq(expense.userId, userId),
              sql`${expense.date} >= ${range.start}`,
              sql`${expense.date} < ${range.end}`,
            ),
          )
          .orderBy(desc(expense.date), desc(expense.id));
        const total = round(rows.reduce((sum, row) => sum + row.amount, 0));
        const categories = Object.values(
          rows.reduce<Record<string, { name: string; total: number }>>(
            (acc, row) => {
              acc[row.category] = acc[row.category] ?? {
                name: row.category,
                total: 0,
              };
              acc[row.category]!.total = round(
                acc[row.category]!.total + row.amount,
              );
              return acc;
            },
            {},
          ),
        ).sort((a, b) => b.total - a.total);
        return {
          ok: true,
          month: target,
          total,
          count: rows.length,
          categories: categories.map((row) => ({
            ...row,
            share: total > 0 ? row.total / total : 0,
          })),
          expenses: rows.slice(0, 40),
        };
      },
    }),

    search_expenses: tool({
      description: "Find expenses by text in the title or notes.",
      inputSchema: z.object({
        query: z.string().min(2).max(60),
        limit: z.number().int().min(1).max(30).default(10),
      }),
      execute: async ({ query, limit }) => {
        const like = `%${escapeLike(query)}%`;
        const rows = await db
          .select({
            id: expense.id,
            date: expense.date,
            title: expense.title,
            amount: expense.amount,
            category: expenseCategory.name,
          })
          .from(expense)
          .innerJoin(
            expenseCategory,
            eq(expense.categoryId, expenseCategory.id),
          )
          .where(
            and(
              eq(expense.userId, userId),
              or(ilike(expense.title, like), ilike(expense.notes, like)),
            ),
          )
          .orderBy(desc(expense.date))
          .limit(limit);
        return { ok: true, count: rows.length, expenses: rows };
      },
    }),

    list_subscriptions: tool({
      description:
        "Recurring subscriptions with id, amount, cycle, status, next due date and how many days away it is.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
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
          .orderBy(subscription.nextDueDate);
        const today = todayPK();
        return {
          ok: true,
          subscriptions: rows.map((row) => ({
            ...row,
            daysUntil: daysBetween(today, row.nextDueDate),
          })),
        };
      },
    }),

    spending_trend: tool({
      description: "Total spending for each of the last six months.",
      inputSchema: z.object({}),
      execute: async () => {
        const month = currentMonthPK();
        const totals: { month: string; total: number }[] = [];
        for (let back = 5; back >= 0; back -= 1) {
          const key = (() => {
            const [year, monthNumber] = month.split("-").map(Number) as [
              number,
              number,
            ];
            const index = year * 12 + (monthNumber - 1) - back;
            return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
          })();
          const range = monthRange(key);
          const [row] = await db
            .select({ total: sql<string>`coalesce(sum(${expense.amount}), 0)` })
            .from(expense)
            .where(
              and(
                eq(expense.userId, userId),
                sql`${expense.date} >= ${range.start}`,
                sql`${expense.date} < ${range.end}`,
              ),
            );
          totals.push({ month: key, total: round(Number(row?.total ?? 0)) });
        }
        return { ok: true, months: totals };
      },
    }),

    category_share: tool({
      description: "Share of the portfolio by asset kind, with amounts.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await positions();
        const netWorth = round(rows.reduce((sum, row) => sum + row.value, 0));
        const grouped = rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.kind] = round((acc[row.kind] ?? 0) + row.value);
          return acc;
        }, {});
        return {
          ok: true,
          netWorth,
          kinds: Object.entries(grouped).map(([kind, value]) => ({
            kind,
            value,
            share: netWorth > 0 ? value / netWorth : 0,
          })),
        };
      },
    }),

    market_quote: tool({
      description:
        "Latest PSX price for a listed symbol, straight from the exchange. Use for current prices and for confirming a symbol.",
      inputSchema: z.object({ symbol: z.string().min(1).max(12) }),
      execute: async ({ symbol }) => {
        const result = await fetchStockPrice(symbol);
        if (!result.ok) return refuse(result.reason);
        return {
          ok: true,
          symbol: symbol.toUpperCase(),
          price: result.price,
          asOf: result.asOf,
          name: result.name ?? findPsxSymbol(symbol)?.name ?? null,
          sector: textOrNull(findPsxSymbol(symbol)?.sector),
        };
      },
    }),

    search_symbols: tool({
      description:
        "Search the PSX directory by company name or ticker. Includes the sector.",
      inputSchema: z.object({ query: z.string().min(1).max(60) }),
      execute: async ({ query }) => ({
        ok: true,
        results: searchPsxSymbols(query, 8),
      }),
    }),

    fund_search: tool({
      description:
        "Search the MUFAP fund list by fund or AMC name. Returns the fund id, category, whether it is Shariah-compliant, and the latest NAV from the daily snapshot. Use it before recommending or recording a fund.",
      inputSchema: z.object({
        query: z.string().min(2).max(60),
        moneyMarket: z
          .boolean()
          .optional()
          .describe(
            "True for money market funds only, false for all others. Omit to search both.",
          ),
      }),
      execute: async ({ query, moneyMarket }) => {
        const groups =
          moneyMarket === undefined
            ? await Promise.all([
                searchFunds(query, false, 6),
                searchFunds(query, true, 4),
              ])
            : [await searchFunds(query, moneyMarket, 8)];
        const funds = groups.flat();
        return {
          ok: true,
          count: funds.length,
          funds: funds.map((fund) => ({
            fundId: fund.fundId,
            name: fund.name,
            amc: fund.amc,
            category: fund.category,
            shariah: fund.shariah,
            nav: fund.nav,
          })),
        };
      },
    }),

    search_knowledge: tool({
      description:
        "Look up curated background on Pakistani markets, tax concepts, funds, saving and investing rules of thumb. Concepts only: never take a tax rate, yield or index level from it; confirm those by web search.",
      inputSchema: z.object({
        query: z.string().min(2).max(200),
        limit: z.number().int().min(1).max(6).default(4),
      }),
      execute: async ({ query, limit }) => {
        const results = retrieveKnowledge(query, { limit });
        return {
          ok: true,
          count: results.length,
          notes: renderNotes(results),
        };
      },
    }),

    simulate_trade: tool({
      description:
        "Dry run of a holding transaction. Applies exactly the rules add_transaction enforces (kind, date, units × price, unusual price, duplicates, oversell, overdraft) and returns the position before and after, plus the gain a sale would realize. Records nothing. Call it before add_transaction.",
      inputSchema: z.object({ ...tradeFields, confirm: confirmSchema }),
      execute: async ({
        holding,
        holdingId,
        kind,
        units,
        price,
        amount,
        fees,
        date,
        confirm,
      }) => {
        const target = await resolveHolding(db, userId, { holding, holdingId });
        if (!target.ok) return refuse(target.error);
        const rows = await db
          .select()
          .from(assetTxn)
          .where(
            and(
              eq(assetTxn.assetId, target.value.id),
              eq(assetTxn.userId, userId),
            ),
          );
        const result = evaluateTrade({
          asset: target.value,
          existing: rows.map(toTxn),
          input: { kind, units, price, amount, fees, date, confirm },
          today: todayPK(),
        });
        if (!result.ok) return refuse(result.error, result.needsConfirmation);
        return {
          ok: true,
          holding: {
            id: target.value.id,
            name: target.value.name,
            symbol: target.value.symbol,
          },
          transaction: {
            kind,
            date: result.candidate.date,
            units: result.candidate.units,
            unitPrice: result.unitPrice,
            amount: result.candidate.amount,
            fees: result.candidate.fees,
          },
          before: result.before,
          after: result.after,
          realizedGain: kind === "sell" ? result.realizedDelta : undefined,
          warnings: result.warnings,
          note: "Nothing has been recorded. Call add_transaction to record it.",
        };
      },
    }),

    /* ------------------------- writing (approved) -------------------------- */

    add_expense: tool({
      description:
        "Record an expense. Requires the owner's approval. Use today's date unless another is given, and one of the existing categories.",
      needsApproval: true,
      inputSchema: z.object({
        title: z.string().min(1).max(120).describe("What it was for."),
        amount: positive.describe("Amount in PKR."),
        category: z
          .string()
          .min(1)
          .max(40)
          .describe("An existing category name."),
        date: optionalDate,
        notes: z.string().max(500).optional(),
        confirm: confirmSchema,
      }),
      execute: async ({ title, amount, category, date, notes, confirm }) => {
        const when = checkDate(date, todayPK());
        if (!when.ok) return refuse(when.error);
        const resolved = await resolveCategory(db, userId, category, "Other");
        if (!resolved.ok) return refuse(resolved.error);

        const cleanTitle = title.trim();
        if (!confirm?.includes("duplicate")) {
          const [twin] = await db
            .select({ id: expense.id })
            .from(expense)
            .where(
              and(
                eq(expense.userId, userId),
                eq(expense.date, when.value),
                eq(expense.amount, round(amount)),
                sql`lower(${expense.title}) = ${cleanTitle.toLowerCase()}`,
              ),
            )
            .limit(1);
          if (twin) {
            return refuse(
              `An expense "${cleanTitle}" for ${formatPKR(amount, { decimals: 2 })} on ${formatDate(when.value)} already exists (id ${twin.id}). Confirm this is a separate one.`,
              ["duplicate"],
            );
          }
        }

        const [row] = await db
          .insert(expense)
          .values({
            userId,
            title: cleanTitle,
            amount: round(amount),
            categoryId: resolved.value.id,
            date: when.value,
            notes: notes ?? null,
          })
          .returning({ id: expense.id });
        return {
          ok: true,
          summary: `Recorded ${formatPKR(amount, { decimals: 2 })} for ${cleanTitle} under ${resolved.value.name} on ${formatDate(when.value)}.`,
          id: row?.id ?? null,
        };
      },
    }),

    update_expense: tool({
      description:
        "Change an existing expense's title, amount, category, date or notes. Requires approval. Get the id from the snapshot or expense_report.",
      needsApproval: true,
      inputSchema: z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(120).optional(),
        amount: positive.optional(),
        category: z.string().min(1).max(40).optional(),
        date: optionalDate,
        notes: z.string().max(500).optional(),
      }),
      execute: async ({ id, title, amount, category, date, notes }) => {
        const [row] = await db
          .select()
          .from(expense)
          .where(and(eq(expense.id, id), eq(expense.userId, userId)))
          .limit(1);
        if (!row) return refuse("That expense no longer exists.");

        const patch: Partial<typeof expense.$inferInsert> = {};
        const changes: string[] = [];
        if (title !== undefined && title.trim() !== row.title) {
          patch.title = title.trim();
          changes.push(`title "${row.title}" → "${title.trim()}"`);
        }
        if (amount !== undefined && round(amount) !== row.amount) {
          patch.amount = round(amount);
          changes.push(
            `amount ${formatPKR(row.amount, { decimals: 2 })} → ${formatPKR(amount, { decimals: 2 })}`,
          );
        }
        if (date !== undefined && date !== row.date) {
          const when = checkDate(date, todayPK());
          if (!when.ok) return refuse(when.error);
          patch.date = when.value;
          changes.push(
            `date ${formatDate(row.date)} → ${formatDate(when.value)}`,
          );
        }
        if (category !== undefined) {
          const resolved = await resolveCategory(db, userId, category, "Other");
          if (!resolved.ok) return refuse(resolved.error);
          if (resolved.value.id !== row.categoryId) {
            patch.categoryId = resolved.value.id;
            changes.push(`category → ${resolved.value.name}`);
          }
        }
        if (notes !== undefined && notes !== (row.notes ?? "")) {
          patch.notes = notes;
          changes.push("notes updated");
        }
        if (changes.length === 0) return refuse("Nothing would change.");

        await db
          .update(expense)
          .set(patch)
          .where(and(eq(expense.id, id), eq(expense.userId, userId)));
        return {
          ok: true,
          summary: `Updated expense ${id}: ${changes.join("; ")}.`,
        };
      },
    }),

    delete_expense: tool({
      description:
        "Delete an expense by id. Requires approval. Say exactly what will be deleted first.",
      needsApproval: true,
      inputSchema: z.object({ id: z.number().int().positive() }),
      execute: async ({ id }) => {
        const deleted = await db
          .delete(expense)
          .where(and(eq(expense.id, id), eq(expense.userId, userId)))
          .returning({
            title: expense.title,
            amount: expense.amount,
            date: expense.date,
          });
        if (deleted.length === 0)
          return refuse("That expense no longer exists.");
        const gone = deleted[0]!;
        return {
          ok: true,
          summary: `Deleted ${gone.title} (${formatPKR(gone.amount, { decimals: 2 })}, ${formatDate(gone.date)}).`,
        };
      },
    }),

    add_transaction: tool({
      description:
        "Record a movement in a holding: buy, sell, bonus, dividend, deposit, withdrawal or profit. Requires approval. Call simulate_trade first. The write is locked, re-validated against the full history, and refused if it would oversell, overdraw, duplicate an entry or use an unusual price.",
      needsApproval: true,
      inputSchema: z.object({
        ...tradeFields,
        notes: z.string().max(500).optional(),
        confirm: confirmSchema,
      }),
      execute: async ({
        holding,
        holdingId,
        kind,
        units,
        price,
        amount,
        fees,
        date,
        notes,
        confirm,
      }) =>
        db.transaction(async (tx) => {
          const target = await resolveHolding(
            tx,
            userId,
            { holding, holdingId },
            true,
          );
          if (!target.ok) return refuse(target.error);
          const rows = await tx
            .select()
            .from(assetTxn)
            .where(
              and(
                eq(assetTxn.assetId, target.value.id),
                eq(assetTxn.userId, userId),
              ),
            );

          const result = evaluateTrade({
            asset: target.value,
            existing: rows.map(toTxn),
            input: { kind, units, price, amount, fees, date, confirm },
            today: todayPK(),
          });
          if (!result.ok) return refuse(result.error, result.needsConfirmation);

          const [created] = await tx
            .insert(assetTxn)
            .values({
              userId,
              assetId: target.value.id,
              kind,
              date: result.candidate.date,
              units: result.candidate.units,
              unitPrice: result.unitPrice,
              amount: result.candidate.amount,
              fees: result.candidate.fees,
              notes: notes ?? null,
            })
            .returning({ id: assetTxn.id });

          const unitsText = result.candidate.units
            ? ` ${formatUnits(result.candidate.units)} units`
            : "";
          return {
            ok: true,
            id: created?.id ?? null,
            summary: `Recorded ${kind}${unitsText} of ${target.value.name} for ${formatPKR(result.candidate.amount)} on ${formatDate(result.candidate.date)}.`,
            after: result.after,
            realizedGain: kind === "sell" ? result.realizedDelta : undefined,
            warnings: result.warnings,
          };
        }),
    }),

    delete_transaction: tool({
      description:
        "Delete one holding transaction by id (see list_transactions). Requires approval. Refused if the rest of the history would no longer be valid, for example removing a buy that a later sale depends on. Say exactly what will be deleted first.",
      needsApproval: true,
      inputSchema: z.object({ id: z.number().int().positive() }),
      execute: async ({ id }) =>
        db.transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(assetTxn)
            .where(and(eq(assetTxn.id, id), eq(assetTxn.userId, userId)))
            .limit(1);
          if (!row) return refuse("That transaction no longer exists.");

          const [owner] = await tx
            .select()
            .from(asset)
            .where(and(eq(asset.id, row.assetId), eq(asset.userId, userId)))
            .for("update");
          if (!owner)
            return refuse("The holding for that transaction no longer exists.");

          const all = await tx
            .select()
            .from(assetTxn)
            .where(
              and(eq(assetTxn.assetId, owner.id), eq(assetTxn.userId, userId)),
            );
          let after;
          try {
            after = computePosition(
              owner.kind,
              owner.lastPrice,
              all.filter((txn) => txn.id !== id).map(toTxn),
            );
          } catch (error) {
            return refuse(
              `Deleting it would break the history: ${error instanceof PortfolioError ? error.message : "a later transaction depends on it"} Delete or change the later transaction first.`,
            );
          }

          await tx
            .delete(assetTxn)
            .where(and(eq(assetTxn.id, id), eq(assetTxn.userId, userId)));
          return {
            ok: true,
            summary: `Deleted the ${row.kind} of ${owner.name} on ${formatDate(row.date)} (${formatPKR(row.amount)}).`,
            after: {
              units: after.units,
              avgCost: after.avgCost,
              cost: after.cost,
              marketValue: after.marketValue,
              unrealized: after.unrealized,
              realized: after.realized,
              income: after.income,
            },
          };
        }),
    }),

    add_holding: tool({
      description:
        "Create a stock, fund or savings account, optionally with its first purchase or opening balance. Requires approval. Stocks need a PSX symbol. Funds are matched against the MUFAP list (pass fundId from fund_search when known). Refuses a holding that already exists; use add_transaction for more units.",
      needsApproval: true,
      inputSchema: z.object({
        kind: kindSchema,
        name: z
          .string()
          .min(1)
          .max(120)
          .optional()
          .describe("Company, fund or account name."),
        symbol: z
          .string()
          .max(12)
          .optional()
          .describe("PSX symbol, for stocks."),
        fundId: z
          .string()
          .max(12)
          .optional()
          .describe("MUFAP fund id from fund_search, for funds."),
        institution: z
          .string()
          .max(120)
          .optional()
          .describe("Broker, AMC or bank."),
        units: positive
          .optional()
          .describe("Units or shares already held, for stocks and funds."),
        price: nonNegative
          .optional()
          .describe(
            "What you paid per unit. Required with units. For a fund with no MUFAP match, the current NAV.",
          ),
        fees: nonNegative.default(0),
        openingBalance: nonNegative
          .optional()
          .describe("For savings accounts."),
        profitRate: nonNegative
          .max(100)
          .optional()
          .describe("Annual profit rate in percent, savings only."),
        date: optionalDate,
        confirm: confirmSchema,
      }),
      execute: async (input) => {
        const today = todayPK();
        const when = checkDate(input.date, today);
        if (!when.ok) return refuse(when.error);

        let name = input.name?.trim() ?? "";
        let symbol: string | null = null;
        let fundId: string | null = null;
        let category: string | null = null;
        let institution = textOrNull(input.institution?.trim());
        let lastPrice: number | null = null;
        let priceAsOf: string | null = null;
        let source: "auto" | "manual" | null = null;

        if (input.kind === "stock") {
          if (!input.symbol)
            return refuse("A PSX symbol is required for a stock.");
          const ticker = input.symbol.trim().toUpperCase();
          const listed = findPsxSymbol(ticker);
          if (!listed) {
            return refuse(
              `${ticker} is not in the PSX directory. Use search_symbols to find the right ticker.`,
            );
          }
          const quote = await fetchStockPrice(ticker);
          name =
            textOrNull(name) ??
            textOrNull(quote.ok ? quote.name : undefined) ??
            listed.name;
          symbol = ticker;
          if (quote.ok) {
            lastPrice = quote.price;
            priceAsOf = quote.asOf;
            source = "auto";
          } else if (input.price) {
            lastPrice = input.price;
            priceAsOf = when.value;
            source = "manual";
          }
        } else if (input.kind === "savings") {
          if (!name) return refuse("A name is required.");
          if (input.units)
            return refuse(
              "Units do not apply to a savings account; give an opening balance.",
            );
        } else {
          const moneyMarket = input.kind === "money_market";
          let match = input.fundId
            ? (await listFunds()).find((fund) => fund.fundId === input.fundId)
            : undefined;
          if (input.fundId && !match)
            return refuse(
              `No MUFAP fund has id ${input.fundId}. Use fund_search.`,
            );
          if (!match && name) {
            const found = await searchFunds(name, moneyMarket, 6);
            if (found.length === 1) match = found[0];
            else if (found.length > 1) {
              return refuse(
                `"${name}" matches more than one fund: ${found
                  .slice(0, 5)
                  .map((fund) => `${fund.name} (fundId ${fund.fundId})`)
                  .join("; ")}. Ask which, then pass its fundId.`,
              );
            }
          }
          if (match) {
            name = match.name;
            fundId = match.fundId;
            category = match.category;
            institution = institution ?? match.amc;
            const nav = await fetchFundNav(match.fundId);
            lastPrice = nav.ok ? nav.price : match.nav;
            priceAsOf = nav.ok ? nav.asOf : when.value;
            source = "auto";
          } else {
            if (!name) return refuse("A fund name or fundId is required.");
            if (input.price === undefined) {
              return refuse(
                "That fund is not in the MUFAP list, so its current NAV is required as the price.",
              );
            }
            lastPrice = input.price;
            priceAsOf = when.value;
            source = "manual";
          }
        }

        const opening =
          input.kind === "savings"
            ? input.openingBalance
              ? { kind: "deposit" as const, amount: input.openingBalance }
              : null
            : input.units
              ? { kind: "buy" as const, units: input.units }
              : null;
        if (input.kind !== "savings" && input.units && !input.price) {
          return refuse(
            "A purchase price per unit is required when you give units. Ask the owner what they paid.",
          );
        }
        if (input.kind !== "savings" && input.openingBalance) {
          return refuse(
            "An opening balance applies to savings accounts only; use units and price.",
          );
        }

        return db.transaction(async (tx) => {
          const clash = await tx
            .select({ id: asset.id, name: asset.name })
            .from(asset)
            .where(
              and(
                eq(asset.userId, userId),
                symbol
                  ? eq(asset.symbol, symbol)
                  : fundId
                    ? eq(asset.fundId, fundId)
                    : sql`lower(${asset.name}) = ${name.toLowerCase()} and ${asset.kind} = ${input.kind}`,
              ),
            )
            .limit(1);
          if (clash[0]) {
            return refuse(
              `${clash[0].name} is already in the account (id ${clash[0].id}). Use add_transaction to record more.`,
            );
          }

          let openingTxn: ReturnType<typeof evaluateTrade> | null = null;
          if (opening) {
            openingTxn = evaluateTrade({
              asset: { name, kind: input.kind, lastPrice },
              existing: [],
              input:
                opening.kind === "deposit"
                  ? {
                      kind: "deposit",
                      amount: opening.amount,
                      date: when.value,
                    }
                  : {
                      kind: "buy",
                      units: opening.units,
                      price: input.price,
                      fees: input.fees,
                      date: when.value,
                      confirm: input.confirm,
                    },
              today,
            });
            if (!openingTxn.ok)
              return refuse(openingTxn.error, openingTxn.needsConfirmation);
          }

          const [created] = await tx
            .insert(asset)
            .values({
              userId,
              kind: input.kind,
              name,
              symbol,
              fundId,
              category,
              institution,
              profitRate:
                input.kind === "savings" ? (input.profitRate ?? null) : null,
              lastPrice,
              priceAsOf,
              priceSource: lastPrice === null ? null : source,
              priceCheckedAt: source === "auto" ? new Date() : null,
            })
            .returning({ id: asset.id });
          if (!created) return refuse("The holding could not be created.");

          if (openingTxn?.ok) {
            await tx.insert(assetTxn).values({
              userId,
              assetId: created.id,
              kind: openingTxn.candidate.kind,
              date: openingTxn.candidate.date,
              units: openingTxn.candidate.units,
              unitPrice: openingTxn.unitPrice,
              amount: openingTxn.candidate.amount,
              fees: openingTxn.candidate.fees,
            });
          }

          const detail = openingTxn?.ok
            ? openingTxn.candidate.units
              ? ` with ${formatUnits(openingTxn.candidate.units)} units at ${openingTxn.unitPrice}`
              : ` with a ${formatPKR(openingTxn.candidate.amount)} opening balance`
            : "";
          return {
            ok: true,
            id: created.id,
            summary: `Added ${name}${symbol ? ` (${symbol})` : ""}${detail}.`,
            price: lastPrice,
            priceAsOf,
            after: openingTxn?.ok ? openingTxn.after : undefined,
            warnings: openingTxn?.ok ? openingTxn.warnings : [],
          };
        });
      },
    }),

    set_price: tool({
      description:
        "Set a holding's price or NAV by hand. Requires approval. A manual price on a listed stock or fund is replaced at the next automatic refresh, so use it for holdings that have no live source.",
      needsApproval: true,
      inputSchema: z.object({
        ...holdingRef,
        price: positive,
        date: optionalDate,
        confirm: confirmSchema,
      }),
      execute: async ({ holding, holdingId, price, date, confirm }) => {
        const target = await resolveHolding(db, userId, { holding, holdingId });
        if (!target.ok) return refuse(target.error);
        const row = target.value;
        if (row.kind === "savings")
          return refuse("Savings accounts have no price.");
        const when = checkDate(date, todayPK());
        if (!when.ok) return refuse(when.error);

        if (
          isUnusualPrice(price, row.lastPrice) &&
          !confirm?.includes("unusual_price")
        ) {
          const deviation = priceDeviation(price, row.lastPrice)!;
          return refuse(
            `${price} is ${Math.round(Math.abs(deviation) * 100)}% ${deviation > 0 ? "above" : "below"} the current price of ${row.lastPrice}. That looks like a typo; check it with the owner.`,
            ["unusual_price"],
          );
        }

        await db
          .update(asset)
          .set({
            lastPrice: price,
            priceAsOf: when.value,
            priceSource: "manual",
          })
          .where(and(eq(asset.id, row.id), eq(asset.userId, userId)));
        const refreshes = row.symbol !== null || row.fundId !== null;
        return {
          ok: true,
          summary: `Set ${row.name} to ${price} as of ${formatDate(when.value)}.${refreshes ? " The next automatic refresh will replace it." : ""}`,
        };
      },
    }),

    add_subscription: tool({
      description:
        "Create a recurring subscription. Requires approval. Refused if one with the same name exists.",
      needsApproval: true,
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        amount: positive,
        cycle: z.enum(["monthly", "yearly"]),
        nextDueDate: optionalDate.describe(
          "Next payment date. Defaults to 30 days from today. May be in the future.",
        ),
        category: z.string().optional().describe("Defaults to Subscriptions."),
      }),
      execute: async ({ name, amount, cycle, nextDueDate, category }) => {
        const today = todayPK();
        const due = checkDate(nextDueDate ?? addDays(today, 30), today, {
          allowFuture: true,
        });
        if (!due.ok) return refuse(due.error);
        const resolved = await resolveCategory(
          db,
          userId,
          category,
          "Subscriptions",
        );
        if (!resolved.ok) return refuse(resolved.error);

        const cleanName = name.trim();
        const [twin] = await db
          .select({ id: subscription.id })
          .from(subscription)
          .where(
            and(
              eq(subscription.userId, userId),
              sql`lower(${subscription.name}) = ${cleanName.toLowerCase()}`,
            ),
          )
          .limit(1);
        if (twin) {
          return refuse(
            `A subscription called "${cleanName}" already exists (id ${twin.id}). Use update_subscription to change it.`,
          );
        }

        await db.insert(subscription).values({
          userId,
          name: cleanName,
          amount: round(amount),
          cycle,
          nextDueDate: due.value,
          billingDay: Number(due.value.slice(8, 10)),
          categoryId: resolved.value.id,
        });
        return {
          ok: true,
          summary: `Added ${cleanName}, ${formatPKR(amount, { decimals: 2 })} ${cycle}, next due ${formatDate(due.value)}.`,
        };
      },
    }),

    update_subscription: tool({
      description:
        "Change a subscription's amount, next due date, or pause or resume it. Requires approval.",
      needsApproval: true,
      inputSchema: z.object({
        subscription: z
          .string()
          .min(1)
          .optional()
          .describe("Subscription name."),
        subscriptionId: z.number().int().positive().optional(),
        amount: positive.optional(),
        nextDueDate: optionalDate.describe(
          "New next payment date. May be in the future.",
        ),
        status: z.enum(["active", "paused"]).optional(),
      }),
      execute: async ({
        subscription: query,
        subscriptionId,
        amount,
        nextDueDate,
        status,
      }) => {
        const target = await resolveSubscription(db, userId, {
          subscription: query,
          subscriptionId,
        });
        if (!target.ok) return refuse(target.error);
        const row = target.value;

        const patch: Partial<typeof subscription.$inferInsert> = {};
        const changes: string[] = [];
        if (amount !== undefined && round(amount) !== row.amount) {
          patch.amount = round(amount);
          changes.push(
            `amount ${formatPKR(row.amount, { decimals: 2 })} → ${formatPKR(amount, { decimals: 2 })}`,
          );
        }
        if (nextDueDate !== undefined && nextDueDate !== row.nextDueDate) {
          const due = checkDate(nextDueDate, todayPK(), { allowFuture: true });
          if (!due.ok) return refuse(due.error);
          patch.nextDueDate = due.value;
          patch.billingDay = Number(due.value.slice(8, 10));
          changes.push(
            `next due ${formatDate(row.nextDueDate)} → ${formatDate(due.value)}`,
          );
        }
        if (status !== undefined && status !== row.status) {
          patch.status = status;
          changes.push(status === "paused" ? "paused" : "resumed");
        }
        if (changes.length === 0) return refuse("Nothing would change.");

        await db
          .update(subscription)
          .set(patch)
          .where(
            and(eq(subscription.id, row.id), eq(subscription.userId, userId)),
          );
        return {
          ok: true,
          summary: `Updated ${row.name}: ${changes.join("; ")}.`,
        };
      },
    }),

    mark_subscription_paid: tool({
      description:
        "Record a subscription payment as an expense and move its next due date forward. Requires approval. Refused for a paused subscription, and flagged if a payment on that date already exists.",
      needsApproval: true,
      inputSchema: z.object({
        subscription: z
          .string()
          .min(1)
          .optional()
          .describe("Subscription name."),
        subscriptionId: z.number().int().positive().optional(),
        amount: positive
          .optional()
          .describe("Defaults to the subscription's amount."),
        date: optionalDate,
        confirm: confirmSchema,
      }),
      execute: async ({
        subscription: query,
        subscriptionId,
        amount,
        date,
        confirm,
      }) =>
        db.transaction(async (tx) => {
          const target = await resolveSubscription(tx, userId, {
            subscription: query,
            subscriptionId,
          });
          if (!target.ok) return refuse(target.error);
          const row = target.value;
          if (row.status !== "active") {
            return refuse(
              `${row.name} is paused. Resume it with update_subscription first.`,
            );
          }
          const when = checkDate(date, todayPK());
          if (!when.ok) return refuse(when.error);

          if (!confirm?.includes("duplicate")) {
            const [twin] = await tx
              .select({ id: expense.id })
              .from(expense)
              .where(
                and(
                  eq(expense.userId, userId),
                  eq(expense.subscriptionId, row.id),
                  eq(expense.date, when.value),
                ),
              )
              .limit(1);
            if (twin) {
              return refuse(
                `A payment for ${row.name} on ${formatDate(when.value)} is already recorded (expense ${twin.id}). Confirm this is a second payment.`,
                ["duplicate"],
              );
            }
          }

          const paid = round(amount ?? row.amount);
          const next = addCycle(row.nextDueDate, row.cycle, row.billingDay);
          await tx.insert(expense).values({
            userId,
            date: when.value,
            amount: paid,
            categoryId: row.categoryId,
            title: row.name,
            subscriptionId: row.id,
          });
          await tx
            .update(subscription)
            .set({ nextDueDate: next })
            .where(
              and(eq(subscription.id, row.id), eq(subscription.userId, userId)),
            );
          return {
            ok: true,
            summary: `Recorded ${formatPKR(paid, { decimals: 2 })} for ${row.name}. Next due ${asOf(next)}.`,
          };
        }),
    }),
  };
}

/** Tool names that change data, for the UI to label them. */
export const WRITE_TOOLS = new Set([
  "add_expense",
  "update_expense",
  "delete_expense",
  "add_transaction",
  "delete_transaction",
  "add_holding",
  "set_price",
  "add_subscription",
  "update_subscription",
  "mark_subscription_paid",
]);
