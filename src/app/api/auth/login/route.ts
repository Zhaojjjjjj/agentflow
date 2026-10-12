import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import {
  createSession,
  getAdminUsername,
  isJwtConfigured,
  isLoginConfigured,
  isProduction,
  sessionCookieAttrs,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Compare in constant time (hash first so unequal lengths don't leak). */
function safeEqual(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!isLoginConfigured()) {
    return NextResponse.json(
      { error: "未配置 ADMIN_PASSWORD，请在环境变量中设置后再登录" },
      { status: 503 }
    );
  }
  if (!isJwtConfigured()) {
    return NextResponse.json(
      { error: "未配置 AUTH_SECRET（或 APP_ENCRYPTION_KEY），无法签发会话" },
      { status: 503 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  // Verify both fields; generic message never reveals which one was wrong.
  const ok =
    username.length > 0 &&
    password.length > 0 &&
    safeEqual(username, getAdminUsername()) &&
    safeEqual(password, process.env.ADMIN_PASSWORD!);
  if (!ok) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }
  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  const { name, ...attrs } = sessionCookieAttrs({ secure: isProduction() });
  res.cookies.set(name, token, attrs);
  return res;
}
