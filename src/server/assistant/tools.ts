import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { tool } from "ai";
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
import {
  allowedTxnKinds,
  computePosition,
  PortfolioError,
  type Txn,
} from "~/lib/portfolio";
import { loadAssetViews, toTxn } from "~/server/api/helpers";
import { db } from "~/server/db";
import {
  asset,
  assetTxn,
  expense,
  expenseCategory,
  subscription,
  type Asset,
} from "~/server/db/schema";
import { searchPsxSymbols, findPsxSymbol } from "~/server/prices/symbols";
import { fetchStockPrice } from "~/server/prices/psx";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .describe("Calendar date, YYYY-MM-DD, in Pakistan time.");

const isoTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

const positive = z.number().positive();
const nonNegative = z.number().min(0);

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

type Ctx = { userId: string };

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Finds one holding by symbol or name, or explains why it could not. */
async function resolveAsset(userId: string, query: string) {
  const needle = query.trim();
  const [row] = await db
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.userId, userId),
        or(
          sql`upper(${asset.symbol}) = ${needle.toUpperCase()}`,
          ilike(asset.name, `%${needle}%`),
        ),
      ),
    )
    .limit(2);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `No holding matches "${query}".`,
    });
  }
  return row;
}

async function resolveCategory(userId: string, name: string | undefined, fallback: string) {
  const wanted = (name ?? fallback).trim();
  const rows = await db
    .select({ id: expenseCategory.id, name: expenseCategory.name })
    .from(expenseCategory)
    .where(eq(expenseCategory.userId, userId));
  const exact = rows.find((row) => row.name.toLowerCase() === wanted.toLowerCase());
  if (exact) return exact;
  const partial = rows.find((row) => row.name.toLowerCase().includes(wanted.toLowerCase()));
  if (partial) return partial;
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `No category called "${wanted}". Existing categories: ${rows.map((row) => row.name).join(", ")}.`,
  });
}

function txnKindsFor(kind: Asset["kind"]) {
  return allowedTxnKinds(kind).join(", ");
}

