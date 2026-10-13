// Server-only password hashing (node:crypto scrypt). Do NOT import from edge middleware.

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
}

/** Hash a password for storage. Format: scrypt:<saltHex>:<keyHex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

/** Constant-time password verification. Never throws. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [algo, saltHex, keyHex] = hash.split(":");
    if (algo !== "scrypt" || !saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, "hex");
    const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
