import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { setUserPassword } from "@/lib/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Admin: reset a user's password. */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }
  try {
    await setUserPassword(id, password);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "重置失败" }, { status: 400 });
  }
}
