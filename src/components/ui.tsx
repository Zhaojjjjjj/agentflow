"use client";

import type { ReactNode } from "react";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-500",
  running: "bg-blue-100 text-blue-700",
  waiting_approval: "bg-amber-100 text-amber-700",
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-slate-100 text-slate-400",
  queued: "bg-slate-100 text-slate-500",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "等待",
  running: "运行中",
  waiting_approval: "待审批",
  succeeded: "成功",
  failed: "失败",
  skipped: "跳过",
  queued: "排队中",
  rejected: "已拒绝",
  cancelled: "已取消",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLE[status] || "bg-slate-100 text-slate-500"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export interface StepRow {
  id: string;
  node_id: string;
  node_type: string;
  node_name: string;
  status: string;
  tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export function RunTimeline({ steps }: { steps: StepRow[] }) {
  if (steps.length === 0) return <p className="text-sm text-slate-400">暂无节点执行记录</p>;
  return (
    <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5">
      {steps.map((s) => (
        <li key={s.id} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300 shadow" />
          <div className="card p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{s.node_id}</span>
              <span className="text-sm font-medium">{s.node_name || s.node_type}</span>
              <StatusBadge status={s.status} />
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
              {s.duration_ms != null && <span>耗时 {(s.duration_ms / 1000).toFixed(1)}s</span>}
              {s.tokens > 0 && <span>{s.tokens} tokens</span>}
              {Number(s.cost_usd) > 0 && <span>${Number(s.cost_usd).toFixed(5)}</span>}
              {s.started_at && <span>{new Date(s.started_at).toLocaleTimeString()}</span>}
            </div>
            {s.error && (
              <p className="mt-2 rounded bg-red-50 p-2 font-mono text-xs text-red-600">{s.error}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function JsonBlock({ title, data }: { title: string; data: unknown }) {
  if (data === null || data === undefined) return null;
  return (
    <div className="mb-4">
      <h4 className="mb-1 text-xs font-semibold text-slate-500">{title}</h4>
      <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}
