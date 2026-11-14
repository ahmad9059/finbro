import * as cheerio from "cheerio";

import { todayPK } from "~/lib/dates";

import { fail, type PriceResult } from "./types";

const BASE = "https://dps.psx.com.pk";
const TIMEOUT_MS = 10_000;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function isValidSymbol(symbol: string) {
  return /^[A-Z0-9]{1,12}$/.test(symbol);
}

/** "Rs.1,315.87" → 1315.87 */
function parsePrice(text: string): number | null {
  const match = /\d[\d,]*(?:\.\d+)?/.exec(text);
  if (!match) return null;
  const value = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** "^ As of Fri, Nov 13, 2026 4:49 PM" → "2026-11-13" */
function parseAsOf(text: string): string | null {
  const match = /As of \w+, (\w{3})\w* (\d{1,2}), (\d{4})/i.exec(text);
  if (!match) return null;
  const month = MONTHS[match[1]!.toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[2]!.padStart(2, "0")}`;
}

/** Reads the quote block of a PSX company page. */
export function parseCompanyPage(html: string): PriceResult {
  const $ = cheerio.load(html);
  const close = $(".quote__close").first().text();
  const price = parsePrice(close);
  if (price === null) {
    return fail("PSX page did not contain a price. Its layout may have changed.");
  }
  const name = $(".quote__name").first().clone().children().remove().end().text().trim();
  const category = $(".quote__sector span").first().text().trim();

  // The company profile links to the company's own site. The markup is not
  // consistent (it usually sits under ADDRESS, sometimes under WEBSITE), so
  // take the first external link in the profile that is not social or PSX.
  const IGNORED_LINK =
    /facebook|twitter|x\.com|linkedin|youtube|instagram|secp\.gov|psx\.com|capitalstake|mailto:/i;
  let website: string | undefined;
  $("#profile a[href^='http'], .profile__item a[href^='http']").each((_, el) => {
    if (website) return;
    const href = $(el).attr("href");
    if (href && !IGNORED_LINK.test(href)) website = href;
  });

  return {
    ok: true,
    price,
    asOf: parseAsOf($(".quote__date").first().text()) ?? todayPK(),
    name: name || undefined,
    category: category || undefined,
    website: website === "" ? undefined : website,
  };
}

/** Intraday JSON: `{ status: 1, data: [[epochSeconds, price, volume], ...] }`, newest first. */
export function parseTimeseries(payload: unknown): PriceResult {
  const data = (payload as { status?: number; data?: unknown } | null)?.data;
  if (!Array.isArray(data) || data.length === 0) return fail("No price data.");
  const row = data[0] as unknown;
  if (!Array.isArray(row)) return fail("Unexpected price data.");
  const [epoch, price] = row as [unknown, unknown];
  if (typeof price !== "number" || !(price > 0)) return fail("Unexpected price data.");
  const asOf =
    typeof epoch === "number"
      ? todayPK(new Date(epoch * 1000))
      : todayPK();
  return { ok: true, price, asOf };
}

async function get(path: string, extra: Record<string, string> = {}) {
  return fetch(BASE + path, {
    headers: { ...HEADERS, ...extra },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

/**
 * A PSX company page takes about five seconds, so a successful quote is kept
 * for a few minutes. Typing a symbol letter by letter then costs one fetch,
 * and the refresh job does not re-fetch a symbol it just read.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; result: PriceResult }>();

/** Latest price for a PSX symbol, from cache when it is fresh. */
export async function fetchStockPrice(rawSymbol: string): Promise<PriceResult> {
  const symbol = normalizeSymbol(rawSymbol);
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;
  const result = await fetchFromPsx(symbol);
  if (result.ok) cache.set(symbol, { at: Date.now(), result });
  return result;
}

async function fetchFromPsx(rawSymbol: string): Promise<PriceResult> {
  const symbol = normalizeSymbol(rawSymbol);
  if (!isValidSymbol(symbol)) return fail("That is not a valid PSX symbol.");

  let reason = "PSX could not be reached.";

  try {
    const res = await get(`/company/${symbol}`);
    if (res.ok) {
      const parsed = parseCompanyPage(await res.text());
      if (parsed.ok) return parsed;
      reason = parsed.reason;
    } else if (res.status === 404 || res.status === 500) {
      reason = `PSX has no symbol called ${symbol}.`;
    } else {
      reason = `PSX answered with status ${res.status}.`;
    }
  } catch {
    reason = "PSX did not answer in time.";
  }

  // Unknown symbols are final; do not retry them on the other endpoint.
  if (reason.startsWith("PSX has no symbol")) return fail(reason);

  try {
    const res = await get(`/timeseries/int/${symbol}`, {
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE}/company/${symbol}`,
      Accept: "application/json",
    });
    if (res.ok) {
      const parsed = parseTimeseries(await res.json());
      if (parsed.ok) return parsed;
    }
  } catch {
    // fall through to the first failure reason
  }

  return fail(reason);
}
