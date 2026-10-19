// 前情检索：为"写一集"组装 StoryContext。
//
// 向量可用时用 match_story_documents 做语义召回；
// embedding 未配置时降级为时间顺序（最近的记忆文档）+ 关键词匹配。

import { getSupabase } from "@/lib/supabase";
import { getEmbeddingConfig, embed } from "@/lib/llm/embeddings";
import type { StoryContext } from "./prompts";

const RECENT_EPISODES = 5;
const MEMORY_LIMIT = 8;

interface ProjectRow {
  id: string;
  title: string;
  kind: string;
  genre: string | null;
  premise: string | null;
  worldview: string | null;
  style_notes: string | null;
  episode_target_words: number;
}

export async function gatherContext(projectId: string, episodeNumber: number): Promise<StoryContext> {
  const sb = getSupabase();

  const { data: project, error: pErr } = await sb
    .from("story_projects")
    .select("id, title, kind, genre, premise, worldview, style_notes, episode_target_words")
    .eq("id", projectId)
    .single();
  if (pErr) throw new Error(`读取作品失败：${pErr.message}`);
  if (!project) throw new Error("作品不存在");
  const p = project as ProjectRow;

  const [{ data: episodes }, { data: characters }, { data: threads }] = await Promise.all([
    sb
      .from("episodes")
      .select("number, title, summary")
      .eq("project_id", projectId)
      .lt("number", episodeNumber)
      .order("number", { ascending: false })
      .limit(RECENT_EPISODES),
    sb
      .from("story_characters")
      .select("name, role, profile, current_state")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    sb
      .from("plot_threads")
      .select("description, planted_episode")
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("created_at", { ascending: true }),
  ]);

  const recentSummaries = ((episodes ?? []) as { number: number; title: string; summary: string }[])
    .filter((e) => e.summary)
    .reverse()
    .map((e) => ({ number: e.number, title: e.title, summary: e.summary }));

  const relatedMemories = await recallMemories(
    projectId,
    [p.premise, ...recentSummaries.map((s) => s.summary)].filter(Boolean).join("\n").slice(0, 2000)
  );

  return {
    title: p.title,
    kind: p.kind === "drama" ? "drama" : "novel",
    genre: p.genre,
    synopsis: p.premise,
    worldview: p.worldview,
    style: p.style_notes,
    episodeNumber,
    targetWords: p.episode_target_words || 2000,
    recentSummaries,
    characters: ((characters ?? []) as { name: string; role: string | null; profile: string | null; current_state: string | null }[]).map(
      (c) => ({ name: c.name, role: c.role, profile: c.profile, currentState: c.current_state })
    ),
    openThreads: ((threads ?? []) as { description: string; planted_episode: number | null }[]).map((t) => ({
      description: t.description,
      plantedEpisode: t.planted_episode,
    })),
    relatedMemories,
  };
}

/** 记忆召回：向量优先，降级为最近文档 */
async function recallMemories(projectId: string, query: string): Promise<string[]> {
  const sb = getSupabase();
  // 向量路径
  try {
    const cfg = await getEmbeddingConfig();
    if (cfg) {
      const vec = await embed(query || "剧情");
      const { data, error } = await sb.rpc("match_story_documents", {
        query_embedding: vec,
        match_count: MEMORY_LIMIT,
        filter_project_id: projectId,
        min_similarity: 0.3,
      });
      if (!error && data && data.length > 0) {
        return (data as { content: string }[]).map((d) => d.content);
      }
    }
  } catch (e) {
    console.warn("[studio] vector recall failed, falling back:", e instanceof Error ? e.message : e);
  }
  // 降级：最近的记忆文档
  const { data } = await sb
    .from("story_documents")
    .select("content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(MEMORY_LIMIT);
  return ((data ?? []) as { content: string }[]).map((d) => d.content).reverse();
}
