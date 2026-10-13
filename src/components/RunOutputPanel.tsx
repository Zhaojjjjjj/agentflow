"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OutputView, StatusBadge } from "./ui";

interface RunDetailData {
  run: {
    id: string;
    workflow_id: string;
    status: string;
    total_tokens: number;
    estimated_cost_usd: number | string;
    error: string | null;
    output: unknown;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
  } | null;
}

/** 画布右侧的运行输出抽屉：状态、统计、错误、可视化输出 */
export default function RunOutputPanel({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<RunDetailData | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        const j = (await res.json()) as RunDetailData;
        if (!stopped) setData(j);
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = setInterval(load, 3000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [runId]);

  const run = data?.run;
  const duration =
    run?.started_at && run?.finished_at
      ? Math.max(0, Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000))
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">运行输出</h3>
          {run && <StatusBadge status={run.status} />}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="关闭"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.3 5.3a1 1 0 0 0-1.4 1.4L8.6 10l-3.7 3.3a1 1 0 1 0 1.4 1.4L10 11.4l3.7 3.3a1 1 0 1 0 1.4-1.4L11.4 10l3.7-3.3a1 1 0 0 0-1.4-1.4L10 8.6 6.3 5.3z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!run ? (
          <p className="py-10 text-center text-sm text-slate-400">加载中…</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">Token</p>
                <p className="text-sm font-semibold text-slate-900">{run.total_tokens || "—"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">成本</p>
                <p className="text-sm font-semibold text-slate-900">
                  ${Number(run.estimated_cost_usd || 0).toFixed(5)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">用时</p>
                <p className="text-sm font-semibold text-slate-900">
                  {duration !== null ? `${duration}s` : "—"}
                </p>
              </div>
            </div>

            {run.error && (
              <p className="mb-4 rounded-xl bg-red-50 p-3 font-mono text-xs leading-5 text-red-600">
                {run.error}
              </p>
            )}

            <OutputView data={run.output} />

            <Link
              href={`/runs/${run.id}`}
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              查看完整详情（含节点时间线）→
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
