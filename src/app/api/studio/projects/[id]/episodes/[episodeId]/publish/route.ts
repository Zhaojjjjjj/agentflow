import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { latestJob, updateJob } from "@/lib/studio/jobs";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** POST 发布该集（正文已就绪时） */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data: ep } = await sb
    .from("episodes")
    .select("content, word_count")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  const row = ep as { content: string; word_count: number } | null;
  if (!row) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  if (!row.content?.trim()) return NextResponse.json({ error: "正文为空，无法发布" }, { status: 400 });
  const { error } = await sb.from("episodes").update({ status: "published" }).eq("id", episodeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE 取消正在运行的写作任务 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const job = await latestJob(episodeId);
  if (!job || job.status !== "running") {
    return NextResponse.json({ error: "没有正在运行的任务" }, { status: 409 });
  }
  await updateJob(job.id, { status: "cancelled", progress: "已手动取消" });
  return NextResponse.json({ ok: true });
}
