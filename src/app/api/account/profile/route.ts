import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { setUserNickname } from "@/lib/users";

export const dynamic = "force-dynamic";

/** Update own nickname (display name shown in Chat greeting etc.). */
export async function PATCH(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (raw.length > 24) {
    return NextResponse.json({ error: "昵称不能超过 24 个字符" }, { status: 400 });
  }
  try {
    await setUserNickname(me.id, raw || null);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, nickname: raw || null });
}
