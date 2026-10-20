import type { ChatSkill } from "./types";
import { getSupabase } from "@/lib/supabase";

/**
 * search_story_memory：让 Luna 能查用户连载作品的记忆库，
 * 回答"第 N 集发生了什么""某人物现在什么状态""某伏笔回收了吗"类问题。
 * 检索结果通过 summary 回喂给模型（不产出文件）。
 */

interface ProjectRow {
  id: string;
  title: string;
}

async function userProjects(userId: string, isAdmin: boolean): Promise<ProjectRow[]> {
  const sb = getSupabase();
  let q = sb.from("story_projects").select("id, title");
  if (!isAdmin) q = q.eq("owner_id", userId);
  const { data } = await q.limit(20);
  return (data ?? []) as ProjectRow[];
}

export const storySearchSkill: ChatSkill = {
  name: "search_story_memory",
  description:
    "搜索用户在 AgentFlow 工作室里连载作品的剧情记忆：每集摘要、人物卡与当前状态、伏笔。当用户问起自己的小说/剧本剧情（如某集发生了什么、某人物现状、某条伏笔、故事设定）时调用。参数 query 是要查的关键词或问题。",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索关键词，如人物名、集数、事件，如：沈夜 怀表" },
      project_title: { type: "string", description: "可选：限定某部作品的标题（用户提到作品名时填写）" },
    },
    required: ["query"],
  },
  async execute(args, ctx) {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    const titleFilter = typeof args.project_title === "string" ? args.project_title.trim() : "";
    if (!query) return { summary: "未提供搜索关键词。", files: [] };
    if (!ctx?.userId) return { summary: "无法确定当前用户，未执行搜索。", files: [] };

    const projects = await userProjects(ctx.userId, ctx.role === "admin");
    const targets = titleFilter
      ? projects.filter((p) => p.title.includes(titleFilter))
      : projects;
    if (targets.length === 0) {
      return { summary: "用户还没有作品，或没有匹配该标题的作品。", files: [] };
    }

    const sb = getSupabase();
    const keywords = query.split(/[\s,，、]+/).filter((k) => k.length >= 1).slice(0, 4);
    const blocks: string[] = [];

    for (const p of targets.slice(0, 3)) {
      const parts: string[] = [];

      // 人物卡（全量，量小）
      const { data: chars } = await sb
        .from("story_characters")
        .select("name, role, profile, current_state")
        .eq("project_id", p.id);
      const hitChars = (chars ?? []).filter((c) => {
        const row = c as { name: string };
        return keywords.some((k) => query.includes(row.name) || row.name.includes(k));
      });
      const charsToShow = hitChars.length > 0 ? hitChars : [];
      for (const c of charsToShow) {
        const row = c as { name: string; role: string; profile: string; current_state: string };
        parts.push(`人物 ${row.name}（${row.role || "—"}）：${row.profile || ""} 当前状态：${row.current_state || "—"}`);
      }

      // 集摘要关键词命中
      const { data: eps } = await sb
        .from("episodes")
        .select("number, title, summary")
        .eq("project_id", p.id)
        .order("number", { ascending: true });
      for (const e of (eps ?? []) as { number: number; title: string; summary: string }[]) {
        if (!e.summary) continue;
        if (keywords.some((k) => e.summary.includes(k) || (e.title || "").includes(k))) {
          parts.push(`第 ${e.number} 集${e.title ? `《${e.title}》` : ""}摘要：${e.summary}`);
        }
      }

      // 记忆文档关键词命中（摘要/人物状态/伏笔文档）
      const { data: docs } = await sb
        .from("story_documents")
        .select("content, kind")
        .eq("project_id", p.id)
        .limit(60);
      for (const d of (docs ?? []) as { content: string; kind: string }[]) {
        if (keywords.some((k) => d.content.includes(k))) {
          parts.push(`记忆（${d.kind}）：${d.content.slice(0, 300)}`);
        }
      }

      if (parts.length > 0) {
        blocks.push(`《${p.title}》：\n` + parts.slice(0, 12).join("\n"));
      }
    }

    if (blocks.length === 0) {
      return {
        summary: `在用户的作品记忆里没有搜到与「${query}」相关的内容。请直接告诉用户没查到，不要编造剧情。`,
        files: [],
      };
    }
    return {
      summary:
        `以下是从用户作品记忆库检索到的真实资料，请严格基于这些资料回答，不要编造未提及的剧情：\n\n` +
        blocks.join("\n\n").slice(0, 5000),
      files: [],
    };
  },
};