/** Read tools plus the approval-gated write tools, bound to one account. */
export function createAssistantTools({ userId }: Ctx) {
  async function positions() {
    const views = await loadAssetViews(db, userId);
    return views.map(({ asset: a, position }) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      symbol: a.symbol,
      institution: a.institution,
      units: position.units,
      avgCost: position.avgCost,
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

    list_holdings: tool({
      description:
        "Every holding and account with units, average cost, latest price, value and profit. Optional kind filter.",
      inputSchema: z.object({
        kind: kindSchema.optional().describe("Limit to one kind of asset."),
      }),
      execute: async ({ kind }) => {
        const rows = (await positions()).filter((row) => !kind || row.kind === kind);
        return { ok: true, count: rows.length, holdings: rows };
      },
    }),

    list_transactions: tool({
      description:
        "Transaction history, most recent first. Pass a holding (symbol or name) for one asset, or omit it for everything.",
      inputSchema: z.object({
        holding: z.string().optional().describe("PSX symbol or part of a name."),
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ holding, limit }) => {
        const target = holding ? await resolveAsset(userId, holding) : null;
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
              target ? eq(assetTxn.assetId, target.id) : undefined,
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
          .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
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
          rows.reduce<Record<string, { name: string; total: number }>>((acc, row) => {
            acc[row.category] = acc[row.category] ?? { name: row.category, total: 0 };
            acc[row.category]!.total = round(acc[row.category]!.total + row.amount);
            return acc;
          }, {}),
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
        const rows = await db
          .select({
            id: expense.id,
            date: expense.date,
            title: expense.title,
            amount: expense.amount,
            category: expenseCategory.name,
          })
          .from(expense)
          .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
          .where(
            and(
              eq(expense.userId, userId),
              or(ilike(expense.title, `%${query}%`), ilike(expense.notes, `%${query}%`)),
            ),
          )
          .orderBy(desc(expense.date))
          .limit(limit);
        return { ok: true, count: rows.length, expenses: rows };
      },
    }),

    list_subscriptions: tool({
      description:
        "Recurring subscriptions with amount, cycle, next due date and how many days away it is.",
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
          .innerJoin(expenseCategory, eq(subscription.categoryId, expenseCategory.id))
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

    market_quote: tool({
      description:
        "Latest PSX price for a listed symbol, straight from the exchange. Use for current prices and for confirming a symbol.",
      inputSchema: z.object({ symbol: z.string().min(1).max(12) }),
      execute: async ({ symbol }) => {
        const result = await fetchStockPrice(symbol);
        if (!result.ok) return { ok: false, error: result.reason };
        return {
          ok: true,
          symbol: symbol.toUpperCase(),
          price: result.price,
          asOf: result.asOf,
          name: result.name ?? findPsxSymbol(symbol)?.name ?? null,
        };
      },
    }),

    search_symbols: tool({
      description: "Search the PSX directory by company name or ticker.",
      inputSchema: z.object({ query: z.string().min(1).max(60) }),
      execute: async ({ query }) => ({
        ok: true,
        results: searchPsxSymbols(query, 8),
      }),
    }),

    /* ------------------------- writing (approved) -------------------------- */

    add_expense: tool({
      description:
        "Record an expense. Requires the owner's approval. Use today's date unless another is given, and one of the existing categories.",
      needsApproval: true,
      inputSchema: z.object({
        title: z.string().min(1).max(120).describe("What it was for."),
        amount: positive.describe("Amount in PKR."),
        category: z.string().min(1).max(40).describe("An existing category name."),
        date: isoTimestamp,
        notes: z.string().max(500).optional(),
      }),
      execute: async ({ title, amount, category, date, notes }) => {
        const resolved = await resolveCategory(userId, category, "Other");
        const [row] = await db
          .insert(expense)
          .values({
            userId,
            title,
            amount: round(amount),
            categoryId: resolved.id,
            date: date ?? todayPK(),
            notes: notes ?? null,
          })
          .returning({ id: expense.id });
        return {
          ok: true,
          summary: `Recorded ${formatPKR(amount, { decimals: 2 })} for ${title} under ${resolved.name}.`,
          id: row?.id ?? null,
        };
      },
    }),

    delete_expense: tool({
      description: "Delete an expense by id. Requires approval.",
      needsApproval: true,
      inputSchema: z.object({ id: z.number().int() }),
      execute: async ({ id }) => {
        const deleted = await db
          .delete(expense)
          .where(and(eq(expense.id, id), eq(expense.userId, userId)))
          .returning({ title: expense.title, amount: expense.amount });
        if (deleted.length === 0) return { ok: false, error: "That expense no longer exists." };
        return {
          ok: true,
          summary: `Deleted ${deleted[0]!.title} (${formatPKR(deleted[0]!.amount, { decimals: 2 })}).`,
        };
      },
    }),

    add_transaction: tool({
      description:
        "Record a movement in a holding: buy, sell, bonus, dividend, deposit, withdrawal or profit. Requires approval. The portfolio rules are enforced.",
      needsApproval: true,
      inputSchema: z.object({
        holding: z.string().min(1).describe("PSX symbol or part of the holding name."),
        kind: txnKindSchema,
        units: positive.optional().describe("Units or shares, for buy/sell/bonus."),
        price: nonNegative.optional().describe("Price per unit."),
        amount: nonNegative.optional().describe("Cash amount; computed from units × price when omitted."),
        fees: nonNegative.default(0),
        date: isoTimestamp,
        notes: z.string().max(500).optional(),
      }),
      execute: async ({ holding, kind, units, price, fees, amount, date, notes }) => {
        const target = await resolveAsset(userId, holding);
        if (!allowedTxnKinds(target.kind).includes(kind)) {
          return {
            ok: false,
            error: `${target.name} accepts: ${txnKindsFor(target.kind)}.`,
          };
        }
        const needsUnits = kind === "buy" || kind === "sell" || kind === "bonus";
        if (needsUnits && !units) return { ok: false, error: "Units are required for this kind." };
        const gross =
          kind === "bonus"
            ? 0
            : round(amount ?? (units && price ? units * price : 0));
        if (kind !== "bonus" && gross <= 0) {
          return { ok: false, error: "An amount is required for this kind." };
        }

        const existing = await db
          .select()
          .from(assetTxn)
          .where(and(eq(assetTxn.assetId, target.id), eq(assetTxn.userId, userId)));
        const candidate: Txn = {
          id: Number.MAX_SAFE_INTEGER,
          kind,
          date: date ?? todayPK(),
          units: needsUnits ? (units ?? null) : null,
          amount: gross,
          fees: fees ?? 0,
        };
        try {
          computePosition(target.kind, target.lastPrice, [...existing.map(toTxn), candidate]);
        } catch (error) {
          return {
            ok: false,
            error: error instanceof PortfolioError ? error.message : "That would break the holding's balance.",
          };
        }

        await db.insert(assetTxn).values({
          userId,
          assetId: target.id,
          kind,
          date: candidate.date,
          units: candidate.units,
          unitPrice: price ?? null,
          amount: candidate.amount,
          fees: candidate.fees,
          notes: notes ?? null,
        });
        return {
          ok: true,
          summary: `Recorded ${kind} on ${target.name}${candidate.units ? ` (${formatUnits(candidate.units)} units)` : ""} for ${formatPKR(candidate.amount)}.`,
        };
      },
    }),

    add_holding: tool({
      description:
        "Create a holding or savings account, optionally with its first purchase or opening balance. Requires approval.",
      needsApproval: true,
      inputSchema: z.object({
        kind: kindSchema,
        name: z.string().min(1).optional().describe("Company, fund or account name."),
        symbol: z.string().max(12).optional().describe("PSX symbol, for stocks."),
        institution: z.string().max(120).optional().describe("Broker, AMC or bank."),
        units: positive.optional(),
        price: nonNegative.optional(),
        openingBalance: nonNegative.optional().describe("For savings accounts."),
        profitRate: nonNegative.max(100).optional(),
        date: isoTimestamp,
      }),
      execute: async ({ kind, name, symbol, institution, units, price, openingBalance, profitRate, date }) => {
        const when = date ?? todayPK();
        let finalName = name?.trim() ?? "";
        let finalSymbol: string | null = null;
        let lastPrice: number | null = null;
        let priceAsOf: string | null = null;

        if (kind === "stock") {
          if (!symbol) return { ok: false, error: "A PSX symbol is required for a stock." };
          const found = findPsxSymbol(symbol);
          const quote = await fetchStockPrice(symbol);
          finalSymbol = symbol.toUpperCase();
          const quotedName = quote.ok && quote.name ? quote.name : undefined;
          if (finalName === "") {
            finalName = quotedName ?? found?.name ?? finalSymbol;
          }
          if (quote.ok) {
            lastPrice = quote.price;
            priceAsOf = quote.asOf;
          } else if (price) {
            lastPrice = price;
            priceAsOf = when;
          }
        } else if (!finalName) {
          return { ok: false, error: "A name is required." };
        }

        if (kind !== "stock" && kind !== "savings") {
          if (price === undefined) return { ok: false, error: "The current NAV is required." };
          lastPrice = price;
          priceAsOf = when;
        }

        const [created] = await db
          .insert(asset)
          .values({
            userId,
            kind,
            name: finalName,
            symbol: finalSymbol,
            institution: institution ?? null,
            profitRate: kind === "savings" ? (profitRate ?? null) : null,
            lastPrice,
            priceAsOf,
            priceSource: lastPrice === null ? null : "manual",
          })
          .returning();

        if (kind === "savings" && openingBalance) {
          await db.insert(assetTxn).values({
            userId,
            assetId: created!.id,
            kind: "deposit",
            date: when,
            units: null,
            unitPrice: null,
            amount: round(openingBalance),
            fees: 0,
          });
        } else if (units && price) {
          await db.insert(assetTxn).values({
            userId,
            assetId: created!.id,
            kind: "buy",
            date: when,
            units,
            unitPrice: price,
            amount: round(units * price),
            fees: 0,
          });
        }

        return {
          ok: true,
          summary: `Added ${finalName}${finalSymbol ? ` (${finalSymbol})` : ""}${units ? ` with ${formatUnits(units)} units at ${price}` : ""}${openingBalance ? ` with ${formatPKR(openingBalance)} opening balance` : ""}.`,
          id: created!.id,
        };
      },
    }),

    set_price: tool({
      description: "Set a holding's price or NAV by hand. Requires approval.",
      needsApproval: true,
      inputSchema: z.object({
        holding: z.string().min(1),
        price: positive,
        date: isoTimestamp,
      }),
      execute: async ({ holding, price, date }) => {
        const target = await resolveAsset(userId, holding);
        if (target.kind === "savings") return { ok: false, error: "Savings accounts have no price." };
        await db
          .update(asset)
          .set({ lastPrice: price, priceAsOf: date ?? todayPK(), priceSource: "manual" })
          .where(and(eq(asset.id, target.id), eq(asset.userId, userId)));
        return {
          ok: true,
          summary: `Set ${target.name} to ${price} as of ${formatDate(date ?? todayPK())}.`,
        };
      },
    }),

    mark_subscription_paid: tool({
      description:
        "Record a subscription payment and move its next due date forward. Requires approval.",
      needsApproval: true,
      inputSchema: z.object({
        subscription: z.string().min(1).describe("Subscription name."),
        amount: positive.optional(),
        date: isoTimestamp,
      }),
      execute: async ({ subscription: query, amount, date }) => {
        const [row] = await db
          .select()
          .from(subscription)
          .where(and(eq(subscription.userId, userId), ilike(subscription.name, `%${query}%`)))
          .limit(1);
        if (!row) return { ok: false, error: `No subscription matches "${query}".` };
        const when = date ?? todayPK();
        const paid = round(amount ?? row.amount);
        await db.transaction(async (tx) => {
          await tx.insert(expense).values({
            userId,
            date: when,
            amount: paid,
            categoryId: row.categoryId,
            title: row.name,
            subscriptionId: row.id,
          });
          await tx
            .update(subscription)
            .set({ nextDueDate: addCycle(row.nextDueDate, row.cycle, row.billingDay) })
            .where(eq(subscription.id, row.id));
        });
        return {
          ok: true,
          summary: `Recorded ${formatPKR(paid, { decimals: 2 })} for ${row.name}. Next due ${formatDate(addCycle(row.nextDueDate, row.cycle, row.billingDay))}.`,
        };
      },
    }),

    add_subscription: tool({
      description: "Create a recurring subscription. Requires approval.",
      needsApproval: true,
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        amount: positive,
        cycle: z.enum(["monthly", "yearly"]),
        nextDueDate: isoDate.optional().describe("Defaults to one month from today."),
        category: z.string().optional().describe("Defaults to Subscriptions."),
      }),
      execute: async ({ name, amount, cycle, nextDueDate, category }) => {
        const resolved = await resolveCategory(userId, category, "Subscriptions");
        const due = nextDueDate ?? addDays(todayPK(), 30);
        await db.insert(subscription).values({
          userId,
          name,
          amount: round(amount),
          cycle,
          nextDueDate: due,
          billingDay: Number(due.slice(8, 10)),
          categoryId: resolved.id,
        });
        return {
          ok: true,
          summary: `Added ${name}, ${formatPKR(amount, { decimals: 2 })} ${cycle}, next due ${formatDate(due)}.`,
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
            const [year, monthNumber] = month.split("-").map(Number) as [number, number];
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
  };
}

/** Tool names that change data, for the UI to label them. */
export const WRITE_TOOLS = new Set([
  "add_expense",
  "delete_expense",
  "add_transaction",
  "add_holding",
  "set_price",
  "mark_subscription_paid",
  "add_subscription",
]);
