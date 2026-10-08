// Embeddings via an OpenAI-compatible /embeddings endpoint (for RAG).

export async function embed(text: string): Promise<number[]> {
  const baseURL = (process.env.LLM_EMBEDDING_BASE_URL || "").replace(/\/$/, "");
  const apiKey = process.env.LLM_EMBEDDING_API_KEY;
  const model = process.env.LLM_EMBEDDING_MODEL || "text-embedding-3-small";
  if (!baseURL || !apiKey) {
    throw new Error(
      "Embeddings not configured. Set LLM_EMBEDDING_BASE_URL / LLM_EMBEDDING_API_KEY / LLM_EMBEDDING_MODEL."
    );
  }
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

export function embeddingDimensions(): number {
  const n = Number(process.env.LLM_EMBEDDING_DIMENSIONS || "1536");
  return Number.isFinite(n) && n > 0 ? n : 1536;
}
