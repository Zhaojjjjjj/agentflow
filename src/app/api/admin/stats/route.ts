import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Admin: Studio 概览（用户 / 作品 / 集数 / 总字数）。 */
export async function GET(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  try {
    const sb = getSupabase();
    const [{ count: userCount }, { count: projectCount }, { data: episodes }] = await Promise.all([
      sb.from("users").select("id", { count: "exact", head: true }),
      sb.from("story_projects").select("id", { count: "exact", head: true }),
      sb.from("episodes").select("id, word_count, status"),
    ]);
    const epList = (episodes ?? []) as { word_count: number | null; status: string }[];
    return NextResponse.json({
      overview: {
        users: userCount ?? 0,
        projects: projectCount ?? 0,
        episodes: epList.length,
        published: epList.filter((e) => e.status === "published").length,
        words: epList.reduce((s, e) => s + (e.word_count ?? 0), 0),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "加载失败" }, { status: 500 });
  }
}
