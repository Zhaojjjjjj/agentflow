// 写一集流水线的 LLM 步骤（被 Inngest 函数调用）。

import { chat, getChatProvidersPreferred, type ChatMessage, type ChatOptions } from "@/lib/llm/providers";
import { getChatModelConfig } from "@/lib/appSettings";
import { getSupabase } from "@/lib/supabase";
import { getEmbeddingConfig, embed } from "@/lib/llm/embeddings";
import {
  type StoryContext,
  novelOutlinePrompt,
  dramaOutlinePrompt,
  novelExpandPrompt,
  dramaExpandPrompt,
  consistencyPrompt,
  revisePrompt,
  summaryPrompt,
  memoryExtractPrompt,
  extractJson,
  type MemoryExtraction,
} from "./prompts";

export interface OutlineSection {
  title: string;
  points: string;
}

/**
 * 流水线 LLM 调用：复用 Luna 的对话模型配置（/admin/llm 里配的供应商优先 + 模型覆盖）。
 * 只复用供应商/模型，不复用 Luna 的聊天人设提示词——各阶段有人设（策划编辑/编剧/责编）。
 */
async function pipelineChat(messages: ChatMessage[], options: ChatOptions = {}) {
  const cfg = await getChatModelConfig();
  const providers = await getChatProvidersPreferred(cfg.providerName);
  return chat(messages, { model: cfg.model ?? undefined, ...options }, providers);
}

/** 生成本集大纲 */
export async function generateOutline(ctx: StoryContext): Promise<string> {
  const prompt = ctx.kind === "drama" ? dramaOutlinePrompt(ctx) : novelOutlinePrompt(ctx);
  const res = await pipelineChat(
    [
      { role: "system", content: "你是资深的连载作品策划编辑，擅长设计单集的完整戏剧结构。" },
      { role: "user", content: prompt },
    ],
    { temperature: 0.8, maxTokens: 2048 }
  );
  return res.text.trim();
}

/** 从大纲中解析出可扩写的节/场 */
export function parseSections(outline: string, kind: "novel" | "drama"): OutlineSection[] {
  const marker = kind === "drama" ? "### " : "## ";
  const sections: OutlineSection[] = [];
  const lines = outline.split("\n");
  let cur: OutlineSection | null = null;
  for (const line of lines) {
    if (line.startsWith(marker)) {
      if (cur) sections.push(cur);
      cur = { title: line.replace(marker, "").trim(), points: "" };
    } else if (cur) {
      cur.points += line + "\n";
    }
  }
  if (cur) sections.push(cur);
  // 过滤掉"梗概"节（不扩写）
  return sections.filter((s) => !/^梗概/.test(s.title)).map((s) => ({ ...s, points: s.points.trim() }));
}

