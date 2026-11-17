import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  checkDate,
  isUnusualPrice,
  pickMatch,
  priceDeviation,
  reconcileAmount,
} from "./validation";

const TODAY = "2026-11-17";

describe("checkDate", () => {
  it("defaults to today", () => {
    expect(checkDate(undefined, TODAY)).toEqual({ ok: true, value: TODAY });
  });

  it("rejects dates that do not exist", () => {
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "2026-00-10",
      "17-11-2026",
      "yesterday",
    ]) {
      expect(checkDate(bad, TODAY).ok, bad).toBe(false);
    }
  });

  it("rejects the future unless allowed", () => {
    expect(checkDate("2026-11-18", TODAY).ok).toBe(false);
    expect(checkDate("2026-11-18", TODAY, { allowFuture: true }).ok).toBe(true);
    expect(checkDate(TODAY, TODAY).ok).toBe(true);
  });

  it("rejects implausibly old years", () => {
    expect(checkDate("1999-12-31", TODAY).ok).toBe(false);
  });

  it("accepts a leap day only in a leap year", () => {
    expect(checkDate("2024-02-29", TODAY).ok).toBe(true);
    expect(checkDate("2025-02-29", TODAY).ok).toBe(false);
  });
});

describe("reconcileAmount", () => {
  it("computes the amount from units and price", () => {
    expect(reconcileAmount({ units: 100, price: 612.4 })).toEqual({
      ok: true,
      value: { amount: 61_240, unitPrice: 612.4 },
    });
  });

  it("derives the price from units and amount", () => {
    expect(reconcileAmount({ units: 200, amount: 61_240 })).toEqual({
      ok: true,
      value: { amount: 61_240, unitPrice: 306.2 },
    });
  });

  it("keeps the broker's amount when it agrees within rounding", () => {
    const result = reconcileAmount({
      units: 172,
      price: 514.59,
      amount: 88_507.5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.amount).toBe(88_507.5);
  });

  it("refuses figures that disagree", () => {
    expect(
      reconcileAmount({ units: 100, price: 612.4, amount: 6_124 }).ok,
    ).toBe(false);
  });

  it("needs something to work with", () => {
    expect(reconcileAmount({}).ok).toBe(false);
    expect(reconcileAmount({ units: 10 }).ok).toBe(false);
  });

  it("accepts a cash-only amount for non-unit kinds", () => {
    expect(reconcileAmount({ amount: 5_000 })).toEqual({
      ok: true,
      value: { amount: 5_000, unitPrice: null },
    });
  });
});

describe("price sanity", () => {
  it("flags a misplaced decimal and not a normal day's move", () => {
    expect(isUnusualPrice(3158.7, 315.87)).toBe(true);
    expect(isUnusualPrice(31.587, 315.87)).toBe(true);
    expect(isUnusualPrice(330, 315.87)).toBe(false);
    expect(isUnusualPrice(100, null)).toBe(false);
  });

  it("measures the deviation as a signed ratio", () => {
    expect(priceDeviation(110, 100)).toBeCloseTo(0.1);
    expect(priceDeviation(90, 100)).toBeCloseTo(-0.1);
  });
});

describe("pickMatch", () => {
  const rows = [
    { id: 1, name: "Meezan Islamic Fund", symbol: null },
    { id: 2, name: "Meezan Savings", symbol: null },
    { id: 3, name: "Mari Energies Limited", symbol: "MARI" },
    { id: 4, name: "Mari Petroleum Co", symbol: "MPCL" },
  ];

  it("never guesses between two partial matches", () => {
    const result = pickMatch(rows.slice(0, 2), "meezan");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Meezan Islamic Fund (id 1)");
      expect(result.error).toContain("Meezan Savings (id 2)");
    }
  });

  it("lets an exact symbol win over looser name matches", () => {
    const result = pickMatch(rows.slice(2), "mari");
    expect(result).toEqual({ ok: true, value: rows[2] });
  });

  it("lets an exact name win", () => {
    const result = pickMatch(rows.slice(0, 2), "Meezan Savings");
    expect(result).toEqual({ ok: true, value: rows[1] });
  });

  it("accepts a single partial match", () => {
    expect(pickMatch([rows[1]!], "savings").ok).toBe(true);
  });

  it("reports no match", () => {
    expect(pickMatch([], "xyz").ok).toBe(false);
  });

  it("property: with 2+ unrelated partial matches it never returns ok", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (n) => {
        const many = Array.from({ length: n }, (_, i) => ({
          id: i,
          name: `Alpha fund ${i}`,
          symbol: null,
        }));
        return !pickMatch(many, "alpha").ok;
      }),
    );
  });
});
