import { daysBetween, daysInMonth } from "~/lib/dates";
import { formatPercent, formatPKR } from "~/lib/format";

import type { AssistantContext } from "./context";

/**
 * Portfolio diagnostics, computed in code so the model reasons about facts it
 * was handed instead of estimating them. Thresholds are rules of thumb for a
 * retail investor in a narrow market, kept here so they are easy to tune.
 */
export const THRESHOLDS = {
  /** One stock above this share of net worth is worth a look / is a problem. */
  singleStockWatch: 0.15,
  singleStockAct: 0.25,
  /** One sector above this share of the stock book, with two or more stocks. */
  sectorWatch: 0.4,
  sectorAct: 0.55,
  /** Months of spending that should sit in savings or money market. */
  runwayAct: 3,
  runwayTarget: 6,
  /** Cash well beyond the target runway is idle against inflation. */
  idleCashShare: 0.5,
  idleRunwayMonths: 12,
  /** A price older than this many days counts as stale. */
  staleDays: 7,
  /** A holding this far under its cost deserves a thesis review. */
  largeLoser: -0.2,
  /** Fewer stocks than this is a thin book. */
  thinBook: 5,
  /** Subscriptions above this share of monthly spending. */
  subscriptionShare: 0.1,
  /** Month-to-date spending pace above this multiple of the 3-month average. */
  spendPace: 1.25,
} as const;

export type Flag = {
  code: string;
  severity: "info" | "watch" | "act";
  message: string;
};

export type PortfolioHealth = {
  netWorth: number;
  allocation: { kind: string; value: number; share: number }[];
  liquid: {
    value: number;
    share: number;
    /** Months of average spending covered; null when there is no spending history. */
    runwayMonths: number | null;
    avgMonthlySpend: number | null;
  };
  stocks: {
    count: number;
    value: number;
    shareOfNetWorth: number;
    largest: {
      name: string;
      symbol: string | null;
      shareOfNetWorth: number;
    } | null;
    top3ShareOfNetWorth: number;
    sectors: {
      sector: string;
      value: number;
      shareOfStocks: number;
      names: string[];
    }[];
  };
  performance: {
    unrealized: number;
    realized: number;
    income: number;
    best: { name: string; pct: number }[];
    worst: { name: string; pct: number }[];
  };
  prices: { stale: string[]; missing: string[] };
  subscriptions: { monthly: number; shareOfSpending: number | null };
  spending: { month: number; previous: number; projected: number | null };
  flags: Flag[];
};

const round = (value: number, places = 2) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const share = (part: number, whole: number) =>
  whole > 0 ? round(part / whole, 4) : 0;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const UNIT_KINDS = new Set(["stock", "mutual_fund", "money_market"]);

