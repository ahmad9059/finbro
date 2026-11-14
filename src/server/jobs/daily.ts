import { db } from "~/server/db";
import { user } from "~/server/db/schema";
import { writeSnapshot } from "~/server/api/routers/overview";
import { refreshPrices } from "~/server/prices/refresh";

export type DailyJobResult = {
  date: string;
  users: number;
  prices: { updated: number; failed: number; skipped: number };
  snapshots: number;
  errors: string[];
};

/**
 * Refreshes prices and writes today's snapshot for every user. Safe to run
 * twice: prices are overwritten and snapshot rows are upserted.
 */
export async function runDailyJob(): Promise<DailyJobResult> {
  const users = await db.select({ id: user.id }).from(user);
  const result: DailyJobResult = {
    date: new Date().toISOString(),
    users: users.length,
    prices: { updated: 0, failed: 0, skipped: 0 },
    snapshots: 0,
    errors: [],
  };

  for (const row of users) {
    try {
      const outcome = await refreshPrices(db, row.id, { force: true });
      result.prices.updated += outcome.updated;
      result.prices.failed += outcome.failed.length;
      result.prices.skipped += outcome.skipped;
      for (const failure of outcome.failed) {
        result.errors.push(`${failure.name}: ${failure.reason}`);
      }
      await writeSnapshot(db, row.id);
      result.snapshots += 1;
    } catch (error) {
      result.errors.push(
        `Snapshot for ${row.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return result;
}
