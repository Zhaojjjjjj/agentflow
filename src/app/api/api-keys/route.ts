import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { mintApiKey } from "@/lib/engine/runService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  let q = sb
    .from("api_keys")
    .select("id, name, key_prefix, workflow_id, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (workflowId) q = q.eq("workflow_id", workflowId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const workflowId = String(body.workflowId || "");
  const name = String(body.name || "默认").slice(0, 80);
  if (!workflowId) return NextResponse.json({ error: "缺少 workflowId" }, { status: 400 });
  try {
    const { id, key, prefix } = await mintApiKey(workflowId, name);
    // key is shown only once — the UI must display it immediately
    return NextResponse.json({ id, key, prefix });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
