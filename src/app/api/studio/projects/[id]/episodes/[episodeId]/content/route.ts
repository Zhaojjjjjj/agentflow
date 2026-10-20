import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { latestJob } from "@/lib/studio/jobs";
import { generateSummary, countWords } from "@/lib/studio/pipeline";
import { archiveEpisodeVersion } from "@/lib/studio/versions";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/**
 * PUT 手动编辑正文（润色）。
 * 保存后同步更新字数，并重新生成剧情摘要，保证记忆库与正文一致。
 * 任务运行中不允许编辑（会与流水线写入冲突）。
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const job = await latestJob(episodeId);
  if (job && job.status === "running") {
    return NextResponse.json({ error: "写作任务进行中，暂不能编辑正文" }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return NextResponse.json({ error: "正文不能为空" }, { status: 400 });

  const sb = getSupabase();
  const { data: ep } = await sb
    .from("episodes")
    .select("id, number, title")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  if (!ep) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  const row = ep as { number: number; title: string };

  // 覆盖前存档到版本历史
  await archiveEpisodeVersion(episodeId, "edit");

  const wordCount = countWords(content);
  // 摘要同步更新，保证下一集的前情检索拿到的是润色后的版本
  let summary = "";
  try {
    summary = await generateSummary(row.title || `第 ${row.number} 集`, row.number, content);
  } catch (e) {
    console.warn("[studio] summary regen failed:", e instanceof Error ? e.message : e);
  }

  const { error } = await sb
    .from("episodes")
    .update({ content, word_count: wordCount, ...(summary ? { summary } : {}) })
    .eq("id", episodeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 同步更新记忆文档中的摘要
  if (summary) {
    await sb
      .from("story_documents")
      .update({ content: `第 ${row.number} 集剧情摘要：${summary}` })
      .eq("ref_id", episodeId)
      .eq("kind", "episode_summary");
  }
  return NextResponse.json({ ok: true, word_count: wordCount });
}
