import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

type Params = { params: Promise<{ id: string }> };

interface EpisodeRow {
  number: number;
  title: string;
  content: string;
}

function chapterHeading(ep: EpisodeRow): string {
  return ep.title ? `第 ${ep.number} 集 ${ep.title}` : `第 ${ep.number} 集`;
}

function bookTxt(title: string, episodes: EpisodeRow[]): string {
  const parts = [title, ""];
  for (const ep of episodes) {
    parts.push("", chapterHeading(ep), "", ep.content || "");
  }
  return parts.join("\n");
}

function bookMd(title: string, kind: string, episodes: EpisodeRow[]): string {
  const parts = [`# ${title}`, "", kind === "drama" ? "> 网剧剧本" : "> 长篇小说", ""];
  for (const ep of episodes) {
    parts.push(`## ${chapterHeading(ep)}`, "", ep.content || "", "");
  }
  return parts.join("\n");
}

function attachment(filename: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="export"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}

/**
 * GET 全书导出：
 *  - format=txt：合并 TXT（章节标题行可被起点/番茄作家助手自动分章）
 *  - format=md：Markdown 合订本
 *  - format=zip：平台包——每集一个 TXT（文件名带序号）+ 合并 TXT
 */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const format = req.nextUrl.searchParams.get("format") || "txt";
  const sb = getSupabase();
  const { data: project } = await sb
    .from("story_projects")
    .select("title, kind")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "作品不存在" }, { status: 404 });
  const proj = project as { title: string; kind: string };

  const { data: eps } = await sb
    .from("episodes")
    .select("number, title, content")
    .eq("project_id", id)
    .order("number", { ascending: true });
  const episodes = ((eps ?? []) as EpisodeRow[]).filter((e) => (e.content || "").trim());
  if (episodes.length === 0) {
    return NextResponse.json({ error: "还没有任何已写完的剧集可导出" }, { status: 400 });
  }

  if (format === "md") {
    return new NextResponse(bookMd(proj.title, proj.kind, episodes), {
      headers: attachment(`${proj.title}.md`, "text/markdown; charset=utf-8"),
    });
  }
  if (format === "zip") {
    const zip = new JSZip();
    for (const ep of episodes) {
      const name = `${String(ep.number).padStart(3, "0")}-${chapterHeading(ep)}.txt`.replace(/[/\\:*?"<>|]/g, "_");
      zip.file(name, `${chapterHeading(ep)}\n\n${ep.content}`);
    }
    zip.file(`${proj.title}-全本.txt`, bookTxt(proj.title, episodes));
    zip.file("说明.txt", "导入起点/番茄作家助手时，可直接选择「全本」文件按章节自动拆分，或逐个导入单集文件。\n");
    const buf = await zip.generateAsync({ type: "uint8array" });
    return new NextResponse(Buffer.from(buf), {
      headers: attachment(`${proj.title}-平台导出包.zip`, "application/zip"),
    });
  }
  return new NextResponse(bookTxt(proj.title, episodes), {
    headers: attachment(`${proj.title}.txt`, "text/plain; charset=utf-8"),
  });
}
