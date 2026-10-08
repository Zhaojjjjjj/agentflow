import { Redis } from "@upstash/redis";

let client: Redis | null = null;
let warned = false;

/**
 * Upstash Redis client. Returns null when env vars are missing so every
 * caller can gracefully degrade (no locks / rate limits / cache).
 */
export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned) {
      warned = true;
      console.warn("[agentflow] Upstash Redis not configured — running without locks/rate-limit/cache.");
    }
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

/** Best-effort distributed lock for "one run at a time" semantics. */
export async function tryAcquireLock(key: string, ttlSec = 300): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // no redis -> allow
  try {
    const res = await redis.set(key, "1", { nx: true, ex: ttlSec });
    return res === "OK";
  } catch (e) {
    console.warn("[agentflow] redis lock failed, allowing:", e);
    return true;
  }
}

export async function releaseLock(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (e) {
    console.warn("[agentflow] redis unlock failed:", e);
  }
}

/** Simple fixed-window rate limiter. Returns true when the request is allowed. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const count = await redis.incr(`ratelimit:${key}`);
    if (count === 1) await redis.expire(`ratelimit:${key}`, windowSec);
    return count <= limit;
  } catch (e) {
    console.warn("[agentflow] rate limit check failed, allowing:", e);
    return true;
  }
}
