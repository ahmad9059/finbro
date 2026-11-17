import { isIsoDate } from "~/lib/dates";

/**
 * Pure checks shared by the assistant's write tools. No database, no clock:
 * "today" is always passed in, so every rule can be unit-tested.
 */

export const EARLIEST_DATE = "2000-01-01";

/** A price this far from the last known price is probably a typo (0.4 = 40%). */
export const UNUSUAL_PRICE_RATIO = 0.4;

/** Fees above this share of a trade's value are flagged. */
export const HIGH_FEE_RATIO = 0.05;

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Check<T> => ({ ok: true, value });
const fail = <T = never>(error: string): Check<T> => ({ ok: false, error });

/** The text, or null when it is missing or blank. */
export const textOrNull = (value: string | null | undefined): string | null =>
  value !== null && value !== undefined && value.trim() !== "" ? value : null;

export const round = (value: number, places = 2) => {
  const factor = 10 ** places;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
};

/** A real calendar date, not before 2000 and (by default) not after today. */
export function checkDate(
  input: string | undefined,
  today: string,
  options: { allowFuture?: boolean } = {},
): Check<string> {
  const value = input ?? today;
  if (!isIsoDate(value)) {
    return fail(`"${value}" is not a real calendar date. Use YYYY-MM-DD.`);
  }
  if (value < EARLIEST_DATE) {
    return fail(`${value} is before ${EARLIEST_DATE}; check the year.`);
  }
  if (!options.allowFuture && value > today) {
    return fail(
      `${value} is in the future (today is ${today}). Record it when it happens.`,
    );
  }
  return ok(value);
}

/**
 * Settles units, price and amount into one consistent pair. Gives the broker's
 * amount precedence when it agrees with units × price to within rounding.
 */
export function reconcileAmount(input: {
  units?: number;
  price?: number;
  amount?: number;
}): Check<{ amount: number; unitPrice: number | null }> {
  const { units, price, amount } = input;

  if (units && price) {
    const computed = round(units * price, 2);
    if (amount !== undefined) {
      const slack = Math.max(1, computed * 0.005);
      if (Math.abs(computed - amount) > slack) {
        return fail(
          `Units × price is Rs ${computed.toLocaleString("en-US")} but the amount is Rs ${amount.toLocaleString("en-US")}. Ask which figure is right.`,
        );
      }
      return ok({ amount: round(amount, 2), unitPrice: price });
    }
    return ok({ amount: computed, unitPrice: price });
  }
  if (units && amount !== undefined) {
    return ok({
      amount: round(amount, 2),
      unitPrice: round(amount / units, 4),
    });
  }
  if (amount !== undefined) {
    return ok({ amount: round(amount, 2), unitPrice: price ?? null });
  }
  return fail("An amount, or units and a price, is required.");
}

/** Signed distance of a price from a reference, as a ratio (0.1 = 10% above). */
export function priceDeviation(
  price: number,
  reference: number | null,
): number | null {
  if (reference === null || !(reference > 0)) return null;
  return (price - reference) / reference;
}

export function isUnusualPrice(
  price: number,
  reference: number | null,
): boolean {
  const deviation = priceDeviation(price, reference);
  return deviation !== null && Math.abs(deviation) > UNUSUAL_PRICE_RATIO;
}

type Named = { id: number; name: string; symbol?: string | null };

/**
 * Picks exactly one row for a user's wording, or refuses and lists candidates.
 * Exact symbol wins, then exact name, then a single partial match. Two partial
 * matches are never resolved by guessing.
 */
export function pickMatch<T extends Named>(
  rows: readonly T[],
  query: string,
  noun = "holding",
): Check<T> {
  const needle = query.trim().toLowerCase();
  if (rows.length === 0) return fail(`No ${noun} matches "${query}".`);

  const bySymbol = rows.filter((row) => row.symbol?.toLowerCase() === needle);
  if (bySymbol.length === 1) return ok(bySymbol[0]!);

  const byName = rows.filter((row) => row.name.toLowerCase() === needle);
  if (byName.length === 1) return ok(byName[0]!);

  if (rows.length === 1) return ok(rows[0]!);

  const options = rows
    .slice(0, 5)
    .map(
      (row) =>
        `${row.symbol ? `${row.symbol} ` : ""}${row.name} (id ${row.id})`,
    )
    .join("; ");
  return fail(
    `"${query}" matches more than one ${noun}: ${options}. Ask which one.`,
  );
}
