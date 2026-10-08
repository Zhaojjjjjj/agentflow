import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("workflow_versions")
    .select("id, version, note, created_at")
    .eq("workflow_id", id)
    .order("version", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = getSupabase();
  const body = await req.json().catch(() => ({}));
  const { data: wf } = await sb.from("workflows").select("definition").eq("id", id).single();
  if (!wf) return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  const { data: latest } = await sb
    .from("workflow_versions")
    .select("version")
    .eq("workflow_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  const nextVersion = ((latest?.version as number) || 0) + 1;
  const { data, error } = await sb
    .from("workflow_versions")
    .insert({
      workflow_id: id,
      version: nextVersion,
      definition: wf.definition,
      note: String(body.note || "手动快照"),
    })
    .select("id, version")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ version: data });
}
