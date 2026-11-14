/**
 * Creates the owner account. Sign-up is disabled everywhere else, so this is
 * the only way to add a user.
 *
 *   pnpm user:create
 *
 * Running it again with the same email changes nothing.
 */
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";

import { eq } from "drizzle-orm";

async function main() {
  // The env flag must be set before the auth config is loaded.
  process.env.AUTH_ALLOW_SIGNUP = "true";
  const { auth } = await import("~/server/better-auth/config");
  const { db } = await import("~/server/db");
  const { user } = await import("~/server/db/schema");

  // Reading through the line iterator works for a terminal and for piped input.
  const rl = createInterface({ input: stdin });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (label: string) => {
    stdout.write(label);
    const { value } = await lines.next();
    return typeof value === "string" ? value : "";
  };
  const name = (await ask("Name: ")).trim();
  const email = (await ask("Email: ")).trim().toLowerCase();
  const password = await ask("Password (10+ characters): ");
  rl.close();

  if (!name || !email || password.length < 10) {
    console.error("Name, email and a password of 10+ characters are required.");
    process.exit(1);
  }

  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (existing) {
    console.log(`An account for ${email} already exists. Nothing changed.`);
    process.exit(0);
  }

  await auth.api.signUpEmail({ body: { name, email, password } });
  console.log(`Created account for ${email}. You can now sign in.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Could not create the account:", error);
  process.exit(1);
});
