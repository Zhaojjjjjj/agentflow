import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";

export const dynamic = "force-dynamic";

/** GET /api/studio/projects — 我的作品列表（admin 看全部） */
export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  let q = sb
    .from("story_projects")
    .select("id, title, kind, genre, status, episode_target_words, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (me.role !== "admin") q = q.eq("owner_id", me.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 附每部作品的集数
  const ids = (data ?? []).map((p) => (p as { id: string }).id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: eps } = await sb.from("episodes").select("project_id").in("project_id", ids);
    counts = {};
    for (const e of (eps ?? []) as { project_id: string }[]) {
      counts[e.project_id] = (counts[e.project_id] ?? 0) + 1;
    }
  }
  const projects = (data ?? []).map((p) => ({
    ...(p as object),
    episode_count: counts[(p as { id: string }).id] ?? 0,
  }));
  return NextResponse.json({ projects });
}

/** POST /api/studio/projects — 新建作品 */
export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const kind = body.kind === "drama" ? "drama" : "novel";
  if (!title) return NextResponse.json({ error: "请填写作品标题" }, { status: 400 });
  if (title.length > 60) return NextResponse.json({ error: "标题太长（最多 60 字）" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb
    .from("story_projects")
    .insert({
      owner_id: me.id,
      title,
      kind,
      genre: String(body.genre ?? "").slice(0, 40),
      premise: String(body.premise ?? "").slice(0, 5000),
      worldview: String(body.worldview ?? "").slice(0, 8000),
      style_notes: String(body.style_notes ?? "").slice(0, 3000),
      episode_target_words: Math.min(Math.max(500, Number(body.episode_target_words) || 2500), 20000),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}
