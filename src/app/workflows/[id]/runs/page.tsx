"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { PageHeader, StatusBadge, Badge, EmptyState, Skeleton, Button } from "@/components/ui";

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void params.then(async (p) => {
      setWorkflowId(p.id);
      try {
        const [w, r] = await Promise.all([
          fetch(`/api/workflows/${p.id}`).then((x) => x.json()),
          fetch(`/api/runs?workflowId=${p.id}`).then((x) => x.json()),
        ]);
        if (w.workflow) setName(w.workflow.name);
        if (r.runs) setRuns(r.runs);
      } catch {
        setLoadError("加载失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  return (
    <>
      <TopNav />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title={`运行历史${name ? ` · ${name}` : ""}`}
          actions={
            <Link
              href={workflowId ? `/workflows/${workflowId}` : "/"}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100"
            >
              返回编辑器
            </Link>
          }
        />
        <div className="card overflow-hidden">
          {loadError ? (
            <p className="px-4 py-10 text-center text-sm text-red-600">{loadError}</p>
          ) : loading ? (
            <Skeleton rows={5} />
          ) : runs.length === 0 ? (
            <EmptyState title="暂无运行记录" description="去编辑器点击「运行」发起第一次执行" />
          ) : (
            <div className="divide-y divide-slate-100">
              {runs.map((r) => (
                <Link
                  key={r.id}
                  href={`/runs/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-slate-50"
                >
                  <StatusBadge status={r.status} />
                  <span className="font-mono text-xs text-slate-400">{r.id.slice(0, 8)}</span>
                  <Badge tone="gray">{r.trigger}</Badge>
                  <span className="ml-auto text-xs text-slate-400">
                    {r.total_tokens > 0 &&
                      `${r.total_tokens} tokens · $${Number(r.estimated_cost_usd).toFixed(4)} · `}
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  {r.error && (
                    <span className="max-w-xs truncate text-xs text-red-500">{r.error}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
