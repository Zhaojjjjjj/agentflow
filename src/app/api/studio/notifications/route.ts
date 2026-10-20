import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";

/**
 * GET 最近 24 小时内完成的写作任务（供 TopNav 完工提醒）。
 * 只返回当前用户自己作品的任务。
 */
export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await sb
    .from("episode_jobs")
    .select("id, episode_id, status, updated_at, episodes!inner(number, title, project_id, story_projects!inner(title, owner_id))")
    .in("status", ["succeeded", "failed"])
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(30);

  type Row = {
    id: string;
    episode_id: string;
    status: string;
    updated_at: string;
    episodes: {
      number: number;
      title: string;
      project_id: string;
      story_projects: { title: string; owner_id: string };
    };
  };
  const items = ((data ?? []) as unknown as Row[])
    .filter((r) => me.role === "admin" || r.episodes.story_projects.owner_id === me.id)
    .slice(0, 10)
    .map((r) => ({
      jobId: r.id,
      status: r.status,
      at: r.updated_at,
      projectId: r.episodes.project_id,
      projectTitle: r.episodes.story_projects.title,
      episodeId: r.episode_id,
      episodeNumber: r.episodes.number,
      episodeTitle: r.episodes.title,
    }));
  return NextResponse.json({ items });
}
