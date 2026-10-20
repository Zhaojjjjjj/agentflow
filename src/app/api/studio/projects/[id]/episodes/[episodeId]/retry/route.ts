import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { inngest, EVENTS } from "@/lib/inngest";
import { createJob, latestJob, updateJob, failJob } from "@/lib/studio/jobs";
import { archiveEpisodeVersion } from "@/lib/studio/versions";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/**
 * POST 重写本集。
 * body.mode:
 *  - "full"（默认）：清空旧大纲/正文 → 建新任务 → 完整流水线
 *  - "redraft"：保留大纲、只清正文 → 流水线跳过大纲生成与审稿，直接扩写
 * 两种模式都会先把当前版本存档到版本历史。
 */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const mode: "full" | "redraft" = body.mode === "redraft" ? "redraft" : "full";

  const sb = getSupabase();
  const { data: ep } = await sb
    .from("episodes")
    .select("id, number, outline")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  if (!ep) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  const outline = (ep as { outline: string }).outline || "";
  if (mode === "redraft" && !outline.trim()) {
    return NextResponse.json({ error: "本集还没有大纲，无法沿用大纲重写" }, { status: 400 });
  }

  // 覆盖前存档
  await archiveEpisodeVersion(episodeId, mode === "redraft" ? "redraft" : "retry");

  // 取消旧任务
  const oldJob = await latestJob(episodeId);
  if (oldJob && oldJob.status === "running") {
    await updateJob(oldJob.id, { status: "cancelled", progress: "已开始重写，旧任务取消" });
  }

  // 重置剧集（redraft 保留大纲）
  const reset = mode === "redraft"
    ? { content: "", summary: "", word_count: 0, status: "draft" }
    : { outline: "", content: "", summary: "", word_count: 0, status: "draft" };
  const { error: resetErr } = await sb.from("episodes").update(reset).eq("id", episodeId);
  if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 });

  // 建新任务并触发流水线
  const job = await createJob(episodeId);
  try {
    await inngest.send({
      name: EVENTS.EPISODE_WRITE_REQUESTED,
      data: { jobId: job.id, episodeId, projectId: id, mode },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failJob(job.id, `触发写作流水线失败（Inngest 未配置？）：${msg}`);
    return NextResponse.json(
      { jobId: job.id, warning: "Inngest 未配置，流水线无法启动。请检查 INNGEST_EVENT_KEY。" },
      { status: 202 }
    );
  }
  return NextResponse.json({ jobId: job.id, mode });
}
