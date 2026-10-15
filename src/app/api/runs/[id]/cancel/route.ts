import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessWorkflow } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ACTIVE = ["queued", "running", "waiting_approval"];

/** Manually end a stuck/active run (marks it cancelled). */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  const { data: run } = await sb
    .from("workflow_runs")
    .select("id, workflow_id, status")
    .eq("id", id)
    .single();
  if (!run) return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  if (!(await canAccessWorkflow((run as { workflow_id: string }).workflow_id, me))) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }
  if (!ACTIVE.includes((run as { status: string }).status)) {
    return NextResponse.json({ error: "运行已结束，无需手动结束" }, { status: 400 });
  }
  // 只在仍处于活跃状态时更新，避免与执行器收尾写库竞争
  const { error } = await sb
    .from("workflow_runs")
    .update({
      status: "cancelled",
      error: "用户手动结束运行",
      finished_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ACTIVE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
