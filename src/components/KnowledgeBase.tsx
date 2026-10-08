"use client";

import { useEffect, useState } from "react";

interface Doc {
  id: string;
  content: string;
  created_at: string;
}

export default function KnowledgeBase({
  workflowId,
  open,
  onClose,
}: {
  workflowId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch(`/api/documents?workflowId=${workflowId}`);
    const j = await res.json();
    if (j.documents) setDocs(j.documents);
  };

  const add = async () => {
    const chunks = text
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((content) => ({ content }));
    if (chunks.length === 0) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, chunks }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "上传失败");
      setMsg(`成功写入 ${j.inserted} 个 chunk${j.errors?.length ? `，${j.errors.length} 个失败` : ""}`);
      setText("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    await load();
  };

  useEffect(() => {
    if (open) {
      setDocs([]);
      load().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">知识库（RAG）</h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>✕</button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          粘贴文本（空行分隔为多个 chunk），将自动向量化存入 pgvector，供 rag-retrieve 节点检索。
        </p>
        <textarea
          className="input mb-2"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"第一段知识…\n\n第二段知识…"}
        />
        <div className="mb-4 flex items-center gap-3">
          <button className="btn-primary" disabled={busy || !text.trim()} onClick={add}>
            {busy ? "向量化中…" : "添加到知识库"}
          </button>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </div>
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="line-clamp-3 text-slate-700">{d.content}</p>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>{new Date(d.created_at).toLocaleString()}</span>
                <button className="text-red-500 hover:underline" onClick={() => remove(d.id)}>删除</button>
              </div>
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-slate-400">暂无文档</p>}
        </div>
      </div>
    </div>
  );
}