export function analyzePortfolio(context: AssistantContext): PortfolioHealth {
  const { holdings, netWorth, today } = context;
  const flags: Flag[] = [];

  const kinds = new Map<string, number>();
  for (const row of holdings)
    kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + row.value);
  const allocation = [...kinds.entries()]
    .map(([kind, value]) => ({
      kind,
      value: round(value),
      share: share(value, netWorth),
    }))
    .sort((a, b) => b.value - a.value);

  /* ------------------------------ liquidity ------------------------------ */
  const liquidValue = round(
    holdings
      .filter((row) => row.kind === "savings" || row.kind === "money_market")
      .reduce((sum, row) => sum + row.value, 0),
  );
  const avg = context.spending.avgMonthly3;
  const runwayMonths = avg && avg > 0 ? round(liquidValue / avg, 1) : null;

  if (runwayMonths !== null) {
    if (runwayMonths < THRESHOLDS.runwayAct) {
      flags.push({
        code: "THIN_EMERGENCY_FUND",
        severity: "act",
        message: `Savings and money market cover ${runwayMonths} months of spending; the target is ${THRESHOLDS.runwayTarget}.`,
      });
    } else if (runwayMonths < THRESHOLDS.runwayTarget) {
      flags.push({
        code: "BELOW_RUNWAY_TARGET",
        severity: "watch",
        message: `Liquid cover is ${runwayMonths} months of spending, under the ${THRESHOLDS.runwayTarget}-month target.`,
      });
    } else if (
      runwayMonths > THRESHOLDS.idleRunwayMonths &&
      share(liquidValue, netWorth) > THRESHOLDS.idleCashShare
    ) {
      const excess = round(
        liquidValue - THRESHOLDS.runwayTarget * (avg ?? 0),
        0,
      );
      flags.push({
        code: "IDLE_CASH",
        severity: "info",
        message: `${pct(share(liquidValue, netWorth))} of net worth is in savings or money market, ${runwayMonths} months of spending. About ${formatPKR(excess)} sits above a ${THRESHOLDS.runwayTarget}-month reserve and loses ground to inflation if it has no near-term use.`,
      });
    }
  }

  /* ------------------------------- stocks -------------------------------- */
  const stocks = holdings.filter((row) => row.kind === "stock");
  const stockValue = round(stocks.reduce((sum, row) => sum + row.value, 0));
  const byValue = [...stocks].sort((a, b) => b.value - a.value);
  const largest = byValue[0]
    ? {
        name: byValue[0].name,
        symbol: byValue[0].symbol,
        shareOfNetWorth: share(byValue[0].value, netWorth),
      }
    : null;
  const top3 = share(
    byValue.slice(0, 3).reduce((sum, row) => sum + row.value, 0),
    netWorth,
  );

  if (largest) {
    const label = largest.symbol ?? largest.name;
    if (largest.shareOfNetWorth >= THRESHOLDS.singleStockAct) {
      flags.push({
        code: "SINGLE_STOCK_CONCENTRATION",
        severity: "act",
        message: `${label} is ${pct(largest.shareOfNetWorth)} of net worth in one company.`,
      });
    } else if (largest.shareOfNetWorth >= THRESHOLDS.singleStockWatch) {
      flags.push({
        code: "SINGLE_STOCK_CONCENTRATION",
        severity: "watch",
        message: `${label} is ${pct(largest.shareOfNetWorth)} of net worth in one company.`,
      });
    }
  }

  const sectorMap = new Map<string, { value: number; names: string[] }>();
  for (const row of stocks) {
    const key = row.sector ?? "Unclassified";
    const entry = sectorMap.get(key) ?? { value: 0, names: [] };
    entry.value += row.value;
    entry.names.push(row.symbol ?? row.name);
    sectorMap.set(key, entry);
  }
  const sectors = [...sectorMap.entries()]
    .map(([sector, entry]) => ({
      sector,
      value: round(entry.value),
      shareOfStocks: share(entry.value, stockValue),
      names: entry.names,
    }))
    .sort((a, b) => b.value - a.value);

  const topSector = sectors.find((row) => row.sector !== "Unclassified");
  if (topSector && stocks.length >= 2 && topSector.names.length >= 2) {
    if (topSector.shareOfStocks >= THRESHOLDS.sectorAct) {
      flags.push({
        code: "SECTOR_CONCENTRATION",
        severity: "act",
        message: `${topSector.sector} is ${pct(topSector.shareOfStocks)} of the stock book (${topSector.names.join(", ")}).`,
      });
    } else if (topSector.shareOfStocks >= THRESHOLDS.sectorWatch) {
      flags.push({
        code: "SECTOR_CONCENTRATION",
        severity: "watch",
        message: `${topSector.sector} is ${pct(topSector.shareOfStocks)} of the stock book (${topSector.names.join(", ")}).`,
      });
    }
  }

  if (stocks.length > 0 && stocks.length < THRESHOLDS.thinBook) {
    flags.push({
      code: "THIN_STOCK_BOOK",
      severity: "info",
      message: `Only ${stocks.length} stock${stocks.length === 1 ? "" : "s"}; one company's bad quarter moves the whole book. A diversified equity fund can supply the breadth.`,
    });
  }

  /* ---------------------------- performance ------------------------------ */
  const unitRows = holdings.filter(
    (row) => UNIT_KINDS.has(row.kind) && row.cost > 0,
  );
  const ranked = [...unitRows].sort(
    (a, b) => b.unrealizedPct - a.unrealizedPct,
  );
  const best = ranked.slice(0, 3).map((row) => ({
    name: row.symbol ?? row.name,
    pct: round(row.unrealizedPct, 4),
  }));
  const worst = ranked
    .slice(-3)
    .reverse()
    .map((row) => ({
      name: row.symbol ?? row.name,
      pct: round(row.unrealizedPct, 4),
    }));
  for (const row of unitRows) {
    if (row.unrealizedPct <= THRESHOLDS.largeLoser) {
      flags.push({
        code: "LARGE_LOSER",
        severity: "info",
        message: `${row.symbol ?? row.name} is ${formatPercent(row.unrealizedPct)} against cost. Review the reason you own it; do not average down on hope.`,
      });
    }
  }

  /* ------------------------------- prices -------------------------------- */
  const stale: string[] = [];
  const missing: string[] = [];
  for (const row of holdings) {
    if (!UNIT_KINDS.has(row.kind) || row.units <= 0) continue;
    const label = row.symbol ?? row.name;
    if (row.price === null) missing.push(label);
    else if (
      row.priceAsOf &&
      daysBetween(row.priceAsOf, today) > THRESHOLDS.staleDays
    )
      stale.push(label);
  }
  if (missing.length > 0) {
    flags.push({
      code: "NO_PRICE",
      severity: "watch",
      message: `No price for ${missing.join(", ")}; those values fall back to cost.`,
    });
  }
  if (stale.length > 0) {
    flags.push({
      code: "STALE_PRICES",
      severity: "watch",
      message: `Prices older than ${THRESHOLDS.staleDays} days: ${stale.join(", ")}. Refresh before trusting the gain figures.`,
    });
  }

  /* ----------------------- subscriptions and spending ---------------------- */
  const subShare =
    avg && avg > 0 ? share(context.subscriptionMonthly, avg) : null;
  if (subShare !== null && subShare >= THRESHOLDS.subscriptionShare) {
    flags.push({
      code: "SUBSCRIPTION_BURN",
      severity: "info",
      message: `Subscriptions cost ${formatPKR(context.subscriptionMonthly)} a month, ${pct(subShare)} of typical spending.`,
    });
  }

  const [year, monthNumber] = context.month.split("-").map(Number) as [
    number,
    number,
  ];
  const dayOfMonth = Number(today.slice(8, 10));
  const projected =
    dayOfMonth >= 10
      ? round(
          (context.spending.total / dayOfMonth) *
            daysInMonth(year, monthNumber),
          0,
        )
      : null;
  if (
    projected !== null &&
    avg &&
    avg > 0 &&
    projected > avg * THRESHOLDS.spendPace
  ) {
    flags.push({
      code: "SPEND_PACE",
      severity: "watch",
      message: `${context.monthLabel} is on pace for ${formatPKR(projected)}, ${pct(projected / avg - 1)} above the 3-month average of ${formatPKR(avg)}.`,
    });
  }

  const order = { act: 0, watch: 1, info: 2 } as const;
  flags.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    netWorth,
    allocation,
    liquid: {
      value: liquidValue,
      share: share(liquidValue, netWorth),
      runwayMonths,
      avgMonthlySpend: avg,
    },
    stocks: {
      count: stocks.length,
      value: stockValue,
      shareOfNetWorth: share(stockValue, netWorth),
      largest,
      top3ShareOfNetWorth: top3,
      sectors,
    },
    performance: {
      unrealized: round(holdings.reduce((sum, row) => sum + row.unrealized, 0)),
      realized: round(holdings.reduce((sum, row) => sum + row.realized, 0)),
      income: round(holdings.reduce((sum, row) => sum + row.income, 0)),
      best,
      worst,
    },
    prices: { stale, missing },
    subscriptions: {
      monthly: context.subscriptionMonthly,
      shareOfSpending: subShare,
    },
    spending: {
      month: context.spending.total,
      previous: context.spending.previousTotal,
      projected,
    },
    flags,
  };
}

