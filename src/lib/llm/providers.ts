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
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Override the model for this call (per-node config). */
  model?: string;
}

export interface ChatResult {
  text: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
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

async function chatOnce(
  provider: LLMProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions
): Promise<ChatResult> {
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
    }),
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
  return {
    text: choice.message?.content ?? "",
    provider: provider.name,
    model: data?.model ?? model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

/**
 * Chat completion across configured providers in order.
 * Throws only when every provider fails (errors are chained in the message).
 */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
  const providers = await getChatProviders();
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
