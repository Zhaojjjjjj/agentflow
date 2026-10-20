import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { latestJob } from "@/lib/studio/jobs";
import { archiveEpisodeVersion } from "@/lib/studio/versions";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** GET 版本列表（不含正文全文，只给摘要信息） */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("episode_versions")
    .select("id, source, word_count, created_at, summary")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ versions: [] }); // 表未建时降级为空
  return NextResponse.json({ versions: data ?? [] });
}

/** POST 恢复某个版本（恢复前先把当前版本存档，避免丢稿） */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const job = await latestJob(episodeId);
  if (job && job.status === "running") {
    return NextResponse.json({ error: "写作任务进行中，暂不能恢复版本" }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  const versionId = typeof body.versionId === "string" ? body.versionId : "";
  if (!versionId) return NextResponse.json({ error: "缺少 versionId" }, { status: 400 });

  const sb = getSupabase();
  const { data: v, error } = await sb
    .from("episode_versions")
    .select("outline, content, summary, word_count")
    .eq("id", versionId)
    .eq("episode_id", episodeId)
    .single();
  if (error || !v) return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  const ver = v as { outline: string; content: string; summary: string; word_count: number };

  await archiveEpisodeVersion(episodeId, "restore");
  const { error: upErr } = await sb
    .from("episodes")
    .update({ outline: ver.outline, content: ver.content, summary: ver.summary, word_count: ver.word_count })
    .eq("id", episodeId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