/** 扩写某一节/场 */
export async function expandSection(
  ctx: StoryContext,
  outline: string,
  section: OutlineSection,
  writtenSoFar: string,
  totalSections: number
): Promise<string> {
  const perSection = Math.max(400, Math.round(ctx.targetWords / Math.max(1, totalSections)));
  const prompt =
    ctx.kind === "drama"
      ? dramaExpandPrompt(ctx, outline, section.title, section.points, writtenSoFar, perSection)
      : novelExpandPrompt(ctx, outline, section.title, section.points, writtenSoFar, perSection);
  const res = await pipelineChat(
    [
      {
        role: "system",
        content: ctx.kind === "drama" ? "你是网络短剧编剧，擅长快节奏的竖屏剧本。" : "你是长篇小说作家，文字细腻，节奏稳健。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.85, maxTokens: 4096 }
  );
  return res.text.trim();
}

export interface ConsistencyIssue {
  type: string;
  location: string;
  detail: string;
  suggestion: string;
}

/** 一致性检查，返回问题列表 */
export async function checkConsistency(
  ctx: StoryContext,
  outline: string,
  content: string
): Promise<ConsistencyIssue[]> {
  const res = await pipelineChat(
    [
      { role: "system", content: "你是资深的 continuity 编辑，眼光毒辣，只说有把握的问题。" },
      { role: "user", content: consistencyPrompt(ctx, outline, content) },
    ],
    { temperature: 0.3, maxTokens: 2048 }
  );
  const parsed = extractJson(res.text);
  if (!Array.isArray(parsed)) return [];
  return (parsed as ConsistencyIssue[]).filter((i) => i && i.detail);
}

/** 根据审稿意见修订正文（只做一轮） */
export async function reviseContent(content: string, issues: ConsistencyIssue[]): Promise<string> {
  const res = await pipelineChat(
    [
      { role: "system", content: "你是小说编辑，修订精准克制，不改变原文风格。" },
      { role: "user", content: revisePrompt(content, issues) },
    ],
    { temperature: 0.5, maxTokens: 8192 }
  );
  return res.text.trim();
}

/** 生成本集摘要 */
export async function generateSummary(title: string, episodeNumber: number, content: string): Promise<string> {
  const res = await pipelineChat(
    [{ role: "system", content: "你是连载小说的责编，写摘要信息密度极高。" },
     { role: "user", content: summaryPrompt(title, episodeNumber, content) }],
    { temperature: 0.4, maxTokens: 1024 }
  );
  return res.text.trim();
}

/** 提取人物状态变化与伏笔 */
export async function extractMemory(ctx: StoryContext, content: string): Promise<MemoryExtraction> {
  const empty: MemoryExtraction = { characterUpdates: [], newThreads: [], resolvedThreads: [] };
  const res = await pipelineChat(
    [{ role: "system", content: "你是连载作品的档案管理员，严谨细致。" },
     { role: "user", content: memoryExtractPrompt(ctx, content) }],
    { temperature: 0.3, maxTokens: 2048 }
  );
  const parsed = extractJson(res.text) as MemoryExtraction | null;
  if (!parsed || typeof parsed !== "object") return empty;
  return {
    characterUpdates: Array.isArray(parsed.characterUpdates) ? parsed.characterUpdates : [],
    newThreads: Array.isArray(parsed.newThreads) ? parsed.newThreads : [],
    resolvedThreads: Array.isArray(parsed.resolvedThreads) ? parsed.resolvedThreads : [],
  };
}

function countWords(text: string): number {
  // 中文按字符计，英文按词计，取一个近似值
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ").match(/[a-zA-Z0-9]+/g) || []).length;
  return cjk + latin;
}

/** 记忆入库：摘要 + 人物状态 + 伏笔 + 向量文档 */
export async function memorizeEpisode(
  projectId: string,
  episodeId: string,
  episodeNumber: number,
  ctx: StoryContext,
  content: string
): Promise<{ summary: string; wordCount: number }> {
  const sb = getSupabase();
  const summary = await generateSummary(ctx.title, episodeNumber, content);
  const wordCount = countWords(content);
  const memory = await extractMemory(ctx, content);

  // 1. 本集摘要写回 episodes
  await sb.from("episodes").update({ summary, word_count: wordCount }).eq("id", episodeId);

  // 2. 人物状态更新
  const { data: chars } = await sb.from("story_characters").select("id, name").eq("project_id", projectId);
  const nameToId = new Map(((chars ?? []) as { id: string; name: string }[]).map((c) => [c.name, c.id]));
  for (const u of memory.characterUpdates) {
    const id = nameToId.get(u.name);
    if (id && u.newState) {
      await sb.from("story_characters").update({ current_state: u.newState }).eq("id", id);
    }
  }

  // 3. 伏笔：新增 + 回收
  for (const t of memory.newThreads) {
    if (t.description) {
      await sb.from("plot_threads").insert({
        project_id: projectId,
        description: t.description,
        planted_episode: episodeNumber,
        status: "open",
      });
    }
  }
  if (memory.resolvedThreads.length > 0) {
    const { data: openThreads } = await sb
      .from("plot_threads")
      .select("id, description")
      .eq("project_id", projectId)
      .eq("status", "open");
    for (const r of memory.resolvedThreads) {
      const hit = ((openThreads ?? []) as { id: string; description: string }[]).find(
        (t) => r.description && (t.description.includes(r.description.slice(0, 12)) || r.description.includes(t.description.slice(0, 12)))
      );
      if (hit) {
        await sb.from("plot_threads").update({ status: "resolved", resolved_episode: episodeNumber }).eq("id", hit.id);
      }
    }
  }

  // 4. 记忆文档入库（向量可用时生成 embedding）
  const docs = [
    { kind: "episode_summary", content: `第 ${episodeNumber} 集剧情摘要：${summary}`, metadata: { episode_number: episodeNumber } },
  ];
  let embedding: number[] | null = null;
  try {
    await getEmbeddingConfig();
    embedding = await embed(docs[0].content);
  } catch {
    embedding = null; // 未配置向量：纯文本入库
  }
  for (const d of docs) {
    await sb.from("story_documents").insert({
      project_id: projectId,
      kind: d.kind,
      ref_id: episodeId,
      content: d.content,
      metadata: d.metadata,
      ...(embedding ? { embedding } : {}),
    });
  }

  return { summary, wordCount };
}
