import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createRun, validateApiKey, type RunMode } from "@/lib/engine/runService";
import { rateLimit } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function extractKey(req: NextRequest): string | null {
  const h = req.headers.get("x-api-key");
  if (h) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

type Params = { params: Promise<{ id: string }> };

/**
 * Publish a workflow as an HTTP API.
 * POST /api/public/workflows/[id]/run
 * Headers: x-api-key (or Authorization: Bearer)
 * Body: { input?: object, mode?: "sync" | "async" }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: workflowId } = await params;
  const key = extractKey(req);
  if (!key) {
    return NextResponse.json({ error: "缺少 API Key（x-api-key 或 Authorization: Bearer）" }, { status: 401 });
  }
  const keyRow = await validateApiKey(key, workflowId).catch(() => null);
  if (!keyRow) {
    return NextResponse.json({ error: "API Key 无效" }, { status: 403 });
  }
  const allowed = await rateLimit(`public:${keyRow.id}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: "请求过于频繁（60次/分钟）" }, { status: 429 });
  }

  const sb = getSupabase();
  const { data: wf } = await sb.from("workflows").select("is_published").eq("id", workflowId).single();
  if (!wf) return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  if (!(wf as { is_published: boolean }).is_published) {
    return NextResponse.json({ error: "工作流尚未发布" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mode: RunMode = body.mode === "sync" ? "sync" : "async";
  let input: Record<string, unknown> = {};
  if (body.input !== undefined) {
    if (typeof body.input === "object" && body.input !== null) input = body.input;
    else return NextResponse.json({ error: "input 必须是对象" }, { status: 400 });
  }

  try {
    const { runId } = await createRun({ workflowId, input, trigger: "api", mode });
    if (mode === "sync") {
      const { data: run } = await sb.from("workflow_runs").select("status, output, error, total_tokens, estimated_cost_usd").eq("id", runId).single();
      return NextResponse.json({ runId, mode, run });
    }
    return NextResponse.json({ runId, mode, status: "running" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
