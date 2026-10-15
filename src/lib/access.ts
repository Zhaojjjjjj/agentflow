// Server-only access control helpers for API routes.
// (Middleware handles the coarse gate; these enforce per-user/per-role rules.)

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionClaims, getAdminUsername, type UserRole } from "./auth";
import { getUserByUsername } from "./users";
import { getSupabase } from "./supabase";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

/** Resolve the request's user from the session cookie (handles legacy admin tokens). */
export async function authUser(req: NextRequest): Promise<AuthUser | null> {
  const claims = await getSessionClaims(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  if (claims.id !== "admin") return { id: claims.id, username: claims.username, role: claims.role };
  // Legacy single-admin token: resolve the seeded admin's real id.
  const admin = await getUserByUsername(getAdminUsername()).catch(() => null);
  if (!admin) return null;
  return { id: admin.id, username: admin.username, role: admin.role };
}

/** Same, but only for admins. */
export async function authAdmin(req: NextRequest): Promise<AuthUser | null> {
  const u = await authUser(req);
  return u && u.role === "admin" ? u : null;
}

export function unauthorized() {
  return NextResponse.json({ error: "未登录" }, { status: 401 });
}

export function forbidden(msg = "需要管理员权限") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

/** Whether the user may access the story project (admin bypasses ownership). */
export async function canAccessProject(projectId: string, me: AuthUser): Promise<boolean> {
  if (!projectId) return false;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("story_projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return false;
  if (me.role === "admin") return true;
  return (data as { owner_id: string }).owner_id === me.id;
}
