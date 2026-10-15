import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/studio/projects/[id]/episodes — 集列表（按集号正序） */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("episodes")
    .select("id, number, title, word_count, status, created_at, updated_at")
    .eq("project_id", id)
    .order("number", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ episodes: data ?? [] });
}

/** POST /api/studio/projects/[id]/episodes — 新建一集（草稿占位，number 自动取下一集） */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data: maxRow } = await sb
    .from("episodes")
    .select("number")
    .eq("project_id", id)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const number = ((maxRow as { number: number } | null)?.number ?? 0) + 1;
  const { data, error } = await sb
    .from("episodes")
    .insert({ project_id: id, number, title: `第 ${number} 集`, status: "draft" })
    .select("id, number")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
