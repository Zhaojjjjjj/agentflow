import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { STAGE_LABELS } from "@/lib/studio/jobs";

type Params = { params: Promise<{ id: string }> };

/** GET 项目下所有剧集的最新写作任务（剧集列表展示进度用） */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data: eps } = await sb.from("episodes").select("id").eq("project_id", id);
  const episodeIds = ((eps ?? []) as { id: string }[]).map((e) => e.id);
  if (episodeIds.length === 0) return NextResponse.json({ jobs: {} });
  // 取这些剧集的任务，按创建时间倒序后取每集第一条
  const { data, error } = await sb
    .from("episode_jobs")
    .select("id, episode_id, stage, status, progress, created_at")
    .in("episode_id", episodeIds)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map: Record<string, unknown> = {};
  for (const j of (data ?? []) as { id: string; episode_id: string; stage: string; status: string; progress: string }[]) {
    if (!map[j.episode_id]) {
      map[j.episode_id] = { ...j, stageLabel: STAGE_LABELS[j.stage] ?? j.stage };
    }
  }
  return NextResponse.json({ jobs: map });
}
