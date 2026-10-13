import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { deleteUser } from "@/lib/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Admin: delete a user (cannot delete self or the last admin). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const { id } = await params;
  if (id === me.id) {
    return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  }
  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "删除失败" }, { status: 400 });
  }
}
