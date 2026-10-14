import { getSupabase } from "./supabase";
import { getChatModelConfig } from "./appSettings";
import { chat, getChatProvidersPreferred } from "./llm/providers";

export const SUGGESTION_COUNT = 9;

/** 当天日期（北京时间），题目池按天划分 */
export function todayShanghai(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

/** 取今天的题目池（为空则返回 []，调用方用内置兜底） */
export async function getTodaySuggestions(): Promise<string[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("chat_suggestions")
    .select("text")
    .eq("day", todayShanghai())
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => r.text).filter(Boolean);
}

/**
 * 用 AI 生成一批新的推荐问题并入库（替换旧批次，只保留当天）。
 * 会参考最近 7 天用户的真实提问话题，让推荐更贴近实际使用。
 */
export async function refreshSuggestions(): Promise<string[]> {
  const sb = getSupabase();

  // 最近话题：取近 7 天用户消息采样，给 AI 做参考
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: recent } = await sb
    .from("chat_messages")
    .select("content")
    .eq("role", "user")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  const topics = (recent ?? [])
    .map((r) => r.content.slice(0, 60))
    .filter(Boolean)
    .slice(0, 15);

  const cfg = await getChatModelConfig();
  const providers = await getChatProvidersPreferred(cfg.providerName);
  const prompt =
    "你是 AgentFlow 内置 AI 助手「Af」的推荐问题策划。请生成 9 个适合放在聊天入口空态的推荐问题。\n" +
    "要求：\n" +
    "- 每个问题一句话，20 字以内，口语化，像用户随手会问的那种\n" +
    "- 方向多样：效率办公、写作润色、技术概念、创意灵感、生活常识\n" +
    "- 每行只写一个问题，不要编号、不要引号、不要任何解释\n" +
    (topics.length > 0
      ? `最近用户常聊这些话题，可围绕它们出题：${topics.join("；")}\n`
      : "") +
    "直接输出 9 行问题：";

  const result = await chat(
    [
      { role: "system", content: "你只输出推荐问题列表，每行一个，不加任何多余文字。" },
      { role: "user", content: prompt },
    ],
    { model: cfg.model ?? undefined, temperature: 0.9, maxTokens: 600 },
    providers
  );

  const items = result.text
    .split("\n")
    .map((l) => l.replace(/^[\d.\-、·*）\)\s"「」『』]+/, "").trim())
    .filter((l) => l.length > 0 && l.length <= 32)
    .slice(0, SUGGESTION_COUNT);

  if (items.length < 3) {
    throw new Error("AI 生成的推荐问题太少，稍后再试");
  }

  const day = todayShanghai();
  // 删掉旧批次，只留当天
  await sb.from("chat_suggestions").delete().neq("day", day);
  const { error } = await sb
    .from("chat_suggestions")
    .insert(items.map((text) => ({ text, day })));
  if (error) throw new Error(error.message);
  return items;
}
