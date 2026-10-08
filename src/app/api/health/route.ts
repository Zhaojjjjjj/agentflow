import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { configuredProviders } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const redis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const inngest = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
  const embeddings = Boolean(process.env.LLM_EMBEDDING_BASE_URL && process.env.LLM_EMBEDDING_API_KEY);
  return NextResponse.json({
    ok: true,
    supabase: isSupabaseConfigured(),
    redis,
    inngest,
    llmProviders: configuredProviders(),
    embeddings,
    time: new Date().toISOString(),
  });
}
