import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function ownConversation(sb: ReturnType<typeof getSupabase>, id: string, userId: string) {
  const { data } = await sb
    .from("chat_conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Get messages of one conversation. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  if (!(await ownConversation(sb, id, me.id))) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 });
  }
  const { data, error } = await sb
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

/** Delete a conversation (messages cascade). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  if (!(await ownConversation(sb, id, me.id))) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 });
  }
  const { error } = await sb.from("chat_conversations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
