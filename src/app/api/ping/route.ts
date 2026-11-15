import { sql } from "drizzle-orm";

import { db } from "~/server/db";

export const dynamic = "force-dynamic";

/**
 * Keeps the database awake and the pool warm.
 *
 * Neon suspends idle compute, and the first query after a suspension costs
 * 1–2 s. A four-minute ping from any free scheduler removes that cost from the
 * first page view. No auth: it reveals nothing and runs a single `select 1`.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, ms: Date.now() - started });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
