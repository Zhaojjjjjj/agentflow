import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

type Params = { params: Promise<{ id: string }> };

/** GET 连读数据：全部有正文的剧集（按集号）+ 总字数 */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const [{ data: project }, { data: eps }] = await Promise.all([
    sb.from("story_projects").select("title, kind, genre").eq("id", id).single(),
    sb
      .from("episodes")
      .select("id, number, title, content, word_count, status")
      .eq("project_id", id)
      .order("number", { ascending: true }),
  ]);
  if (!project) return NextResponse.json({ error: "作品不存在" }, { status: 404 });
  const episodes = (eps ?? []).filter(
    (e) => ((e as { content: string }).content || "").trim()
  );
  const totalWords = episodes.reduce(
    (sum, e) => sum + ((e as { word_count: number }).word_count || 0),
    0
  );
  return NextResponse.json({ project, episodes, totalWords });
}
