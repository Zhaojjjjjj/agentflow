import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** GET 单集导出：format=txt | md */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const format = req.nextUrl.searchParams.get("format") || "txt";
  const sb = getSupabase();
  const { data: ep } = await sb
    .from("episodes")
    .select("number, title, content")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  if (!ep) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  const row = ep as { number: number; title: string; content: string };
  if (!row.content) return NextResponse.json({ error: "本集还没有正文" }, { status: 400 });

  const heading = row.title ? `第 ${row.number} 集 ${row.title}` : `第 ${row.number} 集`;
  const body = format === "md" ? `## ${heading}\n\n${row.content}` : `${heading}\n\n${row.content}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": format === "md" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="export"; filename*=UTF-8''${encodeURIComponent(`${heading}.${format}`)}`,
    },
  });
}
