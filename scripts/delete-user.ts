/**
 * Deletes an account and everything it owns.
 *
 *   pnpm user:delete someone@example.com
 *
 * The database cascades: holdings, transactions, expenses, subscriptions and
 * snapshots all go with it.
 */
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { user } from "~/server/db/schema";

const email = process.argv[2];
if (!email) {
  console.error("Usage: pnpm user:delete <email>");
  process.exit(1);
}

const deleted = await db
  .delete(user)
  .where(eq(user.email, email.trim().toLowerCase()))
  .returning({ id: user.id });

if (deleted.length === 0) {
  console.log(`No account for ${email}. Nothing changed.`);
} else {
  console.log(`Deleted ${email} and all of its data.`);
}
process.exit(0);
