import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** List my chat conversations (newest first). */
export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("chat_conversations")
    .select("id, title, updated_at")
    .eq("user_id", me.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

/** Start a new conversation. */
export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("chat_conversations")
    .insert({ user_id: me.id })
    .select("id, title, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}
