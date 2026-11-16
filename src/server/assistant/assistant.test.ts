import { describe, expect, it } from "vitest";

import { renderContext, type AssistantContext } from "./context";
import { buildSystemPrompt } from "./prompt";
import { createAssistantTools, WRITE_TOOLS } from "./tools";

const context: AssistantContext = {
  today: "2026-11-17",
  month: "2026-11",
  monthLabel: "November 2026",
  netWorth: 1_313_676,
  holdings: [
    {
      id: 17,
      kind: "stock",
      name: "Oil & Gas Development Company Limited",
      symbol: "OGDC",
      institution: "AKD Securities",
      units: 500,
      avgCost: 277.7,
      price: 315.87,
      priceAsOf: "2026-11-14",
      value: 157_935,
      unrealized: 19_084,
      unrealizedPct: 0.1374,
      realized: 0,
      income: 6_825,
      profitRate: null,
    },
  ],
  byKind: [{ kind: "stock", value: 157_935, share: 0.12 }],
  spending: {
    month: "2026-11",
    total: 92_514,
    previousTotal: 69_825,
    count: 11,
    categories: [{ name: "Food", total: 27_509, share: 0.297 }],
    recent: [
      { id: 41, date: "2026-11-15", title: "Groceries", amount: 2_500, category: "Food" },
    ],
  },
  subscriptions: [
    {
      id: 3,
      name: "Netflix",
      amount: 1_200,
      cycle: "monthly",
      nextDueDate: "2026-11-20",
      daysUntil: 3,
      status: "active",
      category: "Subscriptions",
    },
  ],
  categories: ["Food", "Subscriptions"],
};

describe("assistant context", () => {
  it("renders money, percentages and due dates in a readable snapshot", () => {
    const text = renderContext(context);
    expect(text).toContain("Net worth: Rs 1,313,676");
    expect(text).toContain("OGDC Oil & Gas Development Company Limited");
    expect(text).toContain("500 units");
    expect(text).toContain("+13.7%");
    expect(text).toContain("Netflix");
    expect(text).toContain("in 3d");
    expect(text).toContain("Groceries");
  });

  it("never loses the spend totals", () => {
    const text = renderContext(context);
    expect(text).toContain("Rs 92,514");
    expect(text).toContain("Rs 69,825");
  });
});

describe("system prompt", () => {
  it("carries the rules, the date and the snapshot", () => {
    const prompt = buildSystemPrompt(renderContext(context), context.today);
    expect(prompt).toContain("Numbers come from tools, never from memory");
    expect(prompt).toContain("17 Nov 2026");
    expect(prompt).toContain("Net worth: Rs 1,313,676");
    expect(prompt).toContain("approval");
    expect(prompt).toContain("Web search");
  });
});

describe("tool permissions", () => {
  const tools = createAssistantTools({ userId: "test-user" });

  it("gates every write tool behind approval", () => {
    for (const name of WRITE_TOOLS) {
      const definition = tools[name as keyof typeof tools] as {
        needsApproval?: boolean;
      };
      expect(definition, `${name} should exist`).toBeDefined();
      expect(definition.needsApproval, `${name} must require approval`).toBe(true);
    }
  });

  it("leaves reads free of approval", () => {
    for (const [name, definition] of Object.entries(tools)) {
      if (WRITE_TOOLS.has(name)) continue;
      expect((definition as { needsApproval?: boolean }).needsApproval, name).toBeFalsy();
    }
  });

  it("exposes the tools the prompt relies on", () => {
    const names = Object.keys(tools);
    for (const expected of [
      "portfolio_summary",
      "list_holdings",
      "expense_report",
      "add_expense",
      "add_transaction",
      "mark_subscription_paid",
    ]) {
      expect(names).toContain(expected);
    }
  });
});
