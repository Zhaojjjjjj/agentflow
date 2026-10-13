import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { verifyPassword } from "@/lib/password";
import { getUserById, setUserPassword } from "@/lib/users";

export const dynamic = "force-dynamic";

/** Change own password (requires the old one). */
export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "请填写原密码和新密码" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 });
  }
  const user = await getUserById(me.id);
  if (!user || !(await verifyPassword(oldPassword, user.password_hash))) {
    return NextResponse.json({ error: "原密码不正确" }, { status: 400 });
  }
  try {
    await setUserPassword(me.id, newPassword);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "修改失败" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
