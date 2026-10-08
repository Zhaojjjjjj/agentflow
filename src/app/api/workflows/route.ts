import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { emptyDefinition } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("workflows")
    .select("id, name, description, version, is_published, schedule_enabled, schedule_cron, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflows: data });
}

export async function POST(req: NextRequest) {
  const sb = getSupabase();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "未命名工作流").slice(0, 120);
  const { data, error } = await sb
    .from("workflows")
    .insert({
      name,
      description: String(body.description || ""),
      definition: body.definition || emptyDefinition(),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
