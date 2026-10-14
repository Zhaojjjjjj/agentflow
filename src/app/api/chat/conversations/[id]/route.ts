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

/** Get messages of one conversation (with attachments). */
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
  const msgIds = (data ?? []).map((m) => m.id);
  let attachments: { id: string; message_id: string; filename: string; mime_type: string; size_bytes: number; preview_svg: string | null }[] = [];
  if (msgIds.length > 0) {
    const { data: atts } = await sb
      .from("chat_attachments")
      .select("id, message_id, filename, mime_type, size_bytes, preview_svg")
      .in("message_id", msgIds)
      .order("created_at", { ascending: true });
    attachments = (atts ?? []) as typeof attachments;
  }
  const messages = (data ?? []).map((m) => ({
    ...m,
    attachments: attachments.filter((a) => a.message_id === m.id),
  }));
  return NextResponse.json({ messages });
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
