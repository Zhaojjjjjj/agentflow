import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { inngest, EVENTS } from "@/lib/inngest";
import { createJob, latestJob, updateJob } from "@/lib/studio/jobs";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** GET 剧集详情（含大纲、正文） */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("episodes")
    .select("id, number, title, outline, content, summary, word_count, status, created_at, updated_at")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  return NextResponse.json({ episode: data });
}

/** DELETE 删除单集（级联删除其写作任务） */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  // 先取消正在运行的任务（Inngest 端的 waitForEvent 会超时自停）
  const job = await latestJob(episodeId);
  if (job && job.status === "running") {
    await updateJob(job.id, { status: "cancelled", progress: "剧集已删除，任务取消" });
  }
  const sb = getSupabase();
  const { error } = await sb.from("episodes").delete().eq("id", episodeId).eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
