import { describe, expect, it } from "vitest";

import { analyzePortfolio, renderHealth, THRESHOLDS } from "./analytics";
import type { AssistantContext } from "./context";

type Holding = AssistantContext["holdings"][number];

const holding = (
  over: Partial<Holding> & Pick<Holding, "id" | "name" | "value">,
): Holding => ({
  kind: "stock",
  symbol: over.name.slice(0, 4).toUpperCase(),
  institution: null,
  sector: "Finance",
  units: 100,
  avgCost: 100,
  cost: over.value,
  price: 100,
  priceAsOf: "2026-11-16",
  unrealized: 0,
  unrealizedPct: 0,
  realized: 0,
  income: 0,
  profitRate: null,
  ...over,
});

function make(
  holdings: Holding[],
  over: Partial<AssistantContext> = {},
): AssistantContext {
  const netWorth = holdings.reduce((sum, row) => sum + row.value, 0);
  return {
    today: "2026-11-17",
    month: "2026-11",
    monthLabel: "November 2026",
    netWorth,
    holdings,
    byKind: [],
    spending: {
      month: "2026-11",
      total: 30_000,
      previousTotal: 60_000,
      avgMonthly3: 60_000,
      count: 10,
      categories: [],
      recent: [],
    },
    subscriptions: [],
    subscriptionMonthly: 0,
    categories: [],
    ...over,
  };
}

const codes = (context: AssistantContext) =>
  analyzePortfolio(context).flags.map((flag) => flag.code);

const balanced = () =>
  make([
    holding({ id: 1, name: "Alpha Bank", value: 100_000, sector: "Finance" }),
    holding({
      id: 2,
      name: "Beta Cement",
      value: 100_000,
      sector: "Non-energy minerals",
    }),
    holding({
      id: 3,
      name: "Gamma Oil",
      value: 100_000,
      sector: "Energy minerals",
    }),
    holding({
      id: 4,
      name: "Delta Power",
      value: 100_000,
      sector: "Utilities",
    }),
    holding({
      id: 5,
      name: "Epsilon Fert",
      value: 100_000,
      sector: "Process industries",
    }),
    holding({
      id: 6,
      name: "Meezan Money Market",
      kind: "money_market",
      symbol: null,
      sector: null,
      value: 400_000,
    }),
    holding({
      id: 7,
      name: "HBL Savings",
      kind: "savings",
      symbol: null,
      sector: null,
      value: 400_000,
    }),
  ]);

describe("analyzePortfolio: runway and cash", () => {
  it("measures runway in months of average spending", () => {
    const health = analyzePortfolio(balanced());
    expect(health.liquid.value).toBe(800_000);
    expect(health.liquid.runwayMonths).toBe(13.3);
  });

  it("flags a thin reserve as act", () => {
    const context = make([
      holding({
        id: 1,
        name: "HBL Savings",
        kind: "savings",
        symbol: null,
        sector: null,
        value: 90_000,
      }),
      holding({ id: 2, name: "Alpha Bank", value: 500_000 }),
    ]);
    const flag = analyzePortfolio(context).flags.find(
      (row) => row.code === "THIN_EMERGENCY_FUND",
    );
    expect(flag?.severity).toBe("act");
    expect(flag?.message).toContain("1.5 months");
  });

  it("flags idle cash only when it is both large and far past the reserve", () => {
    expect(codes(balanced())).toContain("IDLE_CASH");
    const modest = make([
      holding({
        id: 1,
        name: "HBL Savings",
        kind: "savings",
        symbol: null,
        sector: null,
        value: 400_000,
      }),
      holding({ id: 2, name: "Alpha Bank", value: 600_000 }),
    ]);
    expect(codes(modest)).not.toContain("IDLE_CASH");
  });

  it("does not guess a runway without spending history", () => {
    const context = make(
      [
        holding({
          id: 1,
          name: "HBL Savings",
          kind: "savings",
          symbol: null,
          sector: null,
          value: 90_000,
        }),
      ],
      { spending: { ...balanced().spending, avgMonthly3: null } },
    );
    const health = analyzePortfolio(context);
    expect(health.liquid.runwayMonths).toBeNull();
    expect(health.flags.map((flag) => flag.code)).not.toContain(
      "THIN_EMERGENCY_FUND",
    );
  });
});

describe("analyzePortfolio: concentration", () => {
  it("flags one dominant stock", () => {
    const context = make([
      holding({
        id: 1,
        name: "Oil Giant",
        symbol: "OGDC",
        value: 300_000,
        sector: "Energy minerals",
      }),
      holding({ id: 2, name: "Alpha Bank", value: 100_000 }),
      holding({
        id: 3,
        name: "HBL Savings",
        kind: "savings",
        symbol: null,
        sector: null,
        value: 600_000,
      }),
    ]);
    const flag = analyzePortfolio(context).flags.find(
      (row) => row.code === "SINGLE_STOCK_CONCENTRATION",
    );
    expect(flag?.severity).toBe("act");
    expect(flag?.message).toContain("OGDC");
    expect(flag?.message).toContain("30%");
  });

  it("flags a sector that dominates the stock book", () => {
    const context = make([
      holding({ id: 1, name: "Bank One", value: 100_000, sector: "Finance" }),
      holding({ id: 2, name: "Bank Two", value: 100_000, sector: "Finance" }),
      holding({ id: 3, name: "Bank Three", value: 100_000, sector: "Finance" }),
      holding({
        id: 4,
        name: "Cement One",
        value: 80_000,
        sector: "Non-energy minerals",
      }),
      holding({
        id: 5,
        name: "Oil One",
        value: 20_000,
        sector: "Energy minerals",
      }),
      holding({
        id: 6,
        name: "Cash",
        kind: "savings",
        symbol: null,
        sector: null,
        value: 700_000,
      }),
    ]);
    const flag = analyzePortfolio(context).flags.find(
      (row) => row.code === "SECTOR_CONCENTRATION",
    );
    expect(flag?.severity).toBe("act");
    expect(flag?.message).toContain("Finance");
  });

  it("leaves a diversified book alone", () => {
    const flags = codes(balanced());
    expect(flags).not.toContain("SINGLE_STOCK_CONCENTRATION");
    expect(flags).not.toContain("SECTOR_CONCENTRATION");
    expect(flags).not.toContain("THIN_STOCK_BOOK");
  });

  it("calls a book of two stocks thin", () => {
    const context = make([
      holding({ id: 1, name: "Alpha Bank", value: 50_000, sector: "Finance" }),
      holding({
        id: 2,
        name: "Beta Oil",
        value: 50_000,
        sector: "Energy minerals",
      }),
      holding({
        id: 3,
        name: "Cash",
        kind: "savings",
        symbol: null,
        sector: null,
        value: 900_000,
      }),
    ]);
    expect(codes(context)).toContain("THIN_STOCK_BOOK");
  });
});

