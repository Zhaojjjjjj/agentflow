import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessWorkflow, visibleWorkflowIds } from "@/lib/access";
import { createRun, sweepStaleRuns, type RunMode } from "@/lib/engine/runService";

export const dynamic = "force-dynamic";
// Sync mode executes the whole graph inline — give it headroom on Vercel.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  // Opportunistic self-healing: never leave runs stuck in running/queued forever.
  await sweepStaleRuns().catch(() => {});
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  if (workflowId && !(await canAccessWorkflow(workflowId, me))) {
    return NextResponse.json({ error: "工作流不存在或无权访问" }, { status: 404 });
  }
  let q = sb
    .from("workflow_runs")
    .select("id, workflow_id, trigger, status, total_tokens, estimated_cost_usd, error, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (workflowId) {
    q = q.eq("workflow_id", workflowId);
  } else {
    const ids = await visibleWorkflowIds(me);
    if (ids !== null) {
      if (ids.length === 0) return NextResponse.json({ runs: [] });
      q = q.in("workflow_id", ids);
    }
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data });
}

export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const workflowId = String(body.workflowId || "");
  if (!workflowId) return NextResponse.json({ error: "缺少 workflowId" }, { status: 400 });
  if (!(await canAccessWorkflow(workflowId, me))) {
    return NextResponse.json({ error: "工作流不存在或无权访问" }, { status: 404 });
  }
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
