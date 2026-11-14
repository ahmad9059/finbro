/** Clears Better Auth's sign-in counters. Handy after testing. */
import { sql } from "drizzle-orm";

import { db } from "~/server/db";

await db.execute(sql`delete from rate_limit`);
console.log("Rate-limit counters cleared.");
process.exit(0);
