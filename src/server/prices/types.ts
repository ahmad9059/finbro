export type PriceQuote = {
  price: number;
  /** The date the price is valid for, "YYYY-MM-DD". */
  asOf: string;
  name?: string;
  category?: string;
};

export type PriceFailure = { ok: false; reason: string };
export type PriceResult = ({ ok: true } & PriceQuote) | PriceFailure;

export const fail = (reason: string): PriceFailure => ({ ok: false, reason });
