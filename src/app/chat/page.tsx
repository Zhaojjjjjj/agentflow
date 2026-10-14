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
interface Attachment {
  id: string;
  filename: string;
  mime: string;
  size: number;
  previewSvg: string | null;
  previewHtml?: string | null;
}
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
}

const FALLBACK_POOL = [
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

function pickFrom(pool: string[], n: number): string[] {
  const rest = [...pool];
  const out: string[] = [];
  while (out.length < n && rest.length > 0) {
    out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
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

function fileIcon(filename: string) {
  if (filename.endsWith(".svg"))
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke="#7c3aed" strokeWidth="1.6" />
        <circle cx="7.5" cy="8" r="1.6" fill="#7c3aed" />
        <path d="M4 15l4-4 3 3 2.5-2.5L17 15" stroke="#7c3aed" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M5 2.5h6L15.5 7v10.5H5V2.5z" stroke="#7c3aed" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 2.5V7h4.5" stroke="#7c3aed" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 技能产出的文件卡片：预览 + 下载 */
function AttachmentCard({ att }: { att: Attachment }) {
  const [showPreview, setShowPreview] = useState(false);
  const previewKind = att.previewHtml ? "html" : att.previewSvg ? "svg" : null;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          {fileIcon(att.filename)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800">{att.filename}</p>
          <p className="text-[11px] text-slate-400">{formatSize(att.size)}</p>
        </div>
        {previewKind && (
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            {showPreview ? "收起预览" : "预览"}
          </button>
        )}
        <a
          href={`/api/chat/attachments/${att.id}`}
          download
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
        >
          下载
        </a>
      </div>
      {previewKind && showPreview && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4">
          {previewKind === "html" ? (
            /* allow-scripts：页面可交互；无 allow-same-origin，拿不到父页面和本地存储 */
            <iframe
              title={att.filename}
              sandbox="allow-scripts"
              srcDoc={att.previewHtml!}
              className="h-[480px] w-full rounded-xl border border-slate-200 bg-white"
            />
          ) : (
            <iframe
              title={att.filename}
              sandbox=""
              srcDoc={att.previewSvg!}
              className="max-h-[480px] w-full rounded-xl border border-slate-200 bg-white"
              style={{ minHeight: 240 }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      title="复制"
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
    >
      {ok ? (
        <>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          已复制
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5v5A1.5 1.5 0 0 0 4 10h1.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          复制
        </>
      )}
    </button>
  );
}

export default function ChatPage() {
  const me = useMe();
  const displayName = me?.nickname || me?.username || "";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [skillStatus, setSkillStatus] = useState<string | null>(null);
  const [thinkStart, setThinkStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(0);

  // 思考计时：流式进行中每秒刷新一次
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [streaming]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickRef = useRef(true); // 是否吸附在底部
  const [suggestSeed, setSuggestSeed] = useState(0);
  const [pool, setPool] = useState<string[]>(FALLBACK_POOL);
  const suggestions = useMemo(() => pickFrom(pool, 3), [pool, suggestSeed]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickRef.current = near;
    setShowJump(!near && messages.length > 0);
  }, [messages.length]);

  // 流式输出时：只有用户本来就贴着底部才跟随，避免把正在往上翻的人拽下来
  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  const autoGrow = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, []);

  useEffect(() => {
    fetch("/api/chat/suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.suggestions?.length > 0) setPool(j.suggestions);
      })
      .catch(() => {});
  }, []);

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
    stickRef.current = true;
    setShowJump(false);
    try {
      const j = await fetch(`/api/chat/conversations/${id}`).then((r) => r.json());
      if (j.error) throw new Error(j.error);
      setMessages(
        (j.messages || []).map(
          (m: { id: string; role: Message["role"]; content: string; attachments?: Record<string, unknown>[] }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            attachments: (m.attachments || []).map((a) => ({
              id: String(a.id),
              filename: String(a.filename),
              mime: String(a.mime_type ?? a.mime ?? ""),
              size: Number(a.size_bytes ?? a.size ?? 0),
              previewSvg: (a.preview_svg ?? a.previewSvg ?? null) as string | null,
              previewHtml: (a.preview_html ?? a.previewHtml ?? null) as string | null,
            })),
          })
        )
      );
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
    stickRef.current = true;
    setShowJump(false);
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
      requestAnimationFrame(() => {
        if (taRef.current) taRef.current.style.height = "auto";
      });
      stickRef.current = true;
      setShowJump(false);
      setStreaming(true);
      setSkillStatus("Luna 思考中…");
      setThinkStart(Date.now());
      setNowTick(Date.now());

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
              acc += JSON.parse(data).delta as string;
              setThinkStart(null);
              setMessages((ms) => ms.map((m) => (m.id === aiMsg.id ? { ...m, content: acc } : m)));
            } else if (event === "status") {
              setSkillStatus((JSON.parse(data).text as string) || null);
            } else if (event === "attachments") {
              const list = (JSON.parse(data).attachments || []) as Attachment[];
              if (list.length > 0) {
                setSkillStatus(null);
                setMessages((ms) =>
                  ms.map((m) =>
                    m.id === aiMsg.id
                      ? { ...m, attachments: [...(m.attachments || []), ...list] }
                      : m
                  )
                );
              }
            } else if (event === "error") {
              throw new Error((JSON.parse(data).error as string) || "对话失败");
            }
          }
        }
        void loadList();
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "对话失败";
        setMessages((ms) =>
          ms.map((m) => (m.id === aiMsg.id ? { ...m, content: m.content || `出错了：${msg}` } : m))
        );
      } finally {
        setStreaming(false);
        setSkillStatus(null);
        setThinkStart(null);
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
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98]"
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
                  className={`group mb-0.5 flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                    c.id === currentId
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <button onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 truncate text-left">
                    {c.title}
                  </button>
                  <button
                    onClick={() => void deleteConversation(c.id)}
                    title="删除"
                    className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
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
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} onScroll={onScroll} className="chat-scroll flex-1 overflow-y-auto px-6 py-8">
            {loading ? (
              <div className="mx-auto max-w-3xl">
                <Skeleton rows={5} />
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                <p className="msg-in text-[28px] font-semibold tracking-tight text-slate-900">
                  Hi{displayName ? `，${displayName}` : ""} 👋
                </p>
                <p className="msg-in mt-3 text-[15px] leading-6 text-slate-500" style={{ animationDelay: "60ms" }}>
                  我是 Luna，有什么可以帮你的？
                </p>
                <div className="msg-in mt-9 grid w-full gap-2.5 sm:grid-cols-3" style={{ animationDelay: "120ms" }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      disabled={streaming}
                      className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-left text-[13px] leading-5 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_6px_16px_rgba(124,58,237,0.10)] disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-7 pb-4">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="msg-in flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-lg bg-brand-600 px-4 py-2.5 text-[14px] leading-6 text-white shadow-[0_2px_8px_rgba(124,58,237,0.18)]">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="msg-in group flex gap-3.5">
                      <span className="mt-1 shrink-0 transition-transform duration-150">
                        <Logo size={26} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="markdown-body text-[14px] leading-7 text-slate-800">
                          {m.content ? (
                            <Markdown text={m.content} />
                          ) : skillStatus && streaming ? (
                            <span className="inline-flex items-center gap-2 py-2 text-[13px] text-slate-500">
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                              {skillStatus}
                              {thinkStart !== null && (
                                <span className="tabular-nums text-slate-400">
                                  {Math.max(1, Math.floor((nowTick - thinkStart) / 1000))}s
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 py-2">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300"
                                  style={{ animationDelay: `${i * 0.15}s` }}
                                />
                              ))}
                            </span>
                          )}
                          {streaming && m.content && (
                            <span className="stream-cursor ml-0.5 inline-block h-[15px] w-[7px] translate-y-[2px] rounded-[2px] bg-brand-500" />
                          )}
                        </div>
                        {(m.attachments?.length ?? 0) > 0 && (
                          <div className="max-w-xl space-y-2.5">
                            {m.attachments!.map((a) => (
                              <AttachmentCard key={a.id} att={a} />
                            ))}
                          </div>
                        )}
                        {m.content && !streaming && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <CopyButton text={m.content} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* 回到底部 */}
          <button
            onClick={() => scrollToBottom(true)}
            className={`absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-3 pr-3.5 text-xs text-slate-500 shadow-lg backdrop-blur transition-all duration-200 hover:text-slate-800 ${
              showJump ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10m0 0L4 9m4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            回到底部
          </button>

          {/* 输入区 */}
          <div className="border-t border-slate-200/60 bg-white/80 px-6 py-4 backdrop-blur">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-[20px] border border-slate-200 bg-white p-2 pl-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-all duration-150 focus-within:border-brand-400 focus-within:shadow-[0_2px_16px_rgba(124,58,237,0.12)]">
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoGrow();
                  }}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="问 Luna 点什么…"
                  className="chat-scroll max-h-[180px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                />
                {streaming ? (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    title="停止生成"
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white transition-all duration-150 hover:bg-slate-900 active:scale-95"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3.5" y="3.5" width="9" height="9" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim()}
                    title="发送"
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-all duration-150 hover:bg-brand-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M8 13V3m0 0L4 7m4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                Luna 由管理员配置的模型驱动 · 对话仅保存在你的账号下
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
