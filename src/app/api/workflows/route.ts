import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";
import { emptyDefinition } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  let q = sb
    .from("workflows")
    .select("id, name, description, version, is_published, schedule_enabled, schedule_cron, created_at, updated_at, owner_id")
    .order("updated_at", { ascending: false });
  if (me.role !== "admin") q = q.eq("owner_id", me.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // admin 视角带上创建者用户名
  let owners: Record<string, string> = {};
  if (me.role === "admin" && data) {
    const ids = [...new Set((data as { owner_id: string | null }[]).map((w) => w.owner_id).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: users } = await sb.from("users").select("id, username").in("id", ids);
      owners = Object.fromEntries(((users ?? []) as { id: string; username: string }[]).map((u) => [u.id, u.username]));
    }
  }
  return NextResponse.json({
    workflows: (data ?? []).map((w) => ({
      ...(w as Record<string, unknown>),
      owner_name: owners[(w as { owner_id: string | null }).owner_id ?? ""] ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "未命名工作流").slice(0, 120);
  const { data, error } = await sb
    .from("workflows")
    .insert({
      name,
      description: String(body.description || ""),
      definition: body.definition || emptyDefinition(),
      owner_id: me.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
