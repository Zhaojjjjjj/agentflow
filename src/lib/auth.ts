// Console auth: multi-user login with a signed JWT session cookie.
// - Users live in the `users` table (see supabase/migrations/002_users.sql);
//   the first admin is seeded from ADMIN_USERNAME/ADMIN_PASSWORD on first login.
// - Signing key: AUTH_SECRET, falling back to APP_ENCRYPTION_KEY.
// - Cookie: httpOnly, SameSite=Lax, Secure in production, 7-day expiry.
// - Edge-runtime safe (jose only, no node:crypto).

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "agentflow_session";
export const SESSION_MAX_AGE = 7 * 24 * 3600; // 7 days

export type UserRole = "admin" | "user";

export interface SessionClaims {
  id: string;
  username: string;
  role: UserRole;
}

function getJwtSecret(): Uint8Array | null {
  const raw = process.env.AUTH_SECRET || process.env.APP_ENCRYPTION_KEY || "";
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

/** True when a signing key is available (AUTH_SECRET or APP_ENCRYPTION_KEY). */
export function isJwtConfigured(): boolean {
  return getJwtSecret() !== null;
}

/** True when the admin password is set — i.e. login is usable at all. */
export function isLoginConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** Admin username, defaulting to "admin01" when ADMIN_USERNAME is unset. */
export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || "admin01";
}

export interface SessionCookieOptions {
  secure: boolean;
}

/** Issue a fresh signed session token for a user. Throws when no signing key is configured. */
export async function createSession(user: { id: string; username: string; role: UserRole }): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error(
      "No JWT signing key configured. Set AUTH_SECRET (or APP_ENCRYPTION_KEY) to enable console login."
    );
  }
  return await new SignJWT({ sub: user.id, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

/**
 * Verify a session token and decode claims. Never throws.
 * Legacy single-admin tokens ({ sub: "admin" }) are mapped to the admin role so
 * existing sessions keep working until re-login.
 */
export async function getSessionClaims(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const role = payload.role === "user" ? "user" : payload.role === "admin" ? "admin" : null;
    if (role && typeof payload.sub === "string" && payload.sub) {
      return { id: payload.sub, username: String(payload.username || ""), role };
    }
    if (payload.sub === "admin") {
      return { id: "admin", username: getAdminUsername(), role: "admin" };
    }
    return null;
  } catch {
    return null;
  }
}

/** Verify a session token. Returns false for missing/invalid/expired tokens — never throws. */
export async function verifySession(token: string | undefined | null): Promise<boolean> {
  return (await getSessionClaims(token)) !== null;
}

/** Attributes for setting the session cookie. */
export function sessionCookieAttrs({ secure }: SessionCookieOptions) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/** Attributes for clearing the session cookie. */
export function clearCookieAttrs({ secure }: SessionCookieOptions) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

/** Whether the current request context is production (=> Secure cookies). */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