describe("analyzePortfolio: prices, losers and spending", () => {
  it("flags stale and missing prices", () => {
    const context = make([
      holding({
        id: 1,
        name: "Old Price",
        symbol: "OLDP",
        priceAsOf: "2026-11-01",
        value: 100_000,
      }),
      holding({
        id: 2,
        name: "No Price",
        symbol: "NOPR",
        price: null,
        priceAsOf: null,
        value: 100_000,
      }),
    ]);
    const health = analyzePortfolio(context);
    expect(health.prices.stale).toEqual(["OLDP"]);
    expect(health.prices.missing).toEqual(["NOPR"]);
  });

  it("flags a large loser", () => {
    const context = make([
      holding({
        id: 1,
        name: "Sinking",
        symbol: "SINK",
        value: 70_000,
        cost: 100_000,
        unrealized: -30_000,
        unrealizedPct: -0.3,
      }),
    ]);
    expect(codes(context)).toContain("LARGE_LOSER");
  });

  it("flags a spending pace well above the usual", () => {
    const context = make(
      [holding({ id: 1, name: "Alpha Bank", value: 100_000 })],
      {
        today: "2026-11-17",
        spending: {
          ...balanced().spending,
          total: 80_000,
          avgMonthly3: 60_000,
        },
      },
    );
    const flag = analyzePortfolio(context).flags.find(
      (row) => row.code === "SPEND_PACE",
    );
    expect(flag).toBeDefined();
    expect(analyzePortfolio(context).spending.projected).toBeGreaterThan(
      60_000 * THRESHOLDS.spendPace,
    );
  });

  it("does not project spending in the first days of a month", () => {
    const context = make(
      [holding({ id: 1, name: "Alpha Bank", value: 100_000 })],
      {
        today: "2026-11-04",
        spending: { ...balanced().spending, total: 80_000 },
      },
    );
    expect(analyzePortfolio(context).spending.projected).toBeNull();
  });

  it("flags heavy subscriptions", () => {
    const context = make(
      [holding({ id: 1, name: "Alpha Bank", value: 100_000 })],
      {
        subscriptionMonthly: 9_000,
      },
    );
    expect(codes(context)).toContain("SUBSCRIPTION_BURN");
  });
});

describe("flags and rendering", () => {
  it("orders flags by severity", () => {
    const context = make([
      holding({
        id: 1,
        name: "Oil Giant",
        symbol: "OGDC",
        value: 400_000,
        sector: "Energy minerals",
      }),
      holding({
        id: 2,
        name: "HBL Savings",
        kind: "savings",
        symbol: null,
        sector: null,
        value: 50_000,
      }),
      holding({
        id: 3,
        name: "Old Price",
        symbol: "OLDP",
        priceAsOf: "2026-10-01",
        value: 50_000,
      }),
    ]);
    const severities = analyzePortfolio(context).flags.map(
      (flag) => flag.severity,
    );
    const rank = { act: 0, watch: 1, info: 2 } as const;
    expect([...severities].sort((a, b) => rank[a] - rank[b])).toEqual(
      severities,
    );
  });

  it("tells the model not to invent a problem when there are no flags", () => {
    const healthy = analyzePortfolio(
      make([
        holding({
          id: 1,
          name: "Alpha Bank",
          value: 80_000,
          sector: "Finance",
        }),
        holding({
          id: 2,
          name: "Beta Cement",
          value: 80_000,
          sector: "Non-energy minerals",
        }),
        holding({
          id: 3,
          name: "Gamma Oil",
          value: 80_000,
          sector: "Energy minerals",
        }),
        holding({
          id: 4,
          name: "Delta Power",
          value: 80_000,
          sector: "Utilities",
        }),
        holding({
          id: 5,
          name: "Epsilon Fert",
          value: 80_000,
          sector: "Process industries",
        }),
        holding({
          id: 6,
          name: "HBL Savings",
          kind: "savings",
          symbol: null,
          sector: null,
          value: 360_000,
        }),
      ]),
    );
    expect(healthy.flags).toEqual([]);
    expect(renderHealth(healthy).join("\n")).toContain(
      "rather than inventing a problem",
    );
  });

  it("renders the numbers the model needs", () => {
    const text = renderHealth(analyzePortfolio(balanced())).join("\n");
    expect(text).toContain("Liquid (savings + money market): Rs 800,000");
    expect(text).toContain("months of spending");
    expect(text).toContain("Sectors (share of stocks)");
  });
});
