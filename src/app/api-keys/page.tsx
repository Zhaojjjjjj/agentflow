"use client";

import { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";
import Modal from "@/components/Modal";
import {
  PageHeader,
  Button,
  Field,
  Input,
  Select,
  EmptyState,
  Skeleton,
  ConfirmDialog,
} from "@/components/ui";
import { toast } from "@/components/toast";

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  workflow_id: string;
  created_at: string;
  last_used_at: string | null;
}

interface Workflow {
  id: string;
  name: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowId, setWorkflowId] = useState("");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [k, w] = await Promise.all([
        fetch("/api/api-keys").then((r) => r.json()),
        fetch("/api/workflows").then((r) => r.json()),
      ]);
      if (k.keys) setKeys(k.keys);
      if (w.workflows) {
        setWorkflows(w.workflows);
        if (!workflowId && w.workflows.length) setWorkflowId(w.workflows[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setName("");
    setNameError("");
    setModalOpen(true);
  };

  const create = async () => {
    if (!workflowId) {
      toast.error("请先创建一个工作流");
      return;
    }
    if (!name.trim()) {
      setNameError("备注名不能为空");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, name: name.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "创建失败");
      setNewKey(j.key);
      setModalOpen(false);
      toast.success("API Key 已生成");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(newKey);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("已删除");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const wfName = (id: string) => workflows.find((w) => w.id === id)?.name || id.slice(0, 8);
  const deleteName = keys.find((k) => k.id === deleteId)?.name || "";

  return (
    <>
      <TopNav />
      <div className="mx-auto max-w-4xl px-6 py-8">
        <PageHeader
          title="API Keys"
          desc="用于 POST /api/public/workflows/[id]/run 的鉴权"
          actions={
            <Button variant="primary" onClick={openCreate}>
              生成 Key
            </Button>
          }
        />

        {newKey && (
          <div className="card mb-5 border-amber-200 bg-amber-50 p-4">
            <p className="mb-1.5 text-sm font-semibold text-amber-700">请立即复制，关闭后不再显示：</p>
            <code className="break-all font-mono text-sm text-slate-700">{newKey}</code>
            <div className="mt-2.5 flex gap-2">
              <Button size="sm" variant="secondary" onClick={copyKey}>
                一键复制
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewKey("")}>
                我已保存
              </Button>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <Skeleton rows={3} />
          ) : keys.length === 0 ? (
            <EmptyState
              title="暂无 API Key"
              description="生成 Key 后，即可通过 HTTP API 触发已发布的工作流"
              action={
                <Button variant="primary" onClick={openCreate}>
                  生成 Key
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">
                      {k.name}{" "}
                      <span className="font-mono text-xs text-slate-400">{k.key_prefix}…</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {wfName(k.workflow_id)} · 创建于 {new Date(k.created_at).toLocaleString()}
                      {k.last_used_at && ` · 上次使用 ${new Date(k.last_used_at).toLocaleString()}`}
                    </div>
                  </div>
                  <button
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors duration-150 hover:bg-red-50"
                    onClick={() => setDeleteId(k.id)}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 新建 Key */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="生成 API Key">
        <Field label="工作流">
          <Select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="备注名" required error={nameError || undefined}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError("");
            }}
            placeholder="例如：生产环境调用"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={creating} onClick={() => void create()}>
            {creating ? "生成中…" : "生成"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除 API Key"
        description={`确定删除「${deleteName}」吗？使用该 Key 的调用将立即失效。`}
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
