/**
 * Fills an account with a realistic-looking portfolio and six months of
 * expenses, so the app can be looked at with real shapes of data.
 *
 *   pnpm seed:demo dev-tester@finbro.local
 *
 * It deletes that account's existing data first, so never point it at an
 * account you care about.
 */
import { and, eq } from "drizzle-orm";

import { addDays, currentMonthPK, shiftMonth, todayPK } from "~/lib/dates";
import { db } from "~/server/db";
import {
  asset,
  assetTxn,
  expense,
  expenseCategory,
  portfolioSnapshot,
  subscription,
  user,
} from "~/server/db/schema";

const email = process.argv[2] ?? "dev-tester@finbro.local";

const [owner] = await db.select().from(user).where(eq(user.email, email));
if (!owner) {
  console.error(`No account for ${email}. Create one with pnpm user:create.`);
  process.exit(1);
}
const userId = owner.id;

/* ------------------------------- clean up -------------------------------- */

await db.delete(asset).where(eq(asset.userId, userId)); // cascades to transactions
await db.delete(expense).where(eq(expense.userId, userId));
await db.delete(subscription).where(eq(subscription.userId, userId));
await db.delete(portfolioSnapshot).where(eq(portfolioSnapshot.userId, userId));

const categories = await db
  .insert(expenseCategory)
  .values(
    [
      "Subscriptions",
      "Payments to people",
      "Food",
      "Transport",
      "Bills & utilities",
      "Shopping",
      "Health",
      "Family",
      "Other",
    ].map((name) => ({ userId, name })),
  )
  .onConflictDoNothing()
  .returning();

const allCategories = await db
  .select()
  .from(expenseCategory)
  .where(eq(expenseCategory.userId, userId));
const categoryId = (name: string) =>
  allCategories.find((row) => row.name === name)?.id ?? categories[0]!.id;

/* ------------------------------ investments ------------------------------ */

const today = todayPK();

type Holding = {
  kind: "stock" | "mutual_fund" | "money_market" | "savings";
  name: string;
  symbol?: string;
  fundId?: string;
  institution?: string;
  category?: string;
  price: number;
  profitRate?: number;
  txns: {
    kind: "buy" | "sell" | "bonus" | "dividend" | "deposit" | "withdrawal" | "profit";
    date: string;
    units?: number;
    unitPrice?: number;
    amount: number;
    fees?: number;
  }[];
};

