import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/studio/projects/[id]/characters — 人物卡列表 */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("story_characters")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ characters: data ?? [] });
}

/** POST /api/studio/projects/[id]/characters — 新建人物卡 */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "请填写人物姓名" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb
    .from("story_characters")
    .insert({
      project_id: id,
      name: name.slice(0, 40),
      role: String(body.role ?? "").slice(0, 40),
      profile: String(body.profile ?? "").slice(0, 5000),
      personality: String(body.personality ?? "").slice(0, 2000),
      relationships: String(body.relationships ?? "").slice(0, 2000),
      current_state: String(body.current_state ?? "").slice(0, 2000),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}
