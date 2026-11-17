import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "~/env";

/**
 * Small envelope for the BYOK key: AES-256-GCM with a key derived from the
 * app's auth secret. Only the server ever decrypts it, and the browser only
 * ever sees a masked hint.
 */
function encryptionKey() {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required to store an API key.");
  }
  return createHash("sha256").update(`finbro-assistant:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivText, tagText, dataText] = payload.split(":");
  if (version !== "v1" || !ivText || !tagText || !dataText) {
    throw new Error("Unrecognised secret format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataText, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** "sk-ant-api03-…f3a2" for display. Never the whole key. */
export function maskSecret(plain: string): string {
  const tail = plain.slice(-4);
  return `••••••${tail}`;
}
