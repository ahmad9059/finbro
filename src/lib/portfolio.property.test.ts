import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computePosition, PortfolioError, type Txn } from "./portfolio";

/** Spec: .kiro/specs/portfolio-invariants */

const cents = (min: number, max: number) =>
  fc.integer({ min, max }).map((c) => c / 100);
const unitsArb = fc.integer({ min: 1, max: 10_000 });
const priceArb = cents(1, 100_000);
const feesArb = cents(0, 5_000);
const dateArb = fc.constantFrom(
  "2026-01-05",
  "2026-01-06",
  "2026-02-10",
  "2026-03-15",
);

const cash = (value: number) => Math.round(value * 100) / 100;

const buyArb = fc
  .record({ date: dateArb, units: unitsArb, price: priceArb, fees: feesArb })
  .map(({ date, units, price, fees }): Txn => ({
    kind: "buy",
    date,
    units,
    amount: cash(units * price),
    fees,
  }));

const buysArb = fc.array(buyArb, { minLength: 1, maxLength: 12 });

const tolerance = (n: number) => 0.01 * n + 1e-6;

describe("computePosition: properties", () => {
  it("buy-only histories add up (units, cost, avgCost × units)", () => {
    fc.assert(
      fc.property(buysArb, priceArb, (buys, last) => {
        const p = computePosition("stock", last, buys);
        const units = buys.reduce((s, t) => s + (t.units ?? 0), 0);
        const cost = buys.reduce((s, t) => s + t.amount + t.fees, 0);
        expect(p.units).toBe(units);
        expect(Math.abs(p.cost - cost)).toBeLessThanOrEqual(
          tolerance(buys.length),
        );
        // avgCost is stored to 4 decimals, so avgCost × units drifts by up to units × 5e-5.
        expect(Math.abs(p.avgCost * p.units - p.cost)).toBeLessThanOrEqual(
          p.units * 5e-5 + 0.01,
        );
      }),
    );
  });

  it("a partial sale conserves cost and realizes proceeds minus cost removed", () => {
    fc.assert(
      fc.property(
        buysArb,
        fc.double({ min: 0.01, max: 0.99, noNaN: true }),
        priceArb,
        (buys, fraction, sellPrice) => {
          const bought = buys.reduce((s, t) => s + (t.units ?? 0), 0);
          const qty = Math.max(
            1,
            Math.min(bought - 1, Math.floor(bought * fraction)),
          );
          fc.pre(bought > 1);
          const totalCost = buys.reduce((s, t) => s + t.amount + t.fees, 0);
          const sale: Txn = {
            kind: "sell",
            date: "2026-12-31",
            units: qty,
            amount: cash(qty * sellPrice),
            fees: 0,
          };
          const p = computePosition("stock", sellPrice, [...buys, sale]);
          const costOut = (totalCost / bought) * qty;
          const slack = tolerance(buys.length + 1);
          expect(p.units).toBe(bought - qty);
          expect(Math.abs(p.cost + costOut - totalCost)).toBeLessThanOrEqual(
            slack,
          );
          expect(
            Math.abs(p.realized - (sale.amount - costOut)),
          ).toBeLessThanOrEqual(slack);
        },
      ),
    );
  });

  it("selling everything leaves no units and no cost", () => {
    fc.assert(
      fc.property(buysArb, priceArb, (buys, sellPrice) => {
        const bought = buys.reduce((s, t) => s + (t.units ?? 0), 0);
        const sale: Txn = {
          kind: "sell",
          date: "2026-12-31",
          units: bought,
          amount: cash(bought * sellPrice),
          fees: 0,
        };
        const p = computePosition("stock", sellPrice, [...buys, sale]);
        expect(p.units).toBe(0);
        expect(p.cost).toBe(0);
      }),
    );
  });

  it("selling more than is held always throws OVERSELL", () => {
    fc.assert(
      fc.property(
        buysArb,
        fc.integer({ min: 1, max: 1_000 }),
        (buys, extra) => {
          const bought = buys.reduce((s, t) => s + (t.units ?? 0), 0);
          const sale: Txn = {
            kind: "sell",
            date: "2026-12-31",
            units: bought + extra,
            amount: 0,
            fees: 0,
          };
          try {
            computePosition("stock", 100, [...buys, sale]);
            expect.unreachable("expected OVERSELL");
          } catch (error) {
            expect(error).toBeInstanceOf(PortfolioError);
            expect((error as PortfolioError).code).toBe("OVERSELL");
          }
        },
      ),
    );
  });

  it("permuting buys does not change the position", () => {
    fc.assert(
      fc.property(
        buysArb.chain((buys) =>
          fc.tuple(
            fc.constant(buys),
            fc.shuffledSubarray(buys, { minLength: buys.length }),
          ),
        ),
        ([buys, shuffled]) => {
          const a = computePosition("stock", 50, buys);
          const b = computePosition("stock", 50, shuffled);
          expect(b.units).toBe(a.units);
          expect(Math.abs(b.cost - a.cost)).toBeLessThanOrEqual(
            tolerance(buys.length),
          );
        },
      ),
    );
  });
});

describe("computePosition: savings properties", () => {
  const entryArb = fc.record({
    kind: fc.constantFrom("deposit", "profit", "withdrawal" as const),
    amount: cents(1, 500_000),
  });

  it("balance is deposits + profit − withdrawals, or OVERDRAFT when uncovered", () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 15 }),
        (entries) => {
          const txns: Txn[] = entries.map((e, i) => ({
            kind: e.kind,
            date: `2026-01-${String(i + 1).padStart(2, "0")}`,
            units: null,
            amount: e.amount,
            fees: 0,
          }));

          let balance = 0;
          let income = 0;
          let overdraft = false;
          for (const e of entries) {
            if (e.kind === "withdrawal") {
              if (e.amount > balance + 0.005) {
                overdraft = true;
                break;
              }
              balance -= e.amount;
            } else {
              balance += e.amount;
              if (e.kind === "profit") income += e.amount;
            }
          }

          if (overdraft) {
            try {
              computePosition("savings", null, txns);
              expect.unreachable("expected OVERDRAFT");
            } catch (error) {
              expect(error).toBeInstanceOf(PortfolioError);
              expect((error as PortfolioError).code).toBe("OVERDRAFT");
            }
            return;
          }

          const p = computePosition("savings", null, txns);
          expect(Math.abs(p.marketValue - balance)).toBeLessThanOrEqual(
            tolerance(entries.length),
          );
          expect(Math.abs(p.income - income)).toBeLessThanOrEqual(
            tolerance(entries.length),
          );
        },
      ),
    );
  });
});
