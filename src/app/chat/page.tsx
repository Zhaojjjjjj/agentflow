"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopNav from "@/components/TopNav";
import Logo from "@/components/Logo";
import { useMe } from "@/components/UserMenu";
import { Markdown, Skeleton } from "@/components/ui";
import { toast } from "@/components/toast";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

/** AI 助手 —— Web 端问答入口 */
const CHAT_NAME = "Af";

const SUGGESTION_POOL = [
  "帮我写一段工作周报",
  "解释一下什么是 RAG",
  "给我 3 个提高工作效率的建议",
  "用一句话讲清楚什么是 Agent",
  "帮我润色这段自我介绍",
  "推荐 5 本值得读的技术书",
  "写一个 Python 快速排序",
  "怎么用一句话介绍我的项目",
  "帮我想一个产品 slogan",
  "解释一下 SSE 和 WebSocket 的区别",
  "给我今天的工作计划建议",
  "什么是 prompt 工程，有哪些技巧",
];

/** 内置兜底：数据库题目池为空（或迁移未执行）时用 */
const FALLBACK_POOL = SUGGESTION_POOL;

function pickSuggestions(pool: string[], n: number): string[] {
  const rest = [...pool];
  const out: string[] = [];
  while (out.length < n && rest.length > 0) {
    const i = Math.floor(Math.random() * rest.length);
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

function parseSSE(chunk: string): { event: string; data: string }[] {
  const out: { event: string; data: string }[] = [];
  for (const block of chunk.split("\n\n")) {
    const lines = block.split("\n");
    let event = "";
    let data = "";
    for (const l of lines) {
      if (l.startsWith("event:")) event = l.slice(6).trim();
      else if (l.startsWith("data:")) data += l.slice(5).trim();
    }
    if (event) out.push({ event, data });
  }
  return out;
}

export default function ChatPage() {
  const me = useMe();
  const displayName = me?.nickname || me?.username || "";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // 历史加载
  const [streaming, setStreaming] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 每次回到空态（新对话）都重新随机抽 3 个推荐问题
  const [suggestSeed, setSuggestSeed] = useState(0);
  const [pool, setPool] = useState<string[]>(FALLBACK_POOL);
  const suggestions = useMemo(() => pickSuggestions(pool, 3), [pool, suggestSeed]);

  // 题目池每天由 AI 刷新一批，这里取当天的；取不到就用内置兜底
  useEffect(() => {
    fetch("/api/chat/suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.suggestions?.length > 0) setPool(j.suggestions);
      })
      .catch(() => {});
  }, []);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [messages, scrollBottom]);

  const loadList = useCallback(async () => {
    try {
      const j = await fetch("/api/chat/conversations").then((r) => r.json());
      if (j.error) throw new Error(j.error);
      setConversations(j.conversations || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载对话列表失败");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openConversation = useCallback(async (id: string) => {
    setCurrentId(id);
    setLoading(true);
    setMessages([]);
    try {
      const j = await fetch(`/api/chat/conversations/${id}`).then((r) => r.json());
      if (j.error) throw new Error(j.error);
      setMessages(j.messages || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载对话失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setCurrentId(null);
    setMessages([]);
    setStreaming(false);
    setSuggestSeed((s) => s + 1);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!confirm("确定删除这个对话吗？")) return;
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "删除失败");
        setConversations((cs) => cs.filter((c) => c.id !== id));
        if (currentId === id) newChat();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    },
    [currentId, newChat]
  );

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || streaming) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const userMsg: Message = { id: `tmp-u-${Date.now()}`, role: "user", content };
      const aiMsg: Message = { id: `tmp-a-${Date.now()}`, role: "assistant", content: "" };
      setMessages((ms) => [...ms, userMsg, aiMsg]);
      setInput("");
      setStreaming(true);

      let convId = currentId;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, message: content }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "请求失败");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const idx = buf.lastIndexOf("\n\n");
          if (idx < 0) continue;
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const { event, data } of parseSSE(chunk)) {
            if (event === "conversation") {
              const cid = JSON.parse(data).conversationId as string;
              if (!convId) {
                convId = cid;
                setCurrentId(cid);
                void loadList();
              }
            } else if (event === "token") {
              acc += (JSON.parse(data).delta as string);
              setMessages((ms) => ms.map((m) => (m.id === aiMsg.id ? { ...m, content: acc } : m)));
            } else if (event === "error") {
              throw new Error((JSON.parse(data).error as string) || "对话失败");
            }
          }
        }
        // 流结束后刷新列表标题
        void loadList();
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "对话失败";
        setMessages((ms) =>
          ms.map((m) =>
            m.id === aiMsg.id ? { ...m, content: m.content || `出错了：${msg}` } : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [input, streaming, currentId, loadList]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      <TopNav />
      <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl">
        {/* 对话列表 */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/70 py-4 md:flex">
          <div className="px-4 pb-3">
            <button
              onClick={newChat}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              ＋ 新对话
            </button>
          </div>
          <div className="chat-scroll flex-1 overflow-y-auto px-2">
            {listLoading ? (
              <Skeleton rows={4} />
            ) : conversations.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">还没有对话</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    c.id === currentId ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <button onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 truncate text-left">
                    {c.title}
                  </button>
                  <button
                    onClick={() => void deleteConversation(c.id)}
                    title="删除"
                    className="hidden shrink-0 rounded p-1 text-slate-300 hover:text-red-500 group-hover:block"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <path d="M3 4.5h10M6.5 4V2.8h3V4M4.5 4.5l.7 9h5.6l.7-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* 主对话区 */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2.5 border-b border-slate-200/70 px-6 py-3">
            <Logo size={24} />
            <h1 className="text-sm font-semibold text-slate-800">{CHAT_NAME}</h1>
          </header>
          <div className="chat-scroll flex-1 overflow-y-auto px-6 py-6">
            {loading ? (
              <Skeleton rows={5} />
            ) : messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                <p className="text-3xl font-semibold tracking-tight text-slate-900">
                  Hi{displayName ? `，${displayName}` : ""} 👋
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  我是你的 AI 助手，有什么可以帮你的？
                </p>
                <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-3">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      disabled={streaming}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-[13px] text-slate-600 transition-all hover:border-brand-300 hover:shadow-sm disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm leading-6 text-white">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex gap-3">
                      <span className="mt-0.5 shrink-0">
                        <Logo size={28} />
                      </span>
                      <div className="markdown-body min-w-0 max-w-[90%] flex-1 rounded-2xl rounded-tl-md bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800">
                        {m.content ? (
                          <Markdown text={m.content} />
                        ) : (
                          <span className="inline-flex gap-1 py-2">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="border-t border-slate-200/70 bg-white px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition-colors focus-within:border-brand-400">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行…"
                  className="max-h-36 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                {streaming ? (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    title="停止"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-900"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="3" width="10" height="10" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim()}
                    title="发送"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8.5 14.5 2 9 14.5 7.2 9.3 2 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                对话由管理员配置的模型驱动 · 内容仅保存在你的账号下
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
