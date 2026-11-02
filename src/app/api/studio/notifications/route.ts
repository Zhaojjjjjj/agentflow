import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";

/**
 * GET 最近 24 小时内完成的写作 / 生图任务（供 TopNav 完工提醒）。
 * 只返回当前用户自己的任务，两种任务按完成时间合并排序。
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
  const episodeItems = ((data ?? []) as unknown as Row[])
    .filter((r) => me.role === "admin" || r.episodes.story_projects.owner_id === me.id)
    .map((r) => ({
      kind: "episode" as const,
      jobId: r.id,
      status: r.status,
      at: r.updated_at,
      projectId: r.episodes.project_id,
      projectTitle: r.episodes.story_projects.title,
      episodeId: r.episode_id,
      episodeNumber: r.episodes.number,
      episodeTitle: r.episodes.title,
    }));

  const { data: imgData } = await sb
    .from("image_jobs")
    .select("id, template_name, mode, status, updated_at")
    .eq("user_id", me.id)
    .in("status", ["succeeded", "failed"])
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(30);
  type ImgRow = { id: string; template_name: string; mode: string; status: string; updated_at: string };
  const imageItems = ((imgData ?? []) as ImgRow[]).map((r) => ({
    kind: "image" as const,
    jobId: r.id,
    status: r.status,
    at: r.updated_at,
    templateName: r.template_name,
    mode: r.mode,
  }));

  const items = [...episodeItems, ...imageItems]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 10);
  return NextResponse.json({ items });
}
