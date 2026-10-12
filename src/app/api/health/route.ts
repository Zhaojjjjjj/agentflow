import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { configuredProviders } from "@/lib/llm/providers";
import { getEmbeddingConfig } from "@/lib/llm/embeddings";

export const dynamic = "force-dynamic";

export async function GET() {
  const redis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const inngest = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
  // Never 500 here: the dashboard renders degraded states from these flags,
  // and Supabase may genuinely be unconfigured on a fresh deploy.
  let llmProviders: string[] = [];
  try {
    llmProviders = await configuredProviders();
  } catch {
    /* leave empty -> dashboard shows "未配置" */
  }
  let embeddings = false;
  try {
    await getEmbeddingConfig();
    embeddings = true;
  } catch {
    /* not configured */
  }
  return NextResponse.json({
    ok: true,
    supabase: isSupabaseConfigured(),
    redis,
    inngest,
    llmProviders,
    embeddings,
    time: new Date().toISOString(),
  });
}
