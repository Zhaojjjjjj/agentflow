import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createRun, type RunMode } from "@/lib/engine/runService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  let q = sb
    .from("workflow_runs")
    .select("id, workflow_id, trigger, status, total_tokens, estimated_cost_usd, error, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (workflowId) q = q.eq("workflow_id", workflowId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const workflowId = String(body.workflowId || "");
  if (!workflowId) return NextResponse.json({ error: "缺少 workflowId" }, { status: 400 });
  const mode: RunMode = body.mode === "sync" ? "sync" : "async";
  let input: Record<string, unknown> = {};
  if (body.input !== undefined) {
    if (typeof body.input === "string") {
      try {
        input = JSON.parse(body.input);
      } catch {
        return NextResponse.json({ error: "input 不是合法 JSON" }, { status: 400 });
      }
    } else if (typeof body.input === "object" && body.input !== null) {
      input = body.input as Record<string, unknown>;
    }
  }
  try {
    const { runId } = await createRun({ workflowId, input, trigger: "manual", mode });
    return NextResponse.json({ runId, mode });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
