import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import {
  DEFAULT_MODEL,
  MODEL_IDS,
  MODEL_OPTIONS,
  modelLabel,
  modelNote,
} from "./settings";

describe("assistant models", () => {
  it("offers Claude models only, with a default that is listed", () => {
    expect(MODEL_IDS.length).toBeGreaterThanOrEqual(3);
    expect(MODEL_IDS).toContain(DEFAULT_MODEL);
    for (const id of MODEL_IDS) {
      expect(id.startsWith("claude-")).toBe(true);
    }
  });

  it("labels every model", () => {
    for (const option of MODEL_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(3);
      expect(option.note.length).toBeGreaterThan(3);
      expect(modelLabel(option.id)).toBe(option.label);
      expect(modelNote(option.id)).toBe(option.note);
    }
  });

  it("falls back to the id for unknown models", () => {
    expect(modelLabel("claude-future")).toBe("claude-future");
    expect(modelNote("claude-future")).toBe("");
  });
});

describe("API key storage", () => {
  const key = "sk-ant-api03-test-key-for-the-roundtrip-1234";

  it("round-trips through AES-GCM", () => {
    const stored = encryptSecret(key);
    expect(stored).not.toContain(key);
    expect(stored.startsWith("v1:")).toBe(true);
    expect(decryptSecret(stored)).toBe(key);
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret(key)).not.toBe(encryptSecret(key));
  });

  it("rejects tampered ciphertext", () => {
    const stored = encryptSecret(key);
    const parts = stored.split(":");
    const data = parts[3]!;
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      `${data.slice(0, -2)}AA`,
    ].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("never shows more than the last four characters", () => {
    const masked = maskSecret(key);
    expect(masked).toBe("••••••1234");
    expect(masked).not.toContain("sk-ant");
  });
});