/** Compact lines for the system prompt. */
export function renderHealth(health: PortfolioHealth): string[] {
  const lines: string[] = [];
  lines.push("Health check (computed, not estimated):");

  const runway =
    health.liquid.runwayMonths === null
      ? "no spending history to measure runway"
      : `${health.liquid.runwayMonths} months of spending (average ${formatPKR(health.liquid.avgMonthlySpend ?? 0)}/month over the last complete months)`;
  lines.push(
    `- Liquid (savings + money market): ${formatPKR(health.liquid.value)}, ${pct(health.liquid.share)} of net worth, ${runway}.`,
  );

  if (health.stocks.count > 0) {
    const largest = health.stocks.largest;
    lines.push(
      `- Stocks: ${health.stocks.count} holdings, ${formatPKR(health.stocks.value)} (${pct(health.stocks.shareOfNetWorth)} of net worth). Largest ${largest?.symbol ?? largest?.name} ${pct(largest?.shareOfNetWorth ?? 0)}; top 3 ${pct(health.stocks.top3ShareOfNetWorth)}.`,
    );
    lines.push(
      `- Sectors (share of stocks): ${health.stocks.sectors
        .slice(0, 5)
        .map((row) => `${row.sector} ${pct(row.shareOfStocks)}`)
        .join(", ")}.`,
    );
  }

  if (health.flags.length === 0) {
    lines.push(
      "- Flags: none. The structure looks sound; say so rather than inventing a problem.",
    );
  } else {
    lines.push("- Flags:");
    for (const flag of health.flags.slice(0, 7)) {
      lines.push(`  - [${flag.severity}] ${flag.message}`);
    }
  }
  return lines;
}
