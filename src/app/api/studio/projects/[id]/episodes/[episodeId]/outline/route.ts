import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { inngest, EVENTS } from "@/lib/inngest";
import { latestJob } from "@/lib/studio/jobs";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** POST 保存用户修改后的大纲（审稿时） */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const outline = typeof body.outline === "string" ? body.outline : "";
  if (!outline.trim()) return NextResponse.json({ error: "大纲不能为空" }, { status: 400 });
  const sb = getSupabase();
  const { error } = await sb.from("episodes").update({ outline }).eq("id", episodeId).eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** PUT 通过大纲审稿 → 通知 Inngest 继续流水线 */
export async function PUT(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const job = await latestJob(episodeId);
  if (!job || job.status !== "running" || job.stage !== "outline_review") {
    return NextResponse.json({ error: "当前没有等待审稿的任务" }, { status: 409 });
  }
  const sb = getSupabase();
  const { data: ep } = await sb.from("episodes").select("outline").eq("id", episodeId).single();
  const outline = (ep as { outline: string } | null)?.outline ?? "";
  if (!outline.trim()) return NextResponse.json({ error: "大纲为空，无法通过" }, { status: 400 });
  await inngest.send({
    name: EVENTS.OUTLINE_APPROVED,
    data: { jobId: job.id, episodeId, outline },
  });
  return NextResponse.json({ ok: true });
}
