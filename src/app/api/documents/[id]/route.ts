import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessWorkflow } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  const { data: doc } = await sb.from("documents").select("workflow_id").eq("id", id).maybeSingle();
  if (!doc || !(await canAccessWorkflow((doc as { workflow_id: string }).workflow_id, me))) {
    return NextResponse.json({ error: "文档不存在或无权访问" }, { status: 404 });
  }
  const { error } = await sb.from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
