"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui";

interface Run {
  id: string;
  trigger: string;
  status: string;
  total_tokens: number;
  estimated_cost_usd: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export default function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const [workflowId, setWorkflowId] = useState("");
  const [name, setName] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    void params.then(async (p) => {
      setWorkflowId(p.id);
      const [w, r] = await Promise.all([
        fetch(`/api/workflows/${p.id}`).then((x) => x.json()),
        fetch(`/api/runs?workflowId=${p.id}`).then((x) => x.json()),
      ]);
      if (w.workflow) setName(w.workflow.name);
      if (r.runs) setRuns(r.runs);
    });
  }, [params]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title={`运行历史${name ? ` · ${name}` : ""}`}
        actions={<a className="btn-secondary" href={workflowId ? `/workflows/${workflowId}` : "/"}>返回编辑器</a>}
      />
      <div className="card divide-y divide-slate-100">
        {runs.map((r) => (
          <a key={r.id} href={`/runs/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
            <StatusBadge status={r.status} />
            <span className="font-mono text-xs text-slate-400">{r.id.slice(0, 8)}</span>
            <span className="badge bg-slate-100 text-slate-500">{r.trigger}</span>
            <span className="ml-auto text-xs text-slate-400">
              {r.total_tokens > 0 && `${r.total_tokens} tokens · $${Number(r.estimated_cost_usd).toFixed(4)} · `}
              {new Date(r.created_at).toLocaleString()}
            </span>
            {r.error && <span className="max-w-xs truncate text-xs text-red-500">{r.error}</span>}
          </a>
        ))}
        {runs.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-400">暂无运行记录</p>}
      </div>
    </div>
  );
}
