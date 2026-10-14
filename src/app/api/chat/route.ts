import { NextRequest } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";
import { getChatModelConfig } from "@/lib/appSettings";
import {
  chat,
  chatStream,
  getChatProvidersPreferred,
  type ChatMessage,
} from "@/lib/llm/providers";
import { chatToolDefs, executeChatSkill, CHAT_SKILL_LABELS } from "@/lib/chatSkills";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 2;

interface PendingAttachment {
  id: string;
  filename: string;
  mime: string;
  size: number;
  previewSvg: string | null;
  previewHtml: string | null;
}

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

  await sb.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  const { data: history } = await sb
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  const cfg = await getChatModelConfig();
  const roundMessages: ChatMessage[] = [
    { role: "system", content: cfg.systemPrompt },
    ...((history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) as ChatMessage[]),
  ];
  const providers = await getChatProvidersPreferred(cfg.providerName);
  const tools = chatToolDefs();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };
      send("conversation", JSON.stringify({ conversationId }));
      // 心跳保活：长耗时阶段每 15s 发一个 ping，防止代理掐掉空闲连接
      const keepalive = setInterval(() => send("ping", JSON.stringify({ t: Date.now() })), 15000);
      const pending: PendingAttachment[] = [];
      let full = "";

      try {
        send("status", JSON.stringify({ text: "正在理解你的问题" }));
        // ---- 技能调用阶段（非流式，最多 2 轮） ----
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          let toolRes;
          try {
            toolRes = await chat(
              roundMessages,
              { model: cfg.model ?? undefined, temperature: 0.7, maxTokens: 8192, tools },
              providers
            );
          } catch (e) {
            // 供应商不支持 tool-calling 时降级为纯文本对话
            const msg = e instanceof Error ? e.message : "";
            if (/tool/i.test(msg)) {
              toolRes = await chat(
                roundMessages,
                { model: cfg.model ?? undefined, temperature: 0.7, maxTokens: 8192 },
                providers
              );
            } else {
              throw e;
            }
          }
          if (!toolRes.toolCalls.length) break;
          // 把 assistant 的 tool_calls 记回上下文
          roundMessages.push({
            role: "assistant",
            content: toolRes.text || "",
            tool_calls: toolRes.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          });
          for (const tc of toolRes.toolCalls.slice(0, 2)) {
            const label = CHAT_SKILL_LABELS[tc.name] || "准备文件";
            send("status", JSON.stringify({ text: `正在${label}` }));
            try {
              const result = await executeChatSkill(tc.name, tc.arguments);
              const fileSummaries: string[] = [];
              for (const f of result.files) {
                const { data: att, error } = await sb
                  .from("chat_attachments")
                  .insert({
                    conversation_id: conversationId,
                    filename: f.filename,
                    mime_type: f.mime,
                    content_text: f.content,
                    preview_svg: f.previewSvg ?? null,
                    preview_html: f.previewHtml ?? null,
                    size_bytes: Buffer.byteLength(f.content, "utf8"),
                  })
                  .select("id")
                  .single();
                if (!error && att) {
                  pending.push({
                    id: att.id,
                    filename: f.filename,
                    mime: f.mime,
                    size: Buffer.byteLength(f.content, "utf8"),
                    previewSvg: f.previewSvg ?? null,
                    previewHtml: f.previewHtml ?? null,
                  });
                }
                fileSummaries.push(f.filename);
              }
              send("attachments", JSON.stringify({ attachments: pending.slice(-result.files.length) }));
              roundMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: `${result.summary}（文件：${fileSummaries.join("、")}）`,
              });
            } catch (e) {
              roundMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: `技能执行失败：${e instanceof Error ? e.message : String(e)}。请用文字向用户说明失败原因，不要重复调用。`,
              });
            }
          }
        }
      } catch (e) {
        clearInterval(keepalive);
        send("error", JSON.stringify({ error: e instanceof Error ? e.message : "对话失败" }));
        try {
          controller.close();
        } catch {
          /* 已断开 */
        }
        return;
      }

      // ---- 最终回答（流式） ----
      send("status", JSON.stringify({ text: "正在组织回答" }));
      try {
        await chatStream(
          roundMessages,
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
      } finally {
        clearInterval(keepalive);
      }
      if (full) {
        const { data: saved } = await sb
          .from("chat_messages")
          .insert({ conversation_id: conversationId, role: "assistant", content: full })
          .select("id")
          .single();
        if (saved && pending.length > 0) {
          await sb
            .from("chat_attachments")
            .update({ message_id: saved.id })
            .in("id", pending.map((p) => p.id));
        }
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
