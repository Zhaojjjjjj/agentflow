"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { Button, ConfirmDialog } from "./ui";
import { toast } from "./toast";

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // null = 检测中，true = 已配置向量供应商，false = 未配置
  const [embOk, setEmbOk] = useState<boolean | null>(null);

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
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, chunks }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "上传失败");
      toast.success(
        `成功写入 ${j.inserted} 个 chunk${j.errors?.length ? `，${j.errors.length} 个失败` : ""}`
      );
      setText("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("已删除");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (open) {
      setDocs([]);
      setEmbOk(null);
      load().catch(() => undefined);
      // 检测是否配置了向量供应商（embedding），未配置则显示引导横幅
      fetch("/api/settings/providers")
        .then((r) => r.json())
        .then((j) => {
          const list = Array.isArray(j.providers) ? j.providers : [];
          setEmbOk(list.some((p: { kind: string; enabled: boolean }) => p.kind === "embedding" && p.enabled));
        })
        .catch(() => setEmbOk(true)); // 接口异常时不误报
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Modal open={open} onClose={onClose} title="知识库（RAG）" wide>
        {embOk === false && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[13px] leading-6 text-amber-800">
              尚未配置向量供应商（embedding），文档无法向量化、检索也不可用。请先添加一个 embedding
              供应商（维度须为 1024）。
            </p>
            <a
              href="/settings"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
            >
              去设置
            </a>
          </div>
        )}
        <p className="mb-3 text-xs leading-5 text-slate-500">
          粘贴文本（空行分隔为多个 chunk），将自动向量化存入 pgvector，供 rag-retrieve 节点检索。
        </p>
        <textarea
          className="input mb-3"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"第一段知识…\n\n第二段知识…"}
        />
        <div className="mb-5">
          <Button variant="primary" disabled={busy || !text.trim()} onClick={add}>
            {busy ? "向量化中…" : "添加到知识库"}
          </Button>
        </div>
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="line-clamp-3 text-sm leading-6 text-slate-700">{d.content}</p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>{new Date(d.created_at).toLocaleString()}</span>
                <button
                  className="rounded-md px-1.5 py-0.5 text-red-500 transition-colors duration-150 hover:bg-red-50"
                  onClick={() => setDeleteId(d.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
          {docs.length === 0 && <p className="py-6 text-center text-sm text-slate-400">暂无文档</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除文档"
        description="确定删除这个知识库文档 chunk 吗？检索时将不再命中它。"
        confirmLabel="删除"
        danger
        onConfirm={() => {
          if (deleteId) void remove(deleteId);
        }}
        onClose={() => setDeleteId(null)}
      />
    </>
  );
}
