import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { inngest, EVENTS } from "@/lib/inngest";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Approve or reject a run that is paused at a human-approval node. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: runId } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision === "approved" ? "approved" : "rejected";
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 500) : "";

  const sb = getSupabase();
  const { data: waiting } = await sb
    .from("run_steps")
    .select("id, node_id")
    .eq("run_id", runId)
    .eq("status", "waiting_approval")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!waiting) {
    return NextResponse.json({ error: "没有等待审批的节点" }, { status: 400 });
  }

  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json({ error: "需要配置 INNGEST_EVENT_KEY" }, { status: 500 });
  }

  const nodeId = waiting.node_id as string;
  await inngest.send({
    name: EVENTS.APPROVAL_DECIDED,
    data: {
      runId,
      nodeId,
      approvalKey: `${runId}:${nodeId}`,
      decision,
      comment,
    },
  });
  return NextResponse.json({ ok: true, decision });
}
