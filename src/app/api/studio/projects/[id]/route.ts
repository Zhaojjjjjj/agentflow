import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/studio/projects/[id] — 作品详情（含集数/人物数/伏笔数） */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data: project, error } = await sb.from("story_projects").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: "作品不存在" }, { status: 404 });
  const [{ count: episodeCount }, { count: characterCount }, { count: threadCount }] = await Promise.all([
    sb.from("episodes").select("id", { count: "exact", head: true }).eq("project_id", id),
    sb.from("story_characters").select("id", { count: "exact", head: true }).eq("project_id", id),
    sb.from("plot_threads").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "open"),
  ]);
  return NextResponse.json({
    project,
    stats: {
      episodes: episodeCount ?? 0,
      characters: characterCount ?? 0,
      open_threads: threadCount ?? 0,
    },
  });
}

/** PATCH /api/studio/projects/[id] — 更新作品设定 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["title", "genre", "premise", "worldview", "style_notes", "status"] as const) {
    if (body[k] !== undefined) patch[k] = String(body[k]);
  }
  if (body.episode_target_words !== undefined) {
    patch.episode_target_words = Math.min(Math.max(500, Number(body.episode_target_words) || 2500), 20000);
  }
  const sb = getSupabase();
  const { error } = await sb.from("story_projects").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/studio/projects/[id] — 删除作品（含全部集/人物/伏笔/记忆） */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { error } = await sb.from("story_projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
