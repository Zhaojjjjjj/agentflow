import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

type Params = { params: Promise<{ id: string; charId: string }> };

/** PATCH 编辑人物（姓名/定位/小传/当前状态） */
export async function PATCH(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, charId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "role", "profile", "current_state"] as const) {
    if (body[k] !== undefined) patch[k] = String(body[k]);
  }
  if (typeof patch.name === "string" && !patch.name.trim()) {
    return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  }
  const sb = getSupabase();
  const { error } = await sb.from("story_characters").update(patch).eq("id", charId).eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE 删除人物 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, charId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { error } = await sb.from("story_characters").delete().eq("id", charId).eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
