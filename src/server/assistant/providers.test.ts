import { describe, expect, it } from "vitest";

import {
  isProviderId,
  modelFor,
  parseProviderOrder,
  listProviders,
} from "./providers";

describe("provider order", () => {
  it("keeps the configured order", () => {
    expect(parseProviderOrder("gemini,anthropic")).toEqual(["gemini", "anthropic"]);
    expect(parseProviderOrder("anthropic,gemini")).toEqual(["anthropic", "gemini"]);
  });

  it("trims, lowercases, drops unknown names and repeats", () => {
    expect(parseProviderOrder(" Anthropic , GEMINI , anthropic , openai ")).toEqual([
      "anthropic",
      "gemini",
    ]);
  });

  it("defaults to Claude first, then Gemini", () => {
    expect(parseProviderOrder(undefined)).toEqual(["anthropic", "gemini"]);
    expect(parseProviderOrder("")).toEqual([]);
  });

  it("recognises only the supported ids", () => {
    expect(isProviderId("gemini")).toBe(true);
    expect(isProviderId("anthropic")).toBe(true);
    expect(isProviderId("openai")).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
  });
});

describe("provider models", () => {
  it("has a default model for each provider", () => {
    expect(modelFor("gemini")).toContain("gemini");
    expect(modelFor("anthropic")).toContain("claude");
  });

  it("lists both providers with a configured flag", () => {
    const list = listProviders();
    expect(list.map((item) => item.id).sort()).toEqual(["anthropic", "gemini"]);
    for (const item of list) {
      expect(typeof item.configured).toBe("boolean");
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
