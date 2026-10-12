// Embeddings via an OpenAI-compatible /embeddings endpoint (for RAG).
//
// Resolution order: DB (llm_providers kind='embedding', enabled, lowest
// priority first) -> env vars (LLM_EMBEDDING_*).

import { getSupabase } from "@/lib/supabase";
import { decryptSecret } from "@/lib/crypto";

export interface EmbeddingConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  dimensions: number;
}

function envDimensions(): number {
  const n = Number(process.env.LLM_EMBEDDING_DIMENSIONS || "1536");
  return Number.isFinite(n) && n > 0 ? n : 1536;
}

function readEmbeddingFromEnv(): EmbeddingConfig | null {
  const baseURL = (process.env.LLM_EMBEDDING_BASE_URL || "").replace(/\/$/, "");
  const apiKey = process.env.LLM_EMBEDDING_API_KEY;
  if (!baseURL || !apiKey) return null;
  return {
    baseURL,
    apiKey,
    model: process.env.LLM_EMBEDDING_MODEL || "text-embedding-3-small",
    dimensions: envDimensions(),
  };
}

interface DbEmbeddingRow {
  base_url: string;
  api_key_encrypted: string;
  model: string;
  dimensions: number | null;
}

async function readEmbeddingFromDb(): Promise<EmbeddingConfig | null> {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("llm_providers")
      .select("base_url,api_key_encrypted,model,dimensions")
      .eq("kind", "embedding")
      .eq("enabled", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as DbEmbeddingRow;
    const dimensions = Number(row.dimensions);
    return {
      baseURL: (row.base_url || "").replace(/\/$/, ""),
      apiKey: decryptSecret(row.api_key_encrypted),
      model: row.model,
      dimensions: Number.isFinite(dimensions) && dimensions > 0 ? dimensions : 1536,
    };
  } catch (e) {
    console.warn(`[agentflow] embedding provider read failed, using env config: ${(e as Error).message}`);
    return null;
  }
}

/** Resolved embedding config: DB first, env fallback. Throws when none configured. */
export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  const cfg = (await readEmbeddingFromDb()) ?? readEmbeddingFromEnv();
  if (!cfg) {
    throw new Error(
      "Embeddings not configured. Add an embedding provider in 设置 / LLM 供应商, or set LLM_EMBEDDING_BASE_URL / LLM_EMBEDDING_API_KEY / LLM_EMBEDDING_MODEL."
    );
  }
  return cfg;
}

export async function embed(text: string): Promise<number[]> {
  const { baseURL, apiKey, model } = await getEmbeddingConfig();
  const res = await fetch(`${baseURL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Embedding request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("Embedding response contained no vector");
  return vec as number[];
}

/** Legacy sync helper (env only). Prefer getEmbeddingConfig(). */
export function embeddingDimensions(): number {
  return envDimensions();
}
