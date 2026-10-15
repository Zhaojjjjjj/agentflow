import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/studio/projects/[id]/threads — 伏笔列表（未回收在前） */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("plot_threads")
    .select("*")
    .eq("project_id", id)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ threads: data ?? [] });
}

/** POST /api/studio/projects/[id]/threads — 登记伏笔 */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const description = String(body.description ?? "").trim();
  if (!description) return NextResponse.json({ error: "请填写伏笔内容" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb
    .from("plot_threads")
    .insert({
      project_id: id,
      description: description.slice(0, 2000),
      planted_episode: body.planted_episode ? Number(body.planted_episode) : null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}
