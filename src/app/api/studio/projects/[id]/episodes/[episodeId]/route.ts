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
    .select("id, number, title, outline, content, summary, word_count, status, cover_prompt, cover_url, created_at, updated_at")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  return NextResponse.json({ episode: data });
}

/** DELETE 删除单集（仅允许删除最新一集，避免剧情断裂；级联删除其写作任务与记忆文档） */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();

  // 只能删除最新一集：中间集被后续剧集引用（摘要/人物状态/伏笔），直接删会断裂
  const { data: maxEp } = await sb
    .from("episodes")
    .select("number")
    .eq("project_id", id)
    .order("number", { ascending: false })
    .limit(1)
    .single();
  const { data: thisEp } = await sb
    .from("episodes")
    .select("number, cover_url")
    .eq("id", episodeId)
    .single();
  if (!thisEp) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  const maxNumber = (maxEp as { number: number } | null)?.number ?? 0;
  if (thisEp.number < maxNumber) {
    return NextResponse.json(
      {
        error: `第 ${thisEp.number} 集之后还有 ${maxNumber - thisEp.number} 集是基于它写的，直接删除会导致剧情断裂。只能删除最新的一集（第 ${maxNumber} 集），或用正文编辑功能修改本集。`,
      },
      { status: 400 }
    );
  }

  // 先取消正在运行的任务（Inngest 端的 waitForEvent 会超时自停）
  const job = await latestJob(episodeId);
  if (job && job.status === "running") {
    await updateJob(job.id, { status: "cancelled", progress: "剧集已删除，任务取消" });
  }
  // 清理该集的记忆文档，避免脏记忆污染后续检索
  await sb.from("story_documents").delete().eq("ref_id", episodeId);
  // 同步删掉封面文件，避免 covers 桶堆积孤儿文件（与 retry/upload 的清理逻辑一致）
  const oldCover = (thisEp as { number: number; cover_url?: string | null }).cover_url;
  const cm = oldCover?.match(/\/covers\/(.+)$/);
  if (cm) await sb.storage.from("covers").remove([cm[1]]);
  const { error } = await sb.from("episodes").delete().eq("id", episodeId).eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
