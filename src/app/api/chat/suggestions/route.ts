import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getTodaySuggestions } from "@/lib/chatSuggestions";

export const dynamic = "force-dynamic";

/** 今天的推荐问题池（为空则前端用内置兜底） */
export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  try {
    const suggestions = await getTodaySuggestions();
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
