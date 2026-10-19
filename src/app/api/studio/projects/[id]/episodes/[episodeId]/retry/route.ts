import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { inngest, EVENTS } from "@/lib/inngest";
import { createJob, latestJob, updateJob, failJob } from "@/lib/studio/jobs";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/**
 * POST 重写本集：清空旧大纲/正文 → 建新任务 → 触发 Inngest 流水线。
 * 有正在运行的任务时先取消。
 */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data: ep, error: epErr } = await sb
    .from("episodes")
    .select("id, number")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  // PGRST116 = 查无此行（真正的 404）；其他错误（列名/权限/网络）必须报真实原因，
  // 不能再伪装成"剧集不存在"（同 context.ts 列名 bug 的教训）。
  if (epErr && epErr.code !== "PGRST116")
    return NextResponse.json({ error: `读取剧集失败：${epErr.message}` }, { status: 500 });
  if (!ep) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });

  // 取消旧任务
  const oldJob = await latestJob(episodeId);
  if (oldJob && oldJob.status === "running") {
    await updateJob(oldJob.id, { status: "cancelled", progress: "已开始重写，旧任务取消" });
  }

  // 重置剧集
  const { error: resetErr } = await sb
    .from("episodes")
    .update({ outline: "", content: "", summary: "", word_count: 0, status: "draft" })
    .eq("id", episodeId);
  if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 });

  // 建新任务并触发流水线
  const job = await createJob(episodeId);
  try {
    await inngest.send({
      name: EVENTS.EPISODE_WRITE_REQUESTED,
      data: { jobId: job.id, episodeId, projectId: id },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failJob(job.id, `触发写作流水线失败（Inngest 未配置？）：${msg}`);
    return NextResponse.json(
      { jobId: job.id, warning: "Inngest 未配置，流水线无法启动。请检查 INNGEST_EVENT_KEY。" },
      { status: 202 }
    );
  }
  return NextResponse.json({ jobId: job.id });
}
