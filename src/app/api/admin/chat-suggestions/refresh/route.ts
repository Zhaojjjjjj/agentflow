import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { refreshSuggestions } from "@/lib/chatSuggestions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Admin: 立即用 AI 重新生成今天的推荐问题池 */
export async function POST(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  try {
    const items = await refreshSuggestions();
    return NextResponse.json({ ok: true, count: items.length, suggestions: items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "生成失败" }, { status: 500 });
  }
}
