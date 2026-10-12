// AES-256-GCM secret encryption for DB-stored credentials.
// Key comes from APP_ENCRYPTION_KEY (64 hex chars). Generate with:
//   openssl rand -hex 32

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "APP_ENCRYPTION_KEY is missing or invalid. Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt UTF-8 plaintext -> base64(iv || authTag || ciphertext). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt a payload produced by encryptSecret. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error("Invalid encrypted payload");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Display mask — reveals only the last 4 chars. Never returns the full secret. */
export function maskSecret(secret: string): string {
  if (!secret) return "****";
  return `****${secret.slice(-4)}`;
}

/** Non-throwing check for the settings UI banner. */
export function isEncryptionConfigured(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env.APP_ENCRYPTION_KEY || "");
}
