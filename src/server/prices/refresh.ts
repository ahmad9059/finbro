import { and, eq, isNotNull, or, type SQL } from "drizzle-orm";

import type { AssetKind } from "~/lib/portfolio";
import type { DbOrTx } from "~/server/api/helpers";
import { asset } from "~/server/db/schema";

import { rememberCompany } from "./companies";
import { fetchFundNav } from "./funds";
import { fetchStockPrice } from "./psx";
import type { PriceResult } from "./types";

const SKIP_IF_CHECKED_WITHIN_MS = 10 * 60 * 1000;
const PSX_PAUSE_MS = 250;
const FUND_CONCURRENCY = 5;

export type RefreshOutcome = {
  updated: number;
  skipped: number;
  failed: { id: number; name: string; reason: string }[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches fresh prices for every asset that has a PSX symbol or fund id.
 * A failure leaves that asset's stored price untouched.
 *
 * @param force Ignore the "checked in the last 10 minutes" rule (daily job).
 */
export async function refreshPrices(
  database: DbOrTx,
  userId: string,
  options: { kind?: AssetKind; force?: boolean } = {},
): Promise<RefreshOutcome> {
  const filters: (SQL | undefined)[] = [
    eq(asset.userId, userId),
    or(isNotNull(asset.symbol), isNotNull(asset.fundId)),
    options.kind ? eq(asset.kind, options.kind) : undefined,
  ];
  const rows = await database
    .select()
    .from(asset)
    .where(and(...filters));

  const outcome: RefreshOutcome = { updated: 0, skipped: 0, failed: [] };
  const now = Date.now();

  const due = rows.filter((row) => {
    const fresh =
      !options.force &&
      row.priceCheckedAt !== null &&
      now - row.priceCheckedAt.getTime() < SKIP_IF_CHECKED_WITHIN_MS;
    if (fresh) outcome.skipped += 1;
    return !fresh;
  });

  async function apply(row: (typeof rows)[number], result: PriceResult) {
    if (!result.ok) {
      outcome.failed.push({ id: row.id, name: row.name, reason: result.reason });
      return;
    }
    await database
      .update(asset)
      .set({
        lastPrice: result.price,
        priceAsOf: result.asOf,
        priceSource: "auto",
        priceCheckedAt: new Date(),
      })
      .where(and(eq(asset.id, row.id), eq(asset.userId, userId)));
    outcome.updated += 1;
  }

  // Stocks go one at a time with a pause, to be polite to PSX.
  const stocks = due.filter((row) => row.symbol);
  for (const [index, row] of stocks.entries()) {
    if (index > 0) await sleep(PSX_PAUSE_MS);
    const result = await fetchStockPrice(row.symbol!);
    if (result.ok) await rememberCompany(row.symbol!, result);
    await apply(row, result);
  }

  const funds = due.filter((row) => !row.symbol && row.fundId);
  for (let i = 0; i < funds.length; i += FUND_CONCURRENCY) {
    await Promise.all(
      funds.slice(i, i + FUND_CONCURRENCY).map(async (row) =>
        apply(row, await fetchFundNav(row.fundId!)),
      ),
    );
  }

  return outcome;
}
