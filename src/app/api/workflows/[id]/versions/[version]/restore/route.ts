import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; version: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, version } = await params;
  const sb = getSupabase();
  const { data: snap } = await sb
    .from("workflow_versions")
    .select("definition")
    .eq("workflow_id", id)
    .eq("version", Number(version))
    .single();
  if (!snap) return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  const { data: cur } = await sb.from("workflows").select("version").eq("id", id).single();
  const nextVersion = ((cur?.version as number) || 0) + 1;
  const { error } = await sb
    .from("workflows")
    .update({ definition: snap.definition, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("workflow_versions").insert({
    workflow_id: id,
    version: nextVersion,
    definition: snap.definition,
    note: `从 v${version} 恢复`,
  });
  return NextResponse.json({ ok: true, version: nextVersion });
}
