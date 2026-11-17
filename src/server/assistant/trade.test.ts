import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Txn } from "~/lib/portfolio";

import { evaluateTrade, type TradeAsset } from "./trade";

const TODAY = "2026-11-17";
const stock: TradeAsset = {
  name: "Mari Energies Limited",
  kind: "stock",
  lastPrice: 612.4,
};
const savings: TradeAsset = {
  name: "HBL Everyday",
  kind: "savings",
  lastPrice: null,
};

const buy = (date: string, units: number, price: number): Txn => ({
  kind: "buy",
  date,
  units,
  amount: units * price,
  fees: 0,
});
const history: Txn[] = [
  buy("2026-01-05", 100, 500),
  buy("2026-03-10", 72, 540),
];

const run = (
  asset: TradeAsset,
  existing: Txn[],
  input: Parameters<typeof evaluateTrade>[0]["input"],
) => evaluateTrade({ asset, existing, input, today: TODAY });

describe("evaluateTrade: accepted trades", () => {
  it("prices a buy and reports before and after", () => {
    const result = run(stock, history, {
      kind: "buy",
      units: 28,
      price: 600,
      fees: 450,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.before.units).toBe(172);
    expect(result.after.units).toBe(200);
    expect(result.candidate.amount).toBe(16_800);
    expect(result.realizedDelta).toBe(0);
  });

  it("reports the realized gain on a sale", () => {
    const result = run(stock, history, { kind: "sell", units: 72, price: 620 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.units).toBe(100);
    expect(result.realizedDelta).toBeGreaterThan(0);
  });

  it("warns when a sale closes the position or books a loss", () => {
    const result = run(stock, history, {
      kind: "sell",
      units: 172,
      price: 500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(" ")).toContain("closes the position");
    expect(result.warnings.join(" ")).toContain("loss");
  });

  it("books bonus units at zero cost", () => {
    const result = run(stock, history, { kind: "bonus", units: 17 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.amount).toBe(0);
    expect(result.after.units).toBe(189);
  });

  it("records a dividend as income", () => {
    const result = run(stock, history, { kind: "dividend", amount: 4_300 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.income).toBe(4_300);
  });
});

describe("evaluateTrade: rejected trades", () => {
  it("refuses to oversell", () => {
    const result = run(stock, history, {
      kind: "sell",
      units: 173,
      price: 612,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("only 172");
  });

  it("refuses a sale that would be impossible on its own date", () => {
    const result = run(stock, history, {
      kind: "sell",
      date: "2026-02-01",
      units: 150,
      price: 600,
    });
    expect(result.ok).toBe(false);
  });

  it("refuses an overdraft on a savings account", () => {
    const result = run(
      savings,
      [
        {
          kind: "deposit",
          date: "2026-01-01",
          units: null,
          amount: 10_000,
          fees: 0,
        },
      ],
      { kind: "withdrawal", amount: 12_000 },
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a kind the asset does not take", () => {
    expect(run(savings, [], { kind: "buy", units: 1, price: 1 }).ok).toBe(
      false,
    );
    expect(run(stock, history, { kind: "deposit", amount: 100 }).ok).toBe(
      false,
    );
  });

  it("refuses future and impossible dates", () => {
    expect(
      run(stock, history, {
        kind: "buy",
        units: 1,
        price: 600,
        date: "2026-11-18",
      }).ok,
    ).toBe(false);
    expect(
      run(stock, history, {
        kind: "buy",
        units: 1,
        price: 600,
        date: "2026-02-30",
      }).ok,
    ).toBe(false);
  });

  it("refuses missing units and disagreeing figures", () => {
    expect(run(stock, history, { kind: "buy", price: 600 }).ok).toBe(false);
    expect(
      run(stock, history, { kind: "buy", units: 10, price: 600, amount: 1_000 })
        .ok,
    ).toBe(false);
  });

  it("stops a misplaced decimal until the owner confirms", () => {
    const blocked = run(stock, history, {
      kind: "buy",
      units: 10,
      price: 6124,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok)
      expect(blocked.needsConfirmation).toEqual(["unusual_price"]);

    const confirmed = run(stock, history, {
      kind: "buy",
      units: 10,
      price: 6124,
      confirm: ["unusual_price"],
    });
    expect(confirmed.ok).toBe(true);
  });

  it("stops an identical entry until the owner confirms", () => {
    const first = history[0]!;
    const input = {
      kind: "buy" as const,
      date: first.date,
      units: first.units!,
      price: 500,
    };
    const blocked = run(stock, history, input);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.needsConfirmation).toEqual(["duplicate"]);
    expect(run(stock, history, { ...input, confirm: ["duplicate"] }).ok).toBe(
      true,
    );
  });
});

describe("evaluateTrade: properties", () => {
  it("never accepts a sale larger than the units held", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5_000 }), (extra) => {
        const result = run(stock, history, {
          kind: "sell",
          units: 172 + extra,
          price: 612,
        });
        return !result.ok;
      }),
    );
  });

  it("a buy always raises units by exactly what was bought", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 40_000, max: 80_000 }).map((c) => c / 100),
        (units, price) => {
          const result = run(stock, history, { kind: "buy", units, price });
          return (
            result.ok && result.after.units === result.before.units + units
          );
        },
      ),
    );
  });
});
