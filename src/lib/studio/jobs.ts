// episode_jobs 读写 helper（供 Inngest 函数和 API 路由共用）。

import { getSupabase } from "@/lib/supabase";

export type JobStage =
  | "queued"
  | "context"
  | "outline"
  | "outline_review"
  | "drafting"
  | "review"
  | "memorize"
  | "cover"
  | "done";

export type JobStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface EpisodeJob {
  id: string;
  episode_id: string;
  stage: string;
  status: string;
  progress: string;
  error: string;
  created_at: string;
  finished_at: string | null;
}

export const STAGE_LABELS: Record<string, string> = {
  queued: "排队中",
  context: "检索前情",
  outline: "生成大纲",
  outline_review: "等待审稿",
  drafting: "扩写正文",
  review: "一致性检查",
  memorize: "记忆入库",
  cover: "封面提示词",
  done: "已完成",
};

export async function createJob(episodeId: string): Promise<EpisodeJob> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("episode_jobs")
    .insert({ episode_id: episodeId, stage: "queued", status: "running", progress: "已加入写作队列" })
    .select("id, episode_id, stage, status, progress, error, created_at, finished_at")
    .single();
  if (error) throw new Error(`创建写作任务失败：${error.message}`);
  return data as EpisodeJob;
}

export async function updateJob(
  jobId: string,
  patch: { stage?: JobStage; status?: JobStatus; progress?: string; error?: string }
): Promise<void> {
  const sb = getSupabase();
  const update: Record<string, unknown> = {};
  if (patch.stage) update.stage = patch.stage;
  if (patch.status) {
    update.status = patch.status;
    if (patch.status !== "running") update.finished_at = new Date().toISOString();
  }
  if (patch.progress !== undefined) update.progress = patch.progress;
  if (patch.error !== undefined) update.error = patch.error;
  const { error } = await sb.from("episode_jobs").update(update).eq("id", jobId);
  if (error) console.warn("[studio] updateJob failed:", error.message);
}

export async function failJob(jobId: string, error: string): Promise<void> {
  await updateJob(jobId, { status: "failed", error: error.slice(0, 1000), progress: "任务失败" });
}

/** 按 id 取单个任务（封面生图轮询用，避免与写流水线的 latestJob 混淆）。 */
export async function getJob(jobId: string): Promise<EpisodeJob | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("episode_jobs")
    .select("id, episode_id, stage, status, progress, error, created_at, finished_at")
    .eq("id", jobId)
    .single();
  return (data as EpisodeJob | null) ?? null;
}

export async function latestJob(episodeId: string): Promise<EpisodeJob | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("episode_jobs")
    .select("id, episode_id, stage, status, progress, error, created_at, finished_at")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EpisodeJob | null) ?? null;
}
