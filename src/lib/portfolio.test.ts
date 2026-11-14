import { describe, expect, it } from "vitest";

import {
  computePosition,
  PortfolioError,
  summarize,
  type Txn,
} from "./portfolio";

const buy = (date: string, units: number, price: number, fees = 0): Txn => ({
  kind: "buy",
  date,
  units,
  amount: units * price,
  fees,
});
const sell = (date: string, units: number, price: number, fees = 0): Txn => ({
  kind: "sell",
  date,
  units,
  amount: units * price,
  fees,
});
const cash = (kind: Txn["kind"], date: string, amount: number): Txn => ({
  kind,
  date,
  units: null,
  amount,
  fees: 0,
});

describe("computePosition: unit assets", () => {
  it("averages the cost of two buys", () => {
    const p = computePosition("stock", 150, [
      buy("2026-01-01", 100, 100),
      buy("2026-02-01", 100, 200),
    ]);
    expect(p.units).toBe(200);
    expect(p.cost).toBe(30000);
    expect(p.avgCost).toBe(150);
    expect(p.marketValue).toBe(30000);
    expect(p.unrealized).toBe(0);
  });

  it("realizes gain on a partial sell and keeps the average cost", () => {
    const p = computePosition("stock", 180, [
      buy("2026-01-01", 100, 100),
      buy("2026-02-01", 100, 200),
      sell("2026-03-01", 50, 180),
    ]);
    expect(p.units).toBe(150);
    expect(p.avgCost).toBe(150);
    expect(p.cost).toBe(22500);
    expect(p.realized).toBe(1500);
    expect(p.marketValue).toBe(27000);
    expect(p.unrealized).toBe(4500);
    expect(p.unrealizedPct).toBeCloseTo(0.2, 6);
  });

  it("adds fees to cost on a buy and takes them off proceeds on a sell", () => {
    const p = computePosition("stock", 100, [
      buy("2026-01-01", 100, 100, 50),
      sell("2026-02-01", 100, 110, 60),
    ]);
    // cost 10,050; proceeds 11,000 − 60 = 10,940
    expect(p.realized).toBe(890);
  });

  it("lowers the average cost with bonus units and leaves total cost alone", () => {
    const p = computePosition("stock", 100, [
      buy("2026-01-01", 100, 100),
      { kind: "bonus", date: "2026-02-01", units: 25, amount: 0, fees: 0 },
    ]);
    expect(p.units).toBe(125);
    expect(p.cost).toBe(10000);
    expect(p.avgCost).toBe(80);
  });

  it("leaves no dust after selling everything", () => {
    const p = computePosition("mutual_fund", 10.6742, [
      buy("2026-01-01", 33.3333, 10.1234),
      buy("2026-01-15", 66.6667, 10.4321),
      sell("2026-02-01", 100, 10.6742),
    ]);
    expect(p.units).toBe(0);
    expect(p.cost).toBe(0);
    expect(p.avgCost).toBe(0);
    expect(p.marketValue).toBe(0);
    expect(p.hasPrice).toBe(true);
  });

  it("refuses to sell more than is held", () => {
    expect(() =>
      computePosition("stock", 100, [
        buy("2026-01-01", 10, 100),
        sell("2026-02-01", 11, 100),
      ]),
    ).toThrow(PortfolioError);
  });

  it("counts dividends as income, not cost", () => {
    const p = computePosition("stock", 100, [
      buy("2026-01-01", 100, 100),
      cash("dividend", "2026-03-01", 500),
    ]);
    expect(p.income).toBe(500);
    expect(p.cost).toBe(10000);
  });

  it("processes transactions in date order, not entry order", () => {
    const p = computePosition("stock", 100, [
      sell("2026-03-01", 50, 120),
      buy("2026-01-01", 100, 100),
    ]);
    expect(p.units).toBe(50);
    expect(p.realized).toBe(1000);
  });

  it("checks holdings as of the sale date", () => {
    expect(() =>
      computePosition("stock", 100, [
        sell("2026-01-01", 50, 120),
        buy("2026-02-01", 100, 100),
      ]),
    ).toThrow(/only 0 held/);
  });

  it("falls back to cost when there is no price", () => {
    const p = computePosition("stock", null, [buy("2026-01-01", 10, 100)]);
    expect(p.hasPrice).toBe(false);
    expect(p.marketValue).toBe(1000);
    expect(p.unrealized).toBe(0);
  });

  it("rejects savings transactions on a stock", () => {
    expect(() =>
      computePosition("stock", 1, [cash("deposit", "2026-01-01", 100)]),
    ).toThrow(PortfolioError);
  });
});

describe("computePosition: savings", () => {
  it("tracks balance, net deposited and profit", () => {
    const p = computePosition("savings", null, [
      cash("deposit", "2026-01-01", 100000),
      cash("deposit", "2026-02-01", 50000),
      cash("withdrawal", "2026-02-15", 30000),
      cash("profit", "2026-03-01", 1250.5),
    ]);
    expect(p.marketValue).toBe(121250.5);
    expect(p.cost).toBe(120000);
    expect(p.income).toBe(1250.5);
    expect(p.unrealized).toBe(0);
  });

  it("refuses a withdrawal larger than the balance on that date", () => {
    expect(() =>
      computePosition("savings", null, [
        cash("deposit", "2026-02-01", 1000),
        cash("withdrawal", "2026-01-15", 500),
      ]),
    ).toThrow(/balance on that date is 0/);
  });
});

describe("summarize", () => {
  it("totals by kind and computes allocation shares", () => {
    const stock = computePosition("stock", 150, [buy("2026-01-01", 100, 100)]);
    const fund = computePosition("money_market", 10, [buy("2026-01-01", 500, 10)]);
    const bank = computePosition("savings", null, [
      cash("deposit", "2026-01-01", 30000),
    ]);
    const s = summarize([
      { kind: "stock", position: stock },
      { kind: "money_market", position: fund },
      { kind: "savings", position: bank },
    ]);
    expect(s.total.marketValue).toBe(50000);
    expect(s.total.cost).toBe(45000);
    expect(s.total.unrealized).toBe(5000);
    expect(s.byKind.stock.share).toBeCloseTo(0.3, 6);
    expect(s.byKind.savings.share).toBeCloseTo(0.6, 6);
    expect(s.byKind.mutual_fund.count).toBe(0);
    // 5,000 gain on 15,000 of unit assets; savings excluded
    expect(s.total.unrealizedPct).toBeCloseTo(1 / 3, 5);
  });

  it("handles an empty portfolio", () => {
    const s = summarize([]);
    expect(s.total.marketValue).toBe(0);
    expect(s.byKind.stock.share).toBe(0);
  });
});
