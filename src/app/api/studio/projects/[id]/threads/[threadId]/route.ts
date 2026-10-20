import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

type Params = { params: Promise<{ id: string; threadId: string }> };

/** PATCH 编辑伏笔（描述/状态 open/resolved） */
export async function PATCH(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, threadId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.description !== undefined) patch.description = String(body.description);
  if (body.status === "open" || body.status === "resolved") patch.status = body.status;
  if (typeof patch.description === "string" && !patch.description.trim()) {
    return NextResponse.json({ error: "伏笔内容不能为空" }, { status: 400 });
  }
  const sb = getSupabase();
  const { error } = await sb.from("plot_threads").update(patch).eq("id", threadId).eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE 删除伏笔 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, threadId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { error } = await sb.from("plot_threads").delete().eq("id", threadId).eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
