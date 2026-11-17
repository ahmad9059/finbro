import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { env } from "~/env";

export type ProviderId = "gemini" | "anthropic";

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  model: string;
  configured: boolean;
};

const DEFAULTS: Record<ProviderId, string> = {
  gemini: "gemini-3.5-flash",
  anthropic: "claude-sonnet-4-5",
};

const LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
};

export function isProviderId(value: unknown): value is ProviderId {
  return value === "gemini" || value === "anthropic";
}

/** Parses "anthropic, gemini" into known ids, keeping order and dropping repeats. */
export function parseProviderOrder(raw: string | undefined): ProviderId[] {
  const seen = new Set<ProviderId>();
  for (const part of (raw ?? "anthropic,gemini").split(",")) {
    const id = part.trim().toLowerCase();
    if (isProviderId(id)) seen.add(id);
  }
  return [...seen];
}

export function providerOrder(): ProviderId[] {
  return parseProviderOrder(env.ASSISTANT_PROVIDERS);
}

export function modelFor(id: ProviderId): string {
  if (id === "gemini") return env.GEMINI_MODEL ?? DEFAULTS.gemini;
  return env.ANTHROPIC_MODEL ?? DEFAULTS.anthropic;
}

export function isConfigured(id: ProviderId): boolean {
  return id === "gemini" ? Boolean(env.GEMINI_API_KEY) : Boolean(env.ANTHROPIC_API_KEY);
}

/** Every provider, in the configured order, with whether its key is present. */
export function listProviders(): ProviderInfo[] {
  const order = providerOrder();
  const ids = [
    ...order,
    ...(["anthropic", "gemini"] as ProviderId[]).filter((id) => !order.includes(id)),
  ];
  return ids.map((id) => ({
    id,
    label: LABELS[id],
    model: modelFor(id),
    configured: isConfigured(id),
  }));
}

export type ProviderRuntime = {
  id: ProviderId;
  model: ReturnType<ReturnType<typeof createAnthropic>>;
  /** Gemini wants a low thinking budget; Claude is fine with its default. */
  providerOptions?: Record<string, unknown>;
  /** Provider-native search, so answers can cite the web without another key. */
  searchTool: Record<string, unknown>;
};

/** Builds the model and the provider's own web-search tool. */
export function createProvider(id: ProviderId): ProviderRuntime | null {
  if (id === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) return null;
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return {
      id,
      model: anthropic(modelFor(id)),
      searchTool: {
        web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
      },
    };
  }

  if (!env.GEMINI_API_KEY) return null;
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  return {
    id,
    model: google(modelFor(id)),
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
    searchTool: { google_search: google.tools.googleSearch({}) },
  };
}

/**
 * Providers to try, in order: the requested one first (so a retry stays where
 * it was), then the configured order. Providers without a key are skipped.
 */
export function providersToTry(preferred?: unknown): ProviderRuntime[] {
  const requested = isProviderId(preferred) ? preferred : null;
  const order = [
    ...(requested ? [requested] : []),
    ...providerOrder().filter((id) => id !== requested),
  ];
  return order
    .map((id) => createProvider(id))
    .filter((provider): provider is ProviderRuntime => provider !== null);
}