const holdings: Holding[] = [
  {
    kind: "stock",
    name: "Oil & Gas Development Company Limited",
    symbol: "OGDC",
    institution: "AKD Securities",
    price: 315.87,
    txns: [
      { kind: "buy", date: "2026-03-12", units: 400, unitPrice: 268.4, amount: 107_360, fees: 214 },
      { kind: "buy", date: "2026-07-02", units: 250, unitPrice: 291.15, amount: 72_787.5, fees: 145 },
      { kind: "dividend", date: "2026-09-18", amount: 6_825 },
      { kind: "sell", date: "2026-10-06", units: 150, unitPrice: 304.2, amount: 45_630, fees: 91 },
    ],
  },
  {
    kind: "stock",
    name: "Mari Energies Limited",
    symbol: "MARI",
    institution: "AKD Securities",
    price: 612.4,
    txns: [
      { kind: "buy", date: "2026-04-22", units: 120, unitPrice: 540.1, amount: 64_812, fees: 130 },
      { kind: "bonus", date: "2026-08-30", units: 12, amount: 0 },
      { kind: "buy", date: "2026-10-20", units: 40, unitPrice: 588.0, amount: 23_520, fees: 47 },
    ],
  },
  {
    kind: "stock",
    name: "Lucky Cement Limited",
    symbol: "LUCK",
    institution: "JS Global",
    price: 1_042.5,
    txns: [
      { kind: "buy", date: "2026-02-05", units: 45, unitPrice: 912.0, amount: 41_040, fees: 82 },
      { kind: "sell", date: "2026-11-03", units: 15, unitPrice: 1_018.0, amount: 15_270, fees: 31 },
    ],
  },
  {
    kind: "mutual_fund",
    name: "Meezan Islamic Fund",
    fundId: "12817",
    institution: "Al Meezan Investment Management Limited",
    category: "Shariah Compliant Equity",
    price: 162.63,
    txns: [
      { kind: "buy", date: "2026-01-15", units: 1_800.5, unitPrice: 141.2, amount: 254_200, fees: 0 },
      { kind: "bonus", date: "2026-06-28", units: 54.2, amount: 0 },
      { kind: "dividend", date: "2026-09-10", amount: 4_200 },
    ],
  },
  {
    kind: "mutual_fund",
    name: "NBP Stock Fund",
    fundId: "13054",
    institution: "NBP Fund Management Limited",
    category: "Equity",
    price: 42.65,
    txns: [
      { kind: "buy", date: "2026-05-11", units: 3_200, unitPrice: 39.9, amount: 127_680, fees: 0 },
    ],
  },
  {
    kind: "money_market",
    name: "ABL Cash Fund",
    fundId: "12768",
    institution: "ABL Asset Management Company Limited",
    category: "Money Market",
    price: 10.6742,
    txns: [
      { kind: "buy", date: "2026-02-01", units: 11_500, unitPrice: 10.28, amount: 118_220, fees: 0 },
      { kind: "bonus", date: "2026-08-01", units: 310.4, amount: 0 },
    ],
  },
  {
    kind: "money_market",
    name: "Meezan Cash Fund",
    fundId: "12820",
    institution: "Al Meezan Investment Management Limited",
    category: "Shariah Compliant Money Market",
    price: 53.56,
    txns: [
      { kind: "buy", date: "2026-09-01", units: 950, unitPrice: 51.4, amount: 48_830, fees: 0 },
    ],
  },
  {
    kind: "savings",
    name: "Meezan Savings",
    institution: "Meezan Bank",
    profitRate: 11.5,
    price: 0,
    txns: [
      { kind: "deposit", date: "2026-01-05", amount: 250_000 },
      { kind: "deposit", date: "2026-04-05", amount: 60_000 },
      { kind: "profit", date: "2026-06-30", amount: 8_912.4 },
      { kind: "withdrawal", date: "2026-08-14", amount: 45_000 },
      { kind: "profit", date: "2026-09-30", amount: 6_540.2 },
    ],
  },
  {
    kind: "savings",
    name: "HBL Everyday",
    institution: "Habib Bank Limited",
    profitRate: 9.2,
    price: 0,
    txns: [
      { kind: "deposit", date: "2026-03-20", amount: 120_000 },
      { kind: "profit", date: "2026-09-30", amount: 3_212.8 },
    ],
  },
];

for (const holding of holdings) {
  const [created] = await db
    .insert(asset)
    .values({
      userId,
      kind: holding.kind,
      name: holding.name,
      symbol: holding.symbol ?? null,
      fundId: holding.fundId ?? null,
      institution: holding.institution ?? null,
      category: holding.category ?? null,
      profitRate: holding.profitRate ?? null,
      lastPrice: holding.kind === "savings" ? null : holding.price,
      priceAsOf: holding.kind === "savings" ? null : today,
      priceSource: holding.kind === "savings" ? null : "auto",
      priceCheckedAt: holding.kind === "savings" ? null : new Date(),
    })
    .returning();

  await db.insert(assetTxn).values(
    holding.txns.map((txn) => ({
      userId,
      assetId: created!.id,
      kind: txn.kind,
      date: txn.date,
      units: txn.units ?? null,
      unitPrice: txn.unitPrice ?? null,
      amount: txn.amount,
      fees: txn.fees ?? 0,
    })),
  );
}

/* -------------------------------- expenses ------------------------------- */

const month = currentMonthPK();
const months = [5, 4, 3, 2, 1, 0].map((back) => shiftMonth(month, -back));

const templates: { title: string; category: string; amount: number; day: number }[] =
  [
    { title: "Groceries run", category: "Food", amount: 12_400, day: 3 },
    { title: "Petrol", category: "Transport", amount: 7_500, day: 5 },
    { title: "Electricity bill", category: "Bills & utilities", amount: 9_860, day: 8 },
    { title: "Internet", category: "Bills & utilities", amount: 3_200, day: 9 },
    { title: "Family dinner", category: "Family", amount: 6_150, day: 12 },
    { title: "Pharmacy", category: "Health", amount: 1_840, day: 14 },
    { title: "Groceries run", category: "Food", amount: 10_250, day: 17 },
    { title: "Careem rides", category: "Transport", amount: 2_980, day: 19 },
    { title: "Shoes", category: "Shopping", amount: 8_900, day: 22 },
    { title: "Sent to Ammi", category: "Payments to people", amount: 25_000, day: 25 },
    { title: "Mobile top-up", category: "Bills & utilities", amount: 1_500, day: 27 },
    { title: "Coffee and lunch", category: "Food", amount: 4_320, day: 28 },
  ];

