import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// ---- 拦截规则 ----
// 页面：控制台页面（`/` 为公开落地页，不拦截）
const PAGE_PREFIXES = ["/workflows", "/runs", "/api-keys", "/settings"];
// 内部 API：控制台调用的全部数据接口
const API_PREFIXES = [
  "/api/workflows",
  "/api/runs",
  "/api/documents",
  "/api/api-keys",
  "/api/settings",
];
// ---- 放行规则 ----
// /login、/api/auth/*、/api/health、/api/inngest、/api/public/* 不在 matcher 中，天然放行。
// /api/inngest 靠 INNGEST_SIGNING_KEY 自有验签；/api/public/* 走 API Key 自有鉴权。

function isConsolePage(pathname: string): boolean {
  return PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isInternalApi(pathname: string): boolean {
  return API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const page = isConsolePage(pathname);
  const api = !page && isInternalApi(pathname);
  if (!page && !api) return NextResponse.next();

  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (api) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/workflows/:path*",
    "/runs/:path*",
    "/api-keys/:path*",
    "/settings/:path*",
    "/api/workflows/:path*",
    "/api/runs/:path*",
    "/api/documents/:path*",
    "/api/api-keys/:path*",
    "/api/settings/:path*",
  ],
};
