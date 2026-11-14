import { fail, type PriceResult } from "./types";

const DATA_BASE =
  "https://raw.githubusercontent.com/saadsalmankhan/pakistan-mutual-funds-data/main";
const TIMEOUT_MS = 10_000;
const LIST_TTL_MS = 12 * 60 * 60 * 1000;

export type FundInfo = {
  fundId: string;
  name: string;
  amc: string;
  category: string;
  shariah: boolean;
  /** Two-decimal NAV from the snapshot. */
  nav: number;
};

export function isMoneyMarketCategory(category: string) {
  return /money market/i.test(category);
}

let listCache: { at: number; funds: FundInfo[] } | null = null;

type RawFund = {
  fundId?: unknown;
  name?: unknown;
  amc?: unknown;
  category?: unknown;
  shariah?: unknown;
  nav?: unknown;
};

export function parseFundList(payload: unknown): FundInfo[] {
  const raw = (payload as { funds?: unknown } | null)?.funds;
  if (!Array.isArray(raw)) return [];
  const funds: FundInfo[] = [];
  for (const item of raw as (RawFund | null)[]) {
    if (!item || typeof item !== "object") continue;
    if (
      typeof item.fundId !== "string" ||
      typeof item.name !== "string" ||
      typeof item.nav !== "number"
    ) {
      continue;
    }
    funds.push({
      fundId: item.fundId,
      name: item.name,
      amc: typeof item.amc === "string" ? item.amc : "",
      category: typeof item.category === "string" ? item.category : "",
      shariah: item.shariah === true,
      nav: item.nav,
    });
  }
  return funds;
}

/** The whole fund list, cached in memory for 12 hours. Never throws. */
export async function listFunds(): Promise<FundInfo[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) {
    return listCache.funds;
  }
  try {
    const res = await fetch(`${DATA_BASE}/funds.json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) {
      const funds = parseFundList(await res.json());
      if (funds.length > 0) {
        listCache = { at: Date.now(), funds };
        return funds;
      }
    }
  } catch {
    // fall back to a stale copy below
  }
  return listCache?.funds ?? [];
}

/** Parses the last non-empty line of a NAV history file. */
export function parseLastNav(ndjson: string): PriceResult {
  const lines = ndjson.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const row = JSON.parse(lines[i]!) as { date?: unknown; nav?: unknown };
      if (
        typeof row.nav === "number" &&
        row.nav > 0 &&
        typeof row.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.date)
      ) {
        return { ok: true, price: row.nav, asOf: row.date };
      }
    } catch {
      // a half-written last line: try the one before it
    }
  }
  return fail("No NAV found in the fund history.");
}

/** Latest 4-decimal NAV for a fund, falling back to the snapshot NAV. Never throws. */
export async function fetchFundNav(fundId: string): Promise<PriceResult> {
  if (!/^\d{1,10}$/.test(fundId)) return fail("That is not a valid fund id.");

  try {
    const res = await fetch(`${DATA_BASE}/history/${fundId}.ndjson`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) {
      const parsed = parseLastNav(await res.text());
      if (parsed.ok) return parsed;
    }
  } catch {
    // try the snapshot
  }

  const fund = (await listFunds()).find((f) => f.fundId === fundId);
  if (fund && fund.nav > 0) {
    return { ok: true, price: fund.nav, asOf: new Date().toISOString().slice(0, 10) };
  }
  return fail("Could not load the NAV for this fund.");
}

export async function searchFunds(
  query: string,
  moneyMarket: boolean,
  limit = 20,
): Promise<FundInfo[]> {
  const needle = query.trim().toLowerCase();
  const funds = (await listFunds()).filter(
    (f) =>
      isMoneyMarketCategory(f.category) === moneyMarket &&
      // Fixed-rate plans and pension schemes are not what these pages are for.
      !/^VPS-|fixed rate/i.test(f.category),
  );
  const matches = needle
    ? funds.filter(
        (f) =>
          f.name.toLowerCase().includes(needle) ||
          f.amc.toLowerCase().includes(needle),
      )
    : funds;
  return matches
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}
