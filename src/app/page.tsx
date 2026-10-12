import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import DashboardView from "./DashboardView";
import LandingPage from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";

/**
 * `/`：已登录渲染控制台 Dashboard，未登录渲染公开落地页。
 * （middleware 不再拦截 `/`，见 src/middleware.ts）
 */
export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const authed = await verifySession(token);
  return authed ? <DashboardView /> : <LandingPage />;
}
