import { eq } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { assistantSettings } from "~/server/db/schema";

import { decryptSecret, encryptSecret, maskSecret } from "./crypto";

export type ModelOption = {
  id: string;
  label: string;
  note: string;
};

/** Claude models the app offers. New ids are one line here. */
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    note: "Fastest and cheapest",
  },
  {
    id: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    note: "Balanced — the default",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    note: "Newest Sonnet",
  },
  {
    id: "claude-opus-4-5",
    label: "Claude Opus 4.5",
    note: "Most capable, slowest",
  },
];

export const DEFAULT_MODEL = "claude-sonnet-4-5";
export const MODEL_IDS = MODEL_OPTIONS.map((option) => option.id);

export function modelLabel(id: string): string {
  return MODEL_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export function modelNote(id: string): string {
  return MODEL_OPTIONS.find((option) => option.id === id)?.note ?? "";
}

type Row = typeof assistantSettings.$inferSelect;

async function rowFor(userId: string): Promise<Row | null> {
  const [row] = await db
    .select()
    .from(assistantSettings)
    .where(eq(assistantSettings.userId, userId))
    .limit(1);
  return row ?? null;
}

export type AssistantPreferences = {
  model: string;
  /** The user's own key is stored and decryptable. */
  hasUserKey: boolean;
  keyHint: string | null;
  /** The server has ANTHROPIC_API_KEY to fall back on. */
  hasServerKey: boolean;
  /** True when a request can actually be made. */
  ready: boolean;
};

export async function getPreferences(
  userId: string,
): Promise<AssistantPreferences> {
  const row = await rowFor(userId);
  let keyHint: string | null = null;
  if (row?.apiKeyEncrypted) {
    try {
      keyHint = maskSecret(decryptSecret(row.apiKeyEncrypted));
    } catch {
      keyHint = null;
    }
  }
  const model = MODEL_IDS.includes(row?.model ?? "")
    ? row!.model
    : DEFAULT_MODEL;
  const hasServerKey = Boolean(env.ANTHROPIC_API_KEY);
  return {
    model,
    hasUserKey: Boolean(keyHint),
    keyHint,
    hasServerKey,
    ready: Boolean(keyHint) || hasServerKey,
  };
}

export type ResolvedKey = { apiKey: string; source: "user" | "server" };

/** The user's own key wins; the server key is the fallback. */
export async function resolveApiKey(
  userId: string,
): Promise<ResolvedKey | null> {
  const row = await rowFor(userId);
  if (row?.apiKeyEncrypted) {
    try {
      return { apiKey: decryptSecret(row.apiKeyEncrypted), source: "user" };
    } catch {
      // A corrupted secret falls back to the server key rather than failing.
    }
  }
  if (env.ANTHROPIC_API_KEY) {
    return { apiKey: env.ANTHROPIC_API_KEY, source: "server" };
  }
  return null;
}

export async function resolveModel(userId: string): Promise<string> {
  const row = await rowFor(userId);
  if (row && MODEL_IDS.includes(row.model)) return row.model;
  if (env.ANTHROPIC_MODEL) return env.ANTHROPIC_MODEL;
  return DEFAULT_MODEL;
}

export async function savePreferences(
  userId: string,
  input: { model?: string; apiKey?: string },
): Promise<void> {
  const existing = await rowFor(userId);
  const model =
    input.model ??
    (existing && MODEL_IDS.includes(existing.model)
      ? existing.model
      : (env.ANTHROPIC_MODEL ?? DEFAULT_MODEL));
  const apiKeyEncrypted = input.apiKey
    ? encryptSecret(input.apiKey)
    : (existing?.apiKeyEncrypted ?? null);

  await db
    .insert(assistantSettings)
    .values({ userId, model, apiKeyEncrypted })
    .onConflictDoUpdate({
      target: assistantSettings.userId,
      set: { model, apiKeyEncrypted, updatedAt: new Date() },
    });
}

export async function clearUserKey(userId: string): Promise<void> {
  const existing = await rowFor(userId);
  if (!existing) return;
  await db
    .update(assistantSettings)
    .set({ apiKeyEncrypted: null, updatedAt: new Date() })
    .where(eq(assistantSettings.userId, userId));
}
