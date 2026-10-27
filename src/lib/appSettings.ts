import { getSupabase } from "./supabase";
import { SKILL_SYSTEM_PROMPT } from "./chatSkills";

/** Simple key-value app settings (admin-configured). Keys: chat.provider, chat.model, chat.system_prompt */
export async function getSetting(key: string): Promise<string | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error || !data) return null;
  return data.value;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const sb = getSupabase();
  const { data } = await sb.from("app_settings").select("key, value").in("key", keys);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

const DEFAULT_SYSTEM_PROMPT =
  "你是 Luna，AgentFlow 的 AI 助手。当被问到你是谁时，回答：我是 Luna，AgentFlow 的 AI 助手。用简洁清晰的中文回答。";

/** Resolve which provider+model the Chat page should use (admin-configured, falls back to priority order). */
export async function getChatModelConfig(): Promise<{ providerName: string | null; model: string | null; systemPrompt: string }> {
  const s = await getSettings(["chat.provider", "chat.model", "chat.system_prompt"]);
  const base = s["chat.system_prompt"] || DEFAULT_SYSTEM_PROMPT;
  return {
    providerName: s["chat.provider"] || null,
    model: s["chat.model"] || null,
    // 技能说明拼在系统提示词后面（管理员自定义的提示词也生效）
    systemPrompt: `${base}\n\n${SKILL_SYSTEM_PROMPT}`,
  };
}

/** Resolve which provider+model image generation should use (admin-configured, falls back to priority order). */
export async function getImageModelConfig(): Promise<{ providerName: string | null; model: string | null }> {
  const s = await getSettings(["image.provider", "image.model"]);
  return {
    providerName: s["image.provider"] || null,
    model: s["image.model"] || null,
  };
}
