const MINUS = "\u2212";

type MoneyOptions = {
  /** Number of decimal places. Defaults to 0. */
  decimals?: number;
  /** Prefix positive values with "+". */
  signed?: boolean;
};

function sign(value: number, signed: boolean) {
  if (value < 0) return MINUS;
  return signed && value > 0 ? "+" : "";
}

/** 1284500 → "Rs 1,284,500" */
export function formatPKR(value: number, options: MoneyOptions = {}) {
  const { decimals = 0, signed = false } = options;
  const body = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign(value, signed)}Rs ${body}`;
}

/** 0.0704 → "+7.0%". Takes a ratio, not a percentage. */
export function formatPercent(ratio: number, options: MoneyOptions = {}) {
  const { decimals = 1, signed = true } = options;
  const body = Math.abs(ratio * 100).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign(ratio, signed)}${body}%`;
}

/** Shares and fund units: up to 4 decimals, trailing zeros dropped. */
export function formatUnits(value: number, maxDecimals = 4) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * "2026-11-14" → "14 Nov 2026". Parses the string directly so the result never
 * shifts with the viewer's timezone.
 */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
