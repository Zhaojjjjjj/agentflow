"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { PageHeader, StatusBadge, RunTimeline, JsonBlock, OutputView, Markdown, Badge, Button, Textarea, type StepRow } from "@/components/ui";
import { toast } from "@/components/toast";

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

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card flex-1 p-4">
      <p className="mb-1.5 text-xs text-slate-400">{label}</p>
      <div>{children}</div>
    </div>
  );
}

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const [runId, setRunId] = useState("");
  const [run, setRun] = useState<RunDetail | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sseDead, setSseDead] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    void params.then((p) => setRunId(p.runId));
  }, [params]);

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    const TERMINAL = ["succeeded", "failed", "rejected", "cancelled"];
    const load = async () => {
      const res = await fetch(`/api/runs/${runId}`);
      const j = await res.json();
      if (stopped) return;
      if (j.run) setRun(j.run);
      if (j.steps) setSteps(j.steps);
      return j.run?.status as string | undefined;
    };
    void load().then((status) => {
      // 已结束的运行不需要再开实时流，避免 done 消息冲掉已有数据
      if (stopped || (status && TERMINAL.includes(status))) return;
      const es = new EventSource(`/api/runs/${runId}/stream`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const j = JSON.parse(e.data);
          if (j.type === "update" || j.type === "done") {
            setRun(j.run);
            if (j.steps && j.steps.length > 0) setSteps(j.steps);
          }
          if (j.type === "done") es.close();
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        // SSE 断开后回退为最后已知状态
        es.close();
        if (!stopped) setSseDead(true);
      };
    });
    return () => {
      stopped = true;
      esRef.current?.close();
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
      if (!res.ok) {
        toast.error(j.error || "操作失败");
      } else {
        toast.success(decision === "approved" ? "已批准，继续执行" : "已拒绝，流程终止");
        setComment("");
      }
    } finally {
      setBusy(false);
    }
  };

  const waitingStep = steps.find((s) => s.status === "waiting_approval");
  const waiting = !!waitingStep;
  const waitingOut = (waitingStep?.output as { title?: string; message?: string } | null) || {};

  return (
    <>
      <TopNav />
      <div className="mx-auto max-w-4xl px-6 py-8">
        <PageHeader
          title="运行详情"
          desc={runId ? `run ${runId.slice(0, 8)}` : ""}
          actions={
            run?.workflow_id ? (
              <div className="flex gap-2">
                <Link
                  href={`/workflows/${run.workflow_id}?runId=${runId}`}
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700"
                >
                  在画布中查看
                </Link>
                <Link
                  href={`/workflows/${run.workflow_id}/runs`}
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100"
                >
                  返回历史
                </Link>
              </div>
            ) : undefined
          }
        />

        {sseDead && (
          <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
            实时连接已断开，显示最后已知状态
          </p>
        )}

        <div className="mb-5 flex flex-wrap gap-3">
          <StatCard label="状态">
            <div className="flex items-center gap-2">
              {run ? <StatusBadge status={run.status} /> : <span className="text-sm text-slate-400">加载中…</span>}
              {run && <Badge tone="gray">{run.trigger}</Badge>}
              {run && ["queued", "running", "waiting_approval"].includes(run.status) && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm("确定要手动结束这次运行吗？执行器不会再更新它的状态。")) return;
                    setBusy(true);
                    try {
                      const res = await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
                      const j = await res.json();
                      if (!res.ok) throw new Error(j.error || "操作失败");
                      setRun({ ...run, status: "cancelled", finished_at: new Date().toISOString() });
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "操作失败");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                >
                  结束运行
                </button>
              )}
            </div>
          </StatCard>
          <StatCard label="Token 消耗">
            <span className="text-lg font-semibold text-slate-900">{run?.total_tokens ?? "—"}</span>
          </StatCard>
          <StatCard label="预估成本">
            <span className="text-lg font-semibold text-slate-900">
              {run ? `$${Number(run.estimated_cost_usd).toFixed(5)}` : "—"}
            </span>
          </StatCard>
        </div>

        {run?.error && (
          <p className="mb-5 rounded-xl bg-red-50 p-3.5 font-mono text-xs leading-5 text-red-600">
            {run.error}
          </p>
        )}

        {waiting && (
          <div className="card mb-5 border-amber-200 bg-amber-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <h3 className="font-semibold text-amber-800">
                {waitingOut.title || "等待人工审批"}
              </h3>
              {waitingStep?.node_name && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                  {waitingStep.node_name}
                </span>
              )}
            </div>
            {waitingOut.message ? (
              <div className="mb-4 max-h-72 overflow-y-auto rounded-xl border border-amber-200/60 bg-white/70 px-4 py-3">
                <Markdown text={waitingOut.message} />
              </div>
            ) : (
              <p className="mb-4 text-[13px] text-amber-700/70">
                该审批节点没有填写说明内容，可直接审批。
              </p>
            )}
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="审批意见（可选，会传递给下游节点）"
              className="mb-3"
            />
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy} onClick={() => approve("approved")}>
                批准继续
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => approve("rejected")}>
                拒绝终止
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">节点执行时间线</h3>
          <RunTimeline steps={steps} />
        </div>

        {run && (
          <>
            <JsonBlock title="输入 input" data={run.input} />
            <h4 className="mb-1.5 text-xs font-semibold text-slate-500">输出 output</h4>
            <OutputView data={run.output} />
          </>
        )}
      </div>
    </>
  );
}
