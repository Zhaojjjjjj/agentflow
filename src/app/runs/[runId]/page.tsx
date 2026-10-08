"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, StatusBadge, RunTimeline, JsonBlock, type StepRow } from "@/components/ui";

interface RunDetail {
  id: string;
  workflow_id: string;
  trigger: string;
  status: string;
  input: unknown;
  output: unknown;
  total_tokens: number;
  estimated_cost_usd: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [runId, setRunId] = useState("");
  const [run, setRun] = useState<RunDetail | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    void params.then((p) => setRunId(p.id));
  }, [params]);

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    const load = async () => {
      const res = await fetch(`/api/runs/${runId}`);
      const j = await res.json();
      if (stopped) return;
      if (j.run) setRun(j.run);
      if (j.steps) setSteps(j.steps);
    };
    void load();
    const es = new EventSource(`/api/runs/${runId}/stream`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const j = JSON.parse(e.data);
        if (j.type === "update" || j.type === "done") {
          setRun(j.run);
          setSteps(j.steps || []);
        }
        if (j.type === "done") es.close();
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      // SSE 出错时回退为一次性加载
      es.close();
    };
    return () => {
      stopped = true;
      es.close();
    };
  }, [runId]);

  const approve = async (decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/runs/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      const j = await res.json();
      if (!res.ok) alert(j.error || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const waiting = steps.some((s) => s.status === "waiting_approval");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="运行详情"
        desc={runId ? `run ${runId.slice(0, 8)}` : ""}
        actions={
          run?.workflow_id ? (
            <a className="btn-secondary" href={`/workflows/${run.workflow_id}/runs`}>返回历史</a>
          ) : undefined
        }
      />

      {run && (
        <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
          <StatusBadge status={run.status} />
          <span className="badge bg-slate-100 text-slate-500">{run.trigger}</span>
          <span className="text-sm text-slate-500">
            {run.total_tokens} tokens · 预估 ${Number(run.estimated_cost_usd).toFixed(5)}
          </span>
          {run.error && <span className="text-sm text-red-600">{run.error}</span>}
        </div>
      )}

      {waiting && (
        <div className="card mb-5 border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-2 font-semibold text-amber-800">等待人工审批</h3>
          <textarea
            className="input mb-3"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="审批意见（可选）"
          />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => approve("approved")}>
              ✓ 批准继续
            </button>
            <button className="btn-danger" disabled={busy} onClick={() => approve("rejected")}>
              ✕ 拒绝终止
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-500">节点执行时间线</h3>
        <RunTimeline steps={steps} />
      </div>

      {run && (
        <>
          <JsonBlock title="输入 input" data={run.input} />
          <JsonBlock title="输出 output" data={run.output} />
        </>
      )}
    </div>
  );
}
