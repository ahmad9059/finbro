import {
  allowedTxnKinds,
  computePosition,
  PortfolioError,
  txnNeedsUnits,
  type AssetKind,
  type Position,
  type Txn,
  type TxnKind,
} from "~/lib/portfolio";

import {
  checkDate,
  HIGH_FEE_RATIO,
  isUnusualPrice,
  priceDeviation,
  reconcileAmount,
  round,
} from "./validation";

/** What the owner can explicitly confirm to push past a guard. */
export type Confirmation = "unusual_price" | "duplicate";

export type TradeAsset = {
  name: string;
  kind: AssetKind;
  lastPrice: number | null;
};

export type TradeInput = {
  kind: TxnKind;
  units?: number;
  price?: number;
  amount?: number;
  fees?: number;
  date?: string;
  confirm?: readonly Confirmation[];
};

export type PositionSummary = Pick<
  Position,
  | "units"
  | "avgCost"
  | "cost"
  | "marketValue"
  | "unrealized"
  | "realized"
  | "income"
>;

export type TradeResult =
  | {
      ok: true;
      candidate: Txn;
      unitPrice: number | null;
      before: PositionSummary;
      after: PositionSummary;
      /** Gain locked in by this transaction alone (sells). */
      realizedDelta: number;
      warnings: string[];
    }
  | { ok: false; error: string; needsConfirmation?: Confirmation[] };

const summarize = (position: Position): PositionSummary => ({
  units: position.units,
  avgCost: position.avgCost,
  cost: position.cost,
  marketValue: position.marketValue,
  unrealized: position.unrealized,
  realized: position.realized,
  income: position.income,
});

const rs = (value: number) =>
  `Rs ${Math.abs(round(value)).toLocaleString("en-US")}`;

/**
 * The single rule set for adding a movement to a holding. `simulate_trade`
 * and `add_transaction` both call this, so what the owner is told in advance
 * is exactly what the write enforces.
 */
export function evaluateTrade(args: {
  asset: TradeAsset;
  existing: readonly Txn[];
  input: TradeInput;
  today: string;
}): TradeResult {
  const { asset, existing, input, today } = args;
  const confirmed = new Set(input.confirm ?? []);
  const fail = (
    error: string,
    needsConfirmation?: Confirmation[],
  ): Extract<TradeResult, { ok: false }> => ({
    ok: false,
    error,
    needsConfirmation,
  });

  const allowed = allowedTxnKinds(asset.kind);
  if (!allowed.includes(input.kind)) {
    return fail(`${asset.name} accepts: ${allowed.join(", ")}.`);
  }

  const date = checkDate(input.date, today);
  if (!date.ok) return fail(date.error);

  const needsUnits = txnNeedsUnits(input.kind);
  if (needsUnits && !(input.units && input.units > 0)) {
    return fail(`Units are required for a ${input.kind}.`);
  }
  if (!needsUnits && input.units) {
    return fail(`Units do not apply to a ${input.kind}; give the cash amount.`);
  }

  let amount = 0;
  let unitPrice: number | null = null;
  if (input.kind !== "bonus") {
    const settled = reconcileAmount({
      units: input.units,
      price: input.price,
      amount: input.amount,
    });
    if (!settled.ok) return fail(settled.error);
    amount = settled.value.amount;
    unitPrice = settled.value.unitPrice;
    if (amount <= 0) return fail("The amount must be above zero.");
  }

  const fees = round(input.fees ?? 0);

  const isTrade = input.kind === "buy" || input.kind === "sell";
  if (
    isTrade &&
    unitPrice !== null &&
    isUnusualPrice(unitPrice, asset.lastPrice) &&
    !confirmed.has("unusual_price")
  ) {
    const deviation = priceDeviation(unitPrice, asset.lastPrice)!;
    return fail(
      `${unitPrice} is ${Math.round(Math.abs(deviation) * 100)}% ${deviation > 0 ? "above" : "below"} the last known price of ${asset.lastPrice}. That looks like a typo; check it with the owner.`,
      ["unusual_price"],
    );
  }

  const candidate: Txn = {
    id: Number.MAX_SAFE_INTEGER,
    kind: input.kind,
    date: date.value,
    units: needsUnits ? (input.units ?? null) : null,
    amount,
    fees,
  };

  const twin = existing.find(
    (txn) =>
      txn.kind === candidate.kind &&
      txn.date === candidate.date &&
      (txn.units ?? null) === (candidate.units ?? null) &&
      Math.abs(txn.amount - candidate.amount) < 0.005,
  );
  if (twin && !confirmed.has("duplicate")) {
    return fail(
      `An identical ${candidate.kind} on ${candidate.date} for ${rs(candidate.amount)} already exists. Confirm it is a separate transaction.`,
      ["duplicate"],
    );
  }

  let before: Position;
  let after: Position;
  try {
    before = computePosition(asset.kind, asset.lastPrice, existing);
    after = computePosition(asset.kind, asset.lastPrice, [
      ...existing,
      candidate,
    ]);
  } catch (error) {
    return fail(
      error instanceof PortfolioError
        ? error.message
        : "That would break this holding's balance.",
    );
  }

  const realizedDelta = round(after.realized - before.realized);
  const warnings: string[] = [];
  if (amount > 0 && fees / amount > HIGH_FEE_RATIO) {
    warnings.push(
      `Fees are ${Math.round((fees / amount) * 100)}% of the trade value; check the figure.`,
    );
  }
  if (candidate.kind === "sell") {
    if (after.units === 0) warnings.push("This closes the position.");
    if (realizedDelta < 0)
      warnings.push(`This sale realizes a loss of ${rs(realizedDelta)}.`);
  }

  return {
    ok: true,
    candidate,
    unitPrice,
    before: summarize(before),
    after: summarize(after),
    realizedDelta,
    warnings,
  };
}
