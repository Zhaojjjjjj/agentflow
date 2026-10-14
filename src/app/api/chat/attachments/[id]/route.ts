import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Download a chat attachment (must belong to my conversation). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  const { data: att } = await sb.from("chat_attachments").select("*").eq("id", id).maybeSingle();
  if (!att) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  const { data: conv } = await sb
    .from("chat_conversations")
    .select("id")
    .eq("id", att.conversation_id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  return new Response(att.content_text, {
    headers: {
      "Content-Type": att.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
    },
  });
}
