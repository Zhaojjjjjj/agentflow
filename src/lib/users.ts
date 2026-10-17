// Server-only user management (uses service-role Supabase + node:crypto hashing).

import { getSupabase } from "./supabase";
import { hashPassword } from "./password";
import { getAdminUsername } from "./auth";
import type { UserRole } from "./auth";

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  avatar_url: string | null;
  nickname: string | null;
  role: UserRole;
  created_at: string;
}

export type PublicUser = Omit<DbUser, "password_hash">;

function toPublic(u: DbUser): PublicUser {
  const { password_hash: _ph, ...rest } = u;
  return rest;
}

/** Seed the first admin from env (and adopt orphan workflows) when no users exist. */
export async function ensureSeeded(): Promise<void> {
  const sb = getSupabase();
  const { count, error } = await sb.from("users").select("id", { count: "exact", head: true });
  if (error) throw new Error(`users 表不可用，请先执行 supabase/migrations/002_users.sql: ${error.message}`);
  if ((count ?? 0) > 0) return;

  const username = getAdminUsername();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password) throw new Error("首次启动需要设置 ADMIN_PASSWORD 来创建管理员账号");
  const { error: insErr } = await sb
    .from("users")
    .insert({ username, password_hash: await hashPassword(password), role: "admin" });
  if (insErr) throw new Error(`创建管理员账号失败: ${insErr.message}`);
}

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("users").select("*").eq("username", username).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DbUser | null) ?? null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DbUser | null) ?? null;
}

export async function listUsers(): Promise<PublicUser[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("users")
    .select("id, username, avatar_url, nickname, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicUser[];
}

export async function createUser(input: {
  username: string;
  password: string;
  role?: UserRole;
}): Promise<PublicUser> {
  const username = input.username.trim();
  if (!/^[a-zA-Z0-9_.\-@]{3,40}$/.test(username)) {
    throw new Error("用户名需为 3-40 位字母/数字/_.@-");
  }
  if (input.password.length < 6) throw new Error("密码至少 6 位");
  const role: UserRole = input.role === "admin" ? "admin" : "user";
  const sb = getSupabase();
  const { data, error } = await sb
    .from("users")
    .insert({ username, password_hash: await hashPassword(input.password), role })
    .select("id, username, avatar_url, nickname, role, created_at")
    .single();
  if (error) {
    if (error.message.includes("duplicate") || (error as { code?: string }).code === "23505") {
      throw new Error("用户名已存在");
    }
    throw new Error(error.message);
  }
  return data as PublicUser;
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  if (password.length < 6) throw new Error("密码至少 6 位");
  const sb = getSupabase();
  const { error } = await sb
    .from("users")
    .update({ password_hash: await hashPassword(password) })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setUserAvatar(id: string, avatarUrl: string | null): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("users").update({ avatar_url: avatarUrl }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setUserNickname(id: string, nickname: string | null): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("users").update({ nickname }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteUser(id: string): Promise<void> {
  const sb = getSupabase();
  const target = await getUserById(id);
  if (!target) throw new Error("用户不存在");
  if (target.role === "admin") {
    const { count } = await sb.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) throw new Error("不能删除最后一个管理员");
  }
  const { error } = await sb.from("users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export { toPublic };
