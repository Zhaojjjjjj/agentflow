import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getUserById } from "@/lib/users";

export const dynamic = "force-dynamic";

/** Current logged-in user (used by TopNav, account page, role gates). */
export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const user = await getUserById(me.id).catch(() => null);
  if (!user) return unauthorized();
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      avatar_url: user.avatar_url,
    },
  });
}
