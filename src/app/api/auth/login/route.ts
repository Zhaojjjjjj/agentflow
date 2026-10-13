import { NextResponse } from "next/server";
import {
  createSession,
  isJwtConfigured,
  isLoginConfigured,
  isProduction,
  sessionCookieAttrs,
  clearCookieAttrs,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { ensureSeeded, getUserByUsername } from "@/lib/users";
import { CAPTCHA_COOKIE, verifyCode } from "@/lib/captcha";

export const dynamic = "force-dynamic";

/** Multi-user login: verifies captcha + credentials against the users table. */
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
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const captcha = typeof body.captcha === "string" ? body.captcha : "";

  // 先验验证码（防爆破），再验账号密码
  const cookieHeader = req.headers.get("cookie") || "";
  const captchaToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CAPTCHA_COOKIE}=`))
    ?.slice(CAPTCHA_COOKIE.length + 1);
  const captchaOk = await verifyCode(captcha, captchaToken ? decodeURIComponent(captchaToken) : null);
  if (!captchaOk) {
    return NextResponse.json({ error: "验证码错误或已过期", captcha: true }, { status: 400 });
  }
  if (!username || !password) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  try {
    await ensureSeeded();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "初始化用户表失败" },
      { status: 503 }
    );
  }

  // Generic message never reveals whether the username exists.
  const user = await getUserByUsername(username).catch(() => null);
  const ok = user && (await verifyPassword(password, user.password_hash));
  if (!ok || !user) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const token = await createSession({ id: user.id, username: user.username, role: user.role });
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role, avatar_url: user.avatar_url },
  });
  const { name, ...attrs } = sessionCookieAttrs({ secure: isProduction() });
  res.cookies.set(name, token, attrs);
  // 验证码一次性使用：登录成功后清除
  const { name: cn, ...cattrs } = clearCookieAttrs({ secure: isProduction() });
  res.cookies.set(cn, "", cattrs);
  return res;
}
