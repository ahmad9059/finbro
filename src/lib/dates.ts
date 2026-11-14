/**
 * Business dates are plain "YYYY-MM-DD" strings in Pakistan time. Months are
 * "YYYY-MM". Nothing here depends on the server's or the viewer's timezone.
 */

export type Cycle = "monthly" | "yearly";

const PK_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date in Pakistan, e.g. "2026-11-14". */
export function todayPK(now: Date = new Date()): string {
  return PK_FORMAT.format(now);
}

/** The current month in Pakistan, e.g. "2026-11". */
export function currentMonthPK(now: Date = new Date()): string {
  return todayPK(now).slice(0, 7);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isIsoMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2026-11" + 1 → "2026-12"; "2026-12" + 1 → "2027-01". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** First day of the month and first day of the next (exclusive end). */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** "2026-11" → "November 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** "2026-11" → "Nov" */
export function formatMonthShort(month: string): string {
  const m = Number(month.slice(5));
  return (MONTH_NAMES[m - 1] ?? "").slice(0, 3);
}

/** Add whole days to a date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const parse = (value: string) => {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

/**
 * The next due date after `date`. `billingDay` is the day of the month the
 * subscription is anchored to, so a plan billed on the 31st goes
 * 31 Jan → 28 Feb → 31 Mar instead of drifting to the 28th.
 */
export function addCycle(
  date: string,
  cycle: Cycle,
  billingDay?: number,
): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const anchor = billingDay ?? d;
  const index = y * 12 + (m - 1) + (cycle === "monthly" ? 1 : 12);
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = Math.min(anchor, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}