const rows: (typeof expense.$inferInsert)[] = [];
months.forEach((target, index) => {
  const factor = 0.82 + index * 0.04;
  for (const template of templates) {
    // Skip a few entries so every month does not look identical.
    if ((template.day + index) % 7 === 0) continue;
    // Never date an expense after today.
    if (target === month && template.day > Number(today.slice(8, 10))) continue;
    rows.push({
      userId,
      date: `${target}-${String(template.day).padStart(2, "0")}`,
      amount: Math.round(template.amount * factor),
      categoryId: categoryId(template.category),
      title: template.title,
    });
  }
});
await db.insert(expense).values(rows);

/* ------------------------------ subscriptions ---------------------------- */

await db.insert(subscription).values([
  {
    userId,
    name: "Netflix",
    amount: 1_200,
    categoryId: categoryId("Subscriptions"),
    cycle: "monthly",
    nextDueDate: addDays(today, 6),
    billingDay: Number(addDays(today, 6).slice(8, 10)),
  },
  {
    userId,
    name: "Spotify",
    amount: 650,
    categoryId: categoryId("Subscriptions"),
    cycle: "monthly",
    nextDueDate: addDays(today, 14),
    billingDay: Number(addDays(today, 14).slice(8, 10)),
  },
  {
    userId,
    name: "iCloud 200GB",
    amount: 1_100,
    categoryId: categoryId("Subscriptions"),
    cycle: "monthly",
    nextDueDate: addDays(today, -3),
    billingDay: Number(addDays(today, -3).slice(8, 10)),
  },
  {
    userId,
    name: "Figma Professional",
    amount: 24_000,
    categoryId: categoryId("Subscriptions"),
    cycle: "yearly",
    nextDueDate: addDays(today, 48),
    billingDay: Number(addDays(today, 48).slice(8, 10)),
  },
]);

/* ------------------------- net-worth history ----------------------------- */

// A plausible curve that ends at today's real total.
const { loadAssetViews } = await import("~/server/api/helpers");
const { summarize } = await import("~/lib/portfolio");
const views = await loadAssetViews(db, userId);
const summary = summarize(
  views.map(({ asset: a, position }) => ({ kind: a.kind, position })),
);
const current = summary.total.marketValue;

for (let daysAgo = 90; daysAgo >= 0; daysAgo -= 1) {
  const date = addDays(today, -daysAgo);
  const drift = 0.86 + (90 - daysAgo) * 0.0016;
  const wobble = Math.sin(daysAgo / 4) * 0.006;
  for (const kind of ["stock", "mutual_fund", "money_market", "savings"] as const) {
    const share = summary.byKind[kind].marketValue / (current || 1);
    const value = Math.round(current * share * (drift + wobble));
    await db
      .insert(portfolioSnapshot)
      .values({
        userId,
        date,
        kind,
        marketValue: value,
        costBasis: summary.byKind[kind].cost,
      })
      .onConflictDoNothing();
  }
}

// Make today's snapshot exact.
for (const kind of ["stock", "mutual_fund", "money_market", "savings"] as const) {
  await db
    .delete(portfolioSnapshot)
    .where(
      and(
        eq(portfolioSnapshot.userId, userId),
        eq(portfolioSnapshot.date, today),
        eq(portfolioSnapshot.kind, kind),
      ),
    );
  await db.insert(portfolioSnapshot).values({
    userId,
    date: today,
    kind,
    marketValue: summary.byKind[kind].marketValue,
    costBasis: summary.byKind[kind].cost,
  });
}

console.log(
  `Seeded ${holdings.length} holdings, ${rows.length} expenses, 4 subscriptions for ${email}.`,
);
console.log(`Net worth: Rs ${summary.total.marketValue.toLocaleString()}`);
process.exit(0);
