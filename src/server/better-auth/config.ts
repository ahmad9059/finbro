import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { env } from "~/env";
import { db } from "~/server/db";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    // Single-user app: sign-up is only open while scripts/create-user.ts runs.
    disableSignUp: env.AUTH_ALLOW_SIGNUP !== "true",
    minPasswordLength: 10,
  },
  rateLimit: {
    enabled: true,
    // Serverless instances do not share memory, so the counter lives in Postgres.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  // nextCookies must stay last.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
