/**
 * Portfolio calculations. Pure functions: no database, no dates "now", no I/O.
 * Unit assets (stocks, funds) use the average-cost method.
 */

export const ASSET_KINDS = [
  "stock",
  "mutual_fund",
  "money_market",
  "savings",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const TXN_KINDS = [
  "buy",
  "sell",
  "bonus",
  "dividend",
  "deposit",
  "withdrawal",
  "profit",
] as const;
export type TxnKind = (typeof TXN_KINDS)[number];

const UNIT_TXN_KINDS = ["buy", "sell", "bonus", "dividend"] as const;
const SAVINGS_TXN_KINDS = ["deposit", "withdrawal", "profit"] as const;

/** Which transaction kinds an asset kind accepts. */
export function allowedTxnKinds(assetKind: AssetKind): readonly TxnKind[] {
  return assetKind === "savings" ? SAVINGS_TXN_KINDS : UNIT_TXN_KINDS;
}

export function isUnitAsset(assetKind: AssetKind): boolean {
  return assetKind !== "savings";
}

/** Kinds that must carry a unit count. */
export function txnNeedsUnits(kind: TxnKind): boolean {
  return kind === "buy" || kind === "sell" || kind === "bonus";
}

export type Txn = {
  id?: number;
  kind: TxnKind;
  /** YYYY-MM-DD */
  date: string;
  units: number | null;
  /** Gross PKR. units × price for buy/sell, cash for the rest, 0 for bonus. */
  amount: number;
  fees: number;
};

export type Position = {
  /** Units held. Always 0 for savings. */
  units: number;
  /** Cost basis of what is still held. Savings: net deposited. */
  cost: number;
  /** Cost per unit. 0 when nothing is held or for savings. */
  avgCost: number;
  /** units × price. Savings: the balance. */
  marketValue: number;
  /** marketValue − cost for unit assets. 0 for savings. */
  unrealized: number;
  /** unrealized ÷ cost as a ratio. 0 when cost is 0. */
  unrealizedPct: number;
  /** Gain already locked in by selling. */
  realized: number;
  /** Dividends, or profit credited to a savings account. */
  income: number;
  /** False when a unit asset has units but no price; value falls back to cost. */
  hasPrice: boolean;
};

export class PortfolioError extends Error {
  constructor(
    public readonly code: "OVERSELL" | "OVERDRAFT" | "INVALID_KIND",
    message: string,
  ) {
    super(message);
    this.name = "PortfolioError";
  }
}

const EPSILON = 1e-7;
const round = (value: number, places: number) => {
  const factor = 10 ** places;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
};
const money = (value: number) => round(value, 2);

/** Date order, then insertion order for transactions on the same day. */
function inOrder(txns: readonly Txn[]): Txn[] {
  return txns
    .map((txn, index) => ({ txn, index }))
    .sort(
      (a, b) =>
        a.txn.date.localeCompare(b.txn.date) ||
        (a.txn.id ?? a.index) - (b.txn.id ?? b.index),
    )
    .map(({ txn }) => txn);
}

export function computePosition(
  assetKind: AssetKind,
  lastPrice: number | null,
  txns: readonly Txn[],
): Position {
  const allowed = allowedTxnKinds(assetKind);
  let units = 0;
  let cost = 0;
  let realized = 0;
  let income = 0;
  let balance = 0;

  for (const txn of inOrder(txns)) {
    if (!allowed.includes(txn.kind)) {
      throw new PortfolioError(
        "INVALID_KIND",
        `A ${txn.kind} transaction is not valid for this kind of asset.`,
      );
    }
    const qty = txn.units ?? 0;

    switch (txn.kind) {
      case "buy":
        units += qty;
        cost += txn.amount + txn.fees;
        break;
      case "bonus":
        units += qty;
        break;
      case "sell": {
        if (qty > units + EPSILON) {
          throw new PortfolioError(
            "OVERSELL",
            `Cannot sell ${qty} on ${txn.date}: only ${round(units, 4)} held on that date.`,
          );
        }
        const costOut = units > 0 ? (cost / units) * qty : 0;
        realized += txn.amount - txn.fees - costOut;
        cost -= costOut;
        units -= qty;
        if (units < EPSILON) {
          units = 0;
          cost = 0;
        }
        break;
      }
      case "dividend":
        income += txn.amount;
        break;
      case "deposit":
        balance += txn.amount;
        cost += txn.amount;
        break;
      case "withdrawal":
        if (txn.amount > balance + 0.005) {
          throw new PortfolioError(
            "OVERDRAFT",
            `Cannot withdraw ${money(txn.amount)} on ${txn.date}: the balance on that date is ${money(balance)}.`,
          );
        }
        balance -= txn.amount;
        cost -= txn.amount;
        break;
      case "profit":
        balance += txn.amount;
        income += txn.amount;
        break;
    }
  }

  if (assetKind === "savings") {
    return {
      units: 0,
      cost: money(cost),
      avgCost: 0,
      marketValue: money(balance),
      unrealized: 0,
      unrealizedPct: 0,
      realized: 0,
      income: money(income),
      hasPrice: true,
    };
  }

  const hasPrice = lastPrice !== null || units === 0;
  const marketValue = lastPrice !== null ? units * lastPrice : cost;
  const unrealized = marketValue - cost;

  return {
    units: round(units, 4),
    cost: money(cost),
    avgCost: units > 0 ? round(cost / units, 4) : 0,
    marketValue: money(marketValue),
    unrealized: money(unrealized),
    unrealizedPct: cost > 0 ? round(unrealized / cost, 6) : 0,
    realized: money(realized),
    income: money(income),
    hasPrice,
  };
}

export type KindTotals = {
  marketValue: number;
  cost: number;
  unrealized: number;
  realized: number;
  income: number;
  /** Share of total market value, 0–1. */
  share: number;
  count: number;
};

export type Summary = {
  byKind: Record<AssetKind, KindTotals>;
  total: Omit<KindTotals, "share" | "count"> & { unrealizedPct: number };
};

const emptyTotals = (): KindTotals => ({
  marketValue: 0,
  cost: 0,
  unrealized: 0,
  realized: 0,
  income: 0,
  share: 0,
  count: 0,
});

export function summarize(
  items: readonly { kind: AssetKind; position: Position }[],
): Summary {
  const byKind = Object.fromEntries(
    ASSET_KINDS.map((kind) => [kind, emptyTotals()]),
  ) as Record<AssetKind, KindTotals>;

  for (const { kind, position } of items) {
    const totals = byKind[kind];
    totals.marketValue += position.marketValue;
    totals.cost += position.cost;
    totals.unrealized += position.unrealized;
    totals.realized += position.realized;
    totals.income += position.income;
    totals.count += 1;
  }

  const total = { marketValue: 0, cost: 0, unrealized: 0, realized: 0, income: 0 };
  for (const kind of ASSET_KINDS) {
    const totals = byKind[kind];
    for (const key of Object.keys(total) as (keyof typeof total)[]) {
      totals[key] = money(totals[key]);
      total[key] += totals[key];
    }
  }
  for (const key of Object.keys(total) as (keyof typeof total)[]) {
    total[key] = money(total[key]);
  }
  for (const kind of ASSET_KINDS) {
    byKind[kind].share =
      total.marketValue > 0
        ? round(byKind[kind].marketValue / total.marketValue, 6)
        : 0;
  }

  // Savings carry no unrealized gain, so the ratio is against unit assets only.
  const unitCost = total.cost - byKind.savings.cost;
  return {
    byKind,
    total: {
      ...total,
      unrealizedPct: unitCost > 0 ? round(total.unrealized / unitCost, 6) : 0,
    },
  };
}
