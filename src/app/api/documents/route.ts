import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { embed } from "@/lib/llm/embeddings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  if (!workflowId) return NextResponse.json({ error: "缺少 workflowId" }, { status: 400 });
  const { data, error } = await sb
    .from("documents")
    .select("id, content, metadata, created_at")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

/** Ingest text chunks: embed each chunk and store with its vector. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const workflowId = String(body.workflowId || "");
  const chunks = Array.isArray(body.chunks) ? body.chunks : [];
  if (!workflowId) return NextResponse.json({ error: "缺少 workflowId" }, { status: 400 });
  if (chunks.length === 0) return NextResponse.json({ error: "chunks 为空" }, { status: 400 });
  if (chunks.length > 50) return NextResponse.json({ error: "单次最多 50 个 chunk" }, { status: 400 });

  const sb = getSupabase();
  let inserted = 0;
  const errors: string[] = [];
  for (const c of chunks) {
    const content = String(c?.content || "").trim();
    if (!content) continue;
    try {
      const vector = await embed(content);
      const { error } = await sb.from("documents").insert({
        workflow_id: workflowId,
        content,
        metadata: (c?.metadata as Record<string, unknown>) || {},
        embedding: vector,
      });
      if (error) throw new Error(error.message);
      inserted++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return NextResponse.json({ inserted, errors: errors.slice(0, 5) });
}
