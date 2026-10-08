"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

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
  llmProviders: string[];
  embeddings: boolean;
}

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [name, setName] = useState("");

  const load = async () => {
    const [w, h] = await Promise.all([fetch("/api/workflows").then((r) => r.json()), fetch("/api/health").then((r) => r.json())]);
    if (w.workflows) setWorkflows(w.workflows);
    setHealth(h);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "未命名工作流" }),
    });
    const j = await res.json();
    if (j.id) window.location.href = `/workflows/${j.id}`;
  };

  const remove = async (id: string, n: string) => {
    if (!confirm(`删除工作流「${n}」？运行记录将一并删除。`)) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="agentflow"
        desc="可视化 AI Agent 工作流编排与执行平台"
        actions={<a className="btn-secondary" href="/api-keys">API Keys</a>}
      />

      {health && (
        <div className="card mb-6 flex flex-wrap gap-2 p-4 text-xs">
          <span className={`badge ${health.supabase ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            Supabase {health.supabase ? "已连接" : "未配置"}
          </span>
          <span className={`badge ${health.redis ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            Redis {health.redis ? "已连接" : "未配置（已降级）"}
          </span>
          <span className={`badge ${health.inngest ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            Inngest {health.inngest ? "已配置" : "未配置（仅同步模式）"}
          </span>
          <span className={`badge ${health.llmProviders.length ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            LLM: {health.llmProviders.length ? health.llmProviders.join(", ") : "未配置"}
          </span>
          <span className={`badge ${health.embeddings ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            Embeddings {health.embeddings ? "已配置" : "未配置"}
          </span>
        </div>
      )}

      <div className="card mb-6 flex gap-2 p-4">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新工作流名称"
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="btn-primary whitespace-nowrap" onClick={create}>+ 新建工作流</button>
      </div>

      <div className="card divide-y divide-slate-100">
        {workflows.map((w) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a href={`/workflows/${w.id}`} className="truncate font-medium hover:text-brand-600">
                  {w.name}
                </a>
                {w.is_published && <span className="badge bg-green-100 text-green-700">已发布</span>}
                {w.schedule_enabled && (
                  <span className="badge bg-violet-100 text-violet-700 font-mono">⏰ {w.schedule_cron}</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                v{w.version} · 更新于 {new Date(w.updated_at).toLocaleString()}
              </div>
            </div>
            <a className="btn-secondary" href={`/workflows/${w.id}/runs`}>运行历史</a>
            <a className="btn-secondary" href={`/workflows/${w.id}`}>编辑</a>
            <button className="btn-danger" onClick={() => remove(w.id, w.name)}>删除</button>
          </div>
        ))}
        {workflows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            还没有工作流，新建一个开始编排吧
          </p>
        )}
      </div>
    </div>
  );
}
