// OpenAI-compatible provider abstraction with ordered fallback.
//
// Resolution order: DB (llm_providers, enabled, by priority) -> env vars
// (LLM_PROVIDER_{i}_*). The executor is unaware of the source.

import { getSupabase } from "@/lib/supabase";
import { decryptSecret } from "@/lib/crypto";

export interface LLMProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** OpenAI tool-calling: assistant 消息携带 tool_calls，tool 消息携带 tool_call_id */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Override the model for this call (per-node config). */
  model?: string;
  /** Function-calling tools (Luna chat skills). */
  tools?: ToolDef[];
  toolChoice?: "auto" | "none";
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatResult {
  text: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  toolCalls: ToolCall[];
}

function readProvidersFromEnv(): LLMProviderConfig[] {
  const providers: LLMProviderConfig[] = [];
  for (let i = 1; i <= 9; i++) {
    const p = (k: string) => process.env[`LLM_PROVIDER_${i}_${k}`];
    const apiKey = p("API_KEY");
    const baseURL = p("BASE_URL");
    const model = p("MODEL");
    if (!apiKey || !baseURL || !model) continue;
    providers.push({
      name: p("NAME") || `provider-${i}`,
      baseURL: baseURL.replace(/\/$/, ""),
      apiKey,
      model,
    });
  }
  return providers;
}

/** Env-var providers with full details (server-side only, used by the "import" API). */
export function readEnvProviders(): LLMProviderConfig[] {
  return readProvidersFromEnv();
}

interface DbChatRow {
  name: string;
  base_url: string;
  api_key_encrypted: string;
  model: string;
}

/** Returns null when the DB has no usable rows (or the table is missing). */
async function readProvidersFromDb(): Promise<LLMProviderConfig[] | null> {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("llm_providers")
      .select("name,base_url,api_key_encrypted,model")
      .eq("kind", "chat")
      .eq("enabled", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      // Table may not exist yet (migration not run) — fall back to env.
      console.warn(`[agentflow] llm_providers read failed, using env config: ${error.message}`);
      return null;
    }
    if (!data || data.length === 0) return null;
    const rows = data as DbChatRow[];
    return rows.map((r) => ({
      name: r.name,
      baseURL: (r.base_url || "").replace(/\/$/, ""),
      apiKey: decryptSecret(r.api_key_encrypted),
      model: r.model,
    }));
  } catch (e) {
    console.warn(`[agentflow] llm_providers read failed, using env config: ${(e as Error).message}`);
    return null;
  }
}

/** Ordered chat providers: DB first, env fallback. */
export async function getChatProviders(): Promise<LLMProviderConfig[]> {
  const fromDb = await readProvidersFromDb();
  return fromDb ?? readProvidersFromEnv();
}

/** Providers with a preferred one moved to the front (for chat-dedicated model config). */
export async function getChatProvidersPreferred(name: string | null): Promise<LLMProviderConfig[]> {
  const all = await getChatProviders();
  if (!name) return all;
  const i = all.findIndex((p) => p.name === name);
  if (i <= 0) return all;
  return [all[i], ...all.slice(0, i), ...all.slice(i + 1)];
}

async function chatOnce(
  provider: LLMProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions
): Promise<ChatResult> {
  const model = options.model || provider.model;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }
  const res = await fetch(`${provider.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM provider "${provider.name}" failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const choice = data?.choices?.[0];
  if (!choice) throw new Error(`LLM provider "${provider.name}" returned no choices`);
  const usage = data?.usage ?? {};
  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const toolCalls: ToolCall[] = [];
  for (const tc of choice.message?.tool_calls ?? []) {
    if (tc?.type !== "function" || !tc.function?.name) continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || "{}");
    } catch {
      continue; // 参数不是合法 JSON，跳过这次调用
    }
    toolCalls.push({ id: tc.id || `tc-${Date.now()}`, name: tc.function.name, arguments: args });
  }
  return {
    text: choice.message?.content ?? "",
    provider: provider.name,
    model: data?.model ?? model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    toolCalls,
  };
}

/**
 * Chat completion across configured providers in order.
 * Throws only when every provider fails (errors are chained in the message).
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
  providersOverride?: LLMProviderConfig[]
): Promise<ChatResult> {
  const providers = providersOverride ?? (await getChatProviders());
  if (providers.length === 0) {
    throw new Error(
      "No LLM provider configured. Add one in 设置 / LLM 供应商, or set LLM_PROVIDER_1_BASE_URL / LLM_PROVIDER_1_API_KEY / LLM_PROVIDER_1_MODEL."
    );
  }
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return await chatOnce(provider, messages, options);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[agentflow] ${msg} — trying next provider`);
      errors.push(msg);
    }
  }
  throw new Error(`All LLM providers failed:\n- ${errors.join("\n- ")}`);
}

export async function configuredProviders(): Promise<string[]> {
  return (await getChatProviders()).map((p) => p.name);
}

export interface StreamCallbacks {
  onToken: (delta: string) => void;
  onDone?: (info: { provider: string; model: string; promptTokens: number; completionTokens: number }) => void;
}

async function chatOnceStream(
  provider: LLMProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions,
  cb: StreamCallbacks
): Promise<void> {
  const model = options.model || provider.model;
  const res = await fetch(`${provider.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM provider "${provider.name}" failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let gotAny = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const delta = j?.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            gotAny = true;
            cb.onToken(delta);
          }
          const usage = j?.usage;
          if (usage) {
            promptTokens = Number(usage.prompt_tokens ?? promptTokens);
            completionTokens = Number(usage.completion_tokens ?? completionTokens);
          }
        } catch {
          /* partial chunk, ignore */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!gotAny) throw new Error(`LLM provider "${provider.name}" returned no content`);
  cb.onDone?.({ provider: provider.name, model, promptTokens, completionTokens });
}

/**
 * Streaming chat completion across configured providers in order.
 * Calls onToken for each delta; falls back to the next provider on failure
 * (only before any token was emitted — mid-stream failures surface as-is).
 */
export async function chatStream(
  messages: ChatMessage[],
  options: ChatOptions,
  cb: StreamCallbacks,
  providersOverride?: LLMProviderConfig[]
): Promise<void> {
  const providers = providersOverride ?? (await getChatProviders());
  if (providers.length === 0) {
    throw new Error("未配置 LLM 供应商，请让管理员在「管理后台 / LLM 配置」中添加。");
  }
  // Honor an explicit provider pick (chat-dedicated model) first.
  const errors: string[] = [];
  for (const provider of providers) {
    let emitted = false;
    try {
      await chatOnceStream(provider, messages, options, {
        onToken: (d) => {
          emitted = true;
          cb.onToken(d);
        },
        onDone: cb.onDone,
      });
      return;
    } catch (e) {
      if (emitted) throw e; // mid-stream: don't silently switch providers
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`所有 LLM 供应商都失败了：\n- ${errors.join("\n- ")}`);
}
