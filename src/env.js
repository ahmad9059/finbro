import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production" ? z.string() : z.string().optional(),
    BETTER_AUTH_URL: z.string().url().optional(),
    AUTH_ALLOW_SIGNUP: z.enum(["true", "false"]).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    DATABASE_URL: z.string().url(),
    /** Google AI Studio key for the assistant. Optional: the app builds without it. */
    GEMINI_API_KEY: z.string().min(10).optional(),
    /** Model name; the default is a Flash model that supports tools and search. */
    GEMINI_MODEL: z.string().min(3).optional(),
    /** Anthropic key, the fallback (or preferred) provider. */
    ANTHROPIC_API_KEY: z.string().min(10).optional(),
    ANTHROPIC_MODEL: z.string().min(3).optional(),
    /** Order to try, e.g. "anthropic,gemini". First configured one answers. */
    ASSISTANT_PROVIDERS: z.string().optional(),
    /** Development only: stream scripted replies instead of calling Gemini. */
    ASSISTANT_MOCK: z.enum(["true", "false"]).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_ALLOW_SIGNUP: process.env.AUTH_ALLOW_SIGNUP,
    CRON_SECRET: process.env.CRON_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    ASSISTANT_PROVIDERS: process.env.ASSISTANT_PROVIDERS,
    ASSISTANT_MOCK: process.env.ASSISTANT_MOCK,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
