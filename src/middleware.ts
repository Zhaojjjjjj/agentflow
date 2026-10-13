import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionClaims } from "@/lib/auth";

// ---- 拦截规则 ----
// 页面：控制台页面（`/` 为公开落地页，不拦截）
const PAGE_PREFIXES = ["/workflows", "/runs", "/api-keys", "/settings", "/admin", "/account"];
// 内部 API：控制台调用的全部数据接口
const API_PREFIXES = [
  "/api/workflows",
  "/api/runs",
  "/api/documents",
  "/api/api-keys",
  "/api/settings",
  "/api/admin",
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/account",
];
// ---- 管理员专属 ----
// LLM 供应商配置归 admin 所有、普通用户共用；数据统计与用户管理归 admin
const ADMIN_PAGE_PREFIXES = ["/settings", "/admin"];
const ADMIN_API_PREFIXES = ["/api/settings", "/api/admin"];
// ---- 放行规则 ----
// /login、/api/auth/login、/api/auth/logout、/api/health、/api/inngest、/api/public/* 不在 matcher 中，天然放行。
// /api/inngest 靠 INNGEST_SIGNING_KEY 自有验签；/api/public/* 走 API Key 自有鉴权。

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const page = startsWithAny(pathname, PAGE_PREFIXES);
  const api = !page && startsWithAny(pathname, API_PREFIXES);
  if (!page && !api) return NextResponse.next();

  const claims = await getSessionClaims(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) {
    if (api) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // /api/settings 的 GET（供应商列表，密钥已脱敏）允许所有登录用户读取，写操作仅管理员
  const settingsReadOnly = pathname.startsWith("/api/settings") && req.method === "GET";
  const adminOnly =
    (startsWithAny(pathname, ADMIN_PAGE_PREFIXES) || startsWithAny(pathname, ADMIN_API_PREFIXES)) &&
    !settingsReadOnly;
  if (adminOnly && claims.role !== "admin") {
    if (api) return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    const home = req.nextUrl.clone();
    home.pathname = "/workflows";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/workflows/:path*",
    "/runs/:path*",
    "/api-keys/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/api/workflows/:path*",
    "/api/runs/:path*",
    "/api/documents/:path*",
    "/api/api-keys/:path*",
    "/api/settings/:path*",
    "/api/admin/:path*",
    "/api/auth/me",
    "/api/auth/change-password",
    "/api/account/:path*",
  ],
};
