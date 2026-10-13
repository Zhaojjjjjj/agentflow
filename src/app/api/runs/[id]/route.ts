import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessWorkflow } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  const { data: run, error } = await sb.from("workflow_runs").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  if (!(await canAccessWorkflow((run as { workflow_id: string }).workflow_id, me))) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }
  const { data: steps } = await sb
    .from("run_steps")
    .select("id, node_id, node_type, node_name, status, tokens, cost_usd, duration_ms, error, input, output, started_at, finished_at, created_at")
    .eq("run_id", id)
    .order("created_at", { ascending: true });
  return NextResponse.json({ run, steps: steps || [] });
}
