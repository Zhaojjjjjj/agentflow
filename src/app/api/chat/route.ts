import { NextRequest } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";
import { getChatModelConfig } from "@/lib/appSettings";
import {
  chatStream,
  getChatProvidersPreferred,
  type ChatMessage,
} from "@/lib/llm/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HISTORY_LIMIT = 20;

/** POST /api/chat — send a message, stream the assistant reply (SSE). */
export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return new Response(JSON.stringify({ error: "消息不能为空" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (message.length > 8000) {
    return new Response(JSON.stringify({ error: "消息过长（最多 8000 字）" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = getSupabase();
  let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;

  // 新对话：先建会话
  if (conversationId) {
    const { data } = await sb
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", me.id)
      .maybeSingle();
    if (!data) {
      return new Response(JSON.stringify({ error: "对话不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    const { data, error } = await sb
      .from("chat_conversations")
      .insert({ user_id: me.id, title: message.slice(0, 24) || "新的对话" })
      .select("id")
      .single();
    if (error || !data) {
      return new Response(JSON.stringify({ error: "创建对话失败" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    conversationId = data.id;
  }

  // 存用户消息
  await sb.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  // 取历史上下文
  const { data: history } = await sb
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  const cfg = await getChatModelConfig();
  const llmMessages: ChatMessage[] = [
    { role: "system", content: cfg.systemPrompt },
    ...((history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) as ChatMessage[]),
  ];
  const providers = await getChatProvidersPreferred(cfg.providerName);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true; // 客户端已断开（点了停止/关页面），后面的只入库不推送
        }
      };
      send("conversation", JSON.stringify({ conversationId }));
      let full = "";
      try {
        await chatStream(
          llmMessages,
          { model: cfg.model ?? undefined, temperature: 0.7, maxTokens: 2048 },
          {
            onToken: (delta) => {
              full += delta;
              send("token", JSON.stringify({ delta }));
            },
          },
          providers
        );
      } catch (e) {
        send("error", JSON.stringify({ error: e instanceof Error ? e.message : "对话失败" }));
      }
      // 无论客户端是否断开，有内容就入库（点了"停止"的部分回答也保留）
      if (full) {
        await sb.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: full,
        });
        await sb
          .from("chat_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
      send("done", JSON.stringify({}));
      try {
        controller.close();
      } catch {
        /* 已断开 */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
