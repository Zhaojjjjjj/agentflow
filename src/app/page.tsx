"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import Modal from "@/components/Modal";
import {
  PageHeader,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  EmptyState,
  Skeleton,
  ConfirmDialog,
} from "@/components/ui";
import { toast } from "@/components/toast";

interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  is_published: boolean;
  schedule_enabled: boolean;
  schedule_cron: string | null;
  updated_at: string;
}

interface Health {
  supabase: boolean;
  redis: boolean;
  inngest: boolean;
  llmProviders?: string[];
  embeddings: boolean;
}

function StatusDot({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-500" : warn ? "bg-amber-500" : "bg-slate-300"}`}
      />
      {label}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [nameError, setNameError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [wRes, hRes] = await Promise.all([fetch("/api/workflows"), fetch("/api/health")]);
      if (!wRes.ok || !hRes.ok) throw new Error("请求失败");
      const [w, h] = await Promise.all([wRes.json(), hRes.json()]);
      if (w.workflows) setWorkflows(w.workflows);
      setHealth(h);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setNewName("");
    setNewDesc("");
    setNameError("");
    setCreateOpen(true);
  };

  const create = async () => {
    if (!newName.trim()) {
      setNameError("名称不能为空");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.id) throw new Error(j.error || "创建失败");
      toast.success("工作流已创建");
      setCreateOpen(false);
      router.push(`/workflows/${j.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("已删除");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteName = workflows.find((w) => w.id === deleteId)?.name || "";
  const llmProviders = health?.llmProviders || [];

  return (
    <>
      <TopNav />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="工作流"
          desc="可视化 AI Agent 工作流编排与执行"
          actions={
            <Button variant="primary" onClick={openCreate}>
              新建工作流
            </Button>
          }
        />

        {/* 服务状态条 */}
        {health && (
          <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <StatusDot ok={health.supabase} label={`Supabase ${health.supabase ? "已连接" : "未配置"}`} />
            <StatusDot ok={health.redis} label={`Redis ${health.redis ? "已连接" : "未配置（已降级）"}`} />
            <StatusDot ok={health.inngest} warn={!health.inngest} label={`Inngest ${health.inngest ? "已配置" : "未配置（仅同步模式）"}`} />
            <StatusDot
              ok={llmProviders.length > 0}
              label={`LLM ${llmProviders.length > 0 ? llmProviders.join("、") : "未配置"}`}
            />
            <StatusDot ok={health.embeddings} label={`Embeddings ${health.embeddings ? "已配置" : "未配置"}`} />
          </div>
        )}

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">加载失败：{loadError}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
              重试
            </Button>
          </div>
        ) : loading ? (
          <div className="card">
            <Skeleton rows={4} />
          </div>
        ) : workflows.length === 0 ? (
          <div className="card">
            <EmptyState
              title="还没有工作流"
              description="创建一个工作流，拖拽节点即可编排出 AI Agent 应用"
              action={
                <Button variant="primary" onClick={openCreate}>
                  新建工作流
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workflows.map((w) => (
              <div
                key={w.id}
                className="card p-4 transition-shadow duration-150 hover:shadow-md"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Link
                    href={`/workflows/${w.id}`}
                    className="truncate font-medium text-slate-900 hover:text-brand-600"
                  >
                    {w.name}
                  </Link>
                  {w.is_published && <Badge tone="green">已发布</Badge>}
                  {w.schedule_enabled && (
                    <Badge tone="purple" className="font-mono">
                      {w.schedule_cron}
                    </Badge>
                  )}
                </div>
                {w.description && (
                  <p className="mb-2 line-clamp-2 text-sm text-slate-500">{w.description}</p>
                )}
                <p className="mb-3 text-xs text-slate-400">
                  v{w.version} · 更新于 {new Date(w.updated_at).toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/workflows/${w.id}`}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100"
                  >
                    编辑
                  </Link>
                  <Link
                    href={`/workflows/${w.id}/runs`}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100"
                  >
                    运行历史
                  </Link>
                  <button
                    className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors duration-150 hover:bg-red-50"
                    onClick={() => setDeleteId(w.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建工作流 */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建工作流">
        <Field label="名称" required error={nameError || undefined}>
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (e.target.value.trim()) setNameError("");
            }}
            placeholder="例如：客服问答助手"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </Field>
        <Field label="描述" hint="可选，一句话说明这个工作流的用途">
          <Textarea
            rows={3}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="例如：基于知识库的客服问答，含人工兜底"
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={creating} onClick={() => void create()}>
            {creating ? "创建中…" : "创建"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除工作流"
        description={`确定删除「${deleteName}」吗？运行记录将一并删除，此操作不可恢复。`}
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
