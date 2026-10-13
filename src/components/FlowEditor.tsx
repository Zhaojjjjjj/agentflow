"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_META, type NodeType, type StepStatus, type WorkflowDefinition } from "@/lib/engine/types";
import { useEditorStore } from "@/store/editorStore";
import FlowNodeView from "./FlowNodeView";
import NodeConfigPanel from "./NodeConfigPanel";
import RunDialog from "./RunDialog";
import RunOutputPanel from "./RunOutputPanel";
import KnowledgeBase from "./KnowledgeBase";
import Modal from "./Modal";
import { Button, Badge, Field, Input, ConfirmDialog, Markdown, Textarea } from "./ui";
import { toast } from "./toast";

const nodeTypes: NodeTypes = { agentNode: FlowNodeView };

const GROUP_ORDER = ["触发器", "AI", "工具", "逻辑", "输出"];

function NodePanel({ onAdd }: { onAdd: (t: NodeType) => void }) {
  const [q, setQ] = useState("");
  const groups = GROUP_ORDER.map((g) => ({
    name: g,
    items: (Object.keys(NODE_META) as NodeType[]).filter(
      (t) => NODE_META[t].category === g && (!q.trim() || NODE_META[t].label.includes(q.trim()))
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <Input placeholder="搜索节点…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {groups.map((g) => (
          <div key={g.name} className="mb-4 last:mb-0">
            <p className="mb-1 px-1.5 text-[11px] font-medium text-slate-400">{g.name}</p>
            {g.items.map((t) => (
              <button
                key={t}
                title={NODE_META[t].description}
                onClick={() => onAdd(t)}
                className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-600 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: NODE_META[t].color }}
                />
                {NODE_META[t].label}
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-slate-400">没有匹配的节点</p>
        )}
      </div>
    </aside>
  );
}

interface VersionRow {
  version: number;
  note: string;
  created_at: string;
}

const LINK_BTN_SM =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100";

function EditorInner({ workflowId, initialRunId }: { workflowId: string; initialRunId?: string }) {
  const router = useRouter();
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    nodes,
    edges,
    dirty,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelected,
    addNode,
    load,
    getDefinition,
    markClean,
    nodeStatuses,
    setNodeStatuses,
    clearNodeStatuses,
  } = useEditorStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState(1);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleCron, setScheduleCron] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");

  /** 画布实时运行 */
  const [liveRun, setLiveRun] = useState<{
    runId: string | null;
    status: string;
    startedAt: number;
    /** 已结束运行的精确用时（秒），有它就不用 now - startedAt 估算 */
    finalElapsed?: number;
  } | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveActiveRef = useRef(false);

  const TERMINAL = useMemo(
    () => ["succeeded", "failed", "rejected", "cancelled"],
    []
  );

  const stopLiveTimers = useCallback(() => {
    liveActiveRef.current = false;
    esRef.current?.close();
    esRef.current = null;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = null;
  }, []);

  const closeLive = useCallback(() => {
    stopLiveTimers();
    setLiveRun(null);
    setOutputOpen(false);
    clearNodeStatuses();
    // 如果是从 ?runId= 进来的查看模式，关闭时去掉参数
    if (initialRunId) router.replace(`/workflows/${workflowId}`);
  }, [stopLiveTimers, clearNodeStatuses, initialRunId, router, workflowId]);

  useEffect(() => () => stopLiveTimers(), [stopLiveTimers]);

  /** 把 step 行映射为节点状态并写入 store */
  const applySteps = useCallback(
    (steps: { node_id: string; status: StepStatus }[]) => {
      const m: Record<string, StepStatus> = {};
      for (const s of steps) m[s.node_id] = s.status;
      setNodeStatuses(m);
    },
    [setNodeStatuses]
  );

  /** 从 run 行算出精确用时（秒）：finished_at - started_at */
  const calcElapsed = (r: { finished_at?: string | null; started_at?: string | null; created_at?: string | null }) => {
    if (!r.finished_at) return undefined;
    const end = new Date(r.finished_at).getTime();
    const start = r.started_at
      ? new Date(r.started_at).getTime()
      : r.created_at
        ? new Date(r.created_at).getTime()
        : end;
    return Math.max(0, Math.round((end - start) / 1000));
  };

  const finishLive = useCallback(
    (status: string, finalElapsed?: number) => {
      stopLiveTimers();
      setLiveRun((prev) => (prev ? { ...prev, status, finalElapsed } : prev));
      if (status === "succeeded") toast.success("运行成功");
      else if (status === "failed") toast.error("运行失败，点击查看结果了解详情");
    },
    [stopLiveTimers]
  );

  /** 用轮询兜底（SSE 不可用时） */
  const fallbackPoll = useCallback(
    (runId: string) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        if (!liveActiveRef.current) return;
        try {
          const res = await fetch(`/api/runs/${runId}`);
          const j = await res.json();
          if (j.steps) applySteps(j.steps);
          if (j.run && TERMINAL.includes(j.run.status)) finishLive(j.run.status, calcElapsed(j.run));
        } catch {
          /* 下一轮重试 */
        }
      }, 2000);
    },
    [applySteps, finishLive, TERMINAL]
  );

  const attachLiveStream = useCallback(
    (runId: string) => {
      liveActiveRef.current = true;
      tickTimerRef.current = setInterval(() => setNow(Date.now()), 1000);
      let sseOk = false;
      try {
        const es = new EventSource(`/api/runs/${runId}/stream`);
        esRef.current = es;
        es.onmessage = (e) => {
          sseOk = true;
          try {
            const j = JSON.parse(e.data);
            if (j.steps) applySteps(j.steps);
            if (j.run) {
              const st = String(j.run.status);
              setLiveRun((prev) => (prev ? { ...prev, status: st } : prev));
              if (TERMINAL.includes(st)) {
                es.close();
                finishLive(st, calcElapsed(j.run));
              }
            }
            if (j.type === "done") {
              es.close();
              // done 但非终态（等待审批且 SSE 超时）→ 转慢速轮询
              setLiveRun((prev) => {
                if (prev && !TERMINAL.includes(prev.status)) {
                  setTimeout(() => fallbackPoll(runId), 0);
                }
                return prev;
              });
            }
          } catch {
            /* ignore */
          }
        };
        es.onerror = () => {
          es.close();
          if (!sseOk && liveActiveRef.current) fallbackPoll(runId);
        };
      } catch {
        fallbackPoll(runId);
      }
      // SSE 一直没消息则兜底
      setTimeout(() => {
        if (!sseOk && liveActiveRef.current && !pollTimerRef.current) fallbackPoll(runId);
      }, 4000);
    },
    [applySteps, finishLive, fallbackPoll, TERMINAL]
  );

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async (input: Record<string, unknown>, mode: "async" | "sync") => {
    if (dirty) await save(true);
    closeLive();
    const startTs = Date.now();
    clearNodeStatuses();
    setLiveRun({ runId: null, status: "starting", startedAt: startTs });
    setNow(startTs);

    let reqId: string | null = null;
    let reqError: Error | null = null;
    const req = fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, input, mode }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "启动失败");
        return j.runId as string;
      })
      .then(
        (id) => {
          reqId = id;
          return id;
        },
        (err) => {
          reqError = err instanceof Error ? err : new Error(String(err));
          throw reqError;
        }
      );

    // 同步模式下 POST 会阻塞到执行结束；通过运行列表反查 runId 以便实时跟进
    let runId: string | null = null;
    for (let i = 0; i < 60; i++) {
      if (reqId) {
        runId = reqId;
        break;
      }
      if (reqError) break;
      await sleep(1000);
      if (reqId) {
        runId = reqId;
        break;
      }
      if (reqError) break;
      try {
        const r = await fetch(`/api/runs?workflowId=${workflowId}&limit=5`);
        const j = await r.json();
        const hit = (j.runs || []).find(
          (x: { created_at: string; status: string; id: string }) =>
            new Date(x.created_at).getTime() >= startTs - 5000 &&
            ["queued", "running", "waiting_approval"].includes(x.status)
        );
        if (hit) {
          runId = hit.id as string;
          break;
        }
      } catch {
        /* 下一轮重试 */
      }
    }
    if (!runId && !reqError) {
      try {
        runId = await req;
      } catch (e) {
        reqError = e instanceof Error ? e : new Error(String(e));
      }
    }
    if (reqError || !runId) {
      setLiveRun(null);
      toast.error(reqError ? reqError.message : "启动失败：未检测到运行记录");
      return;
    }
    setLiveRun({ runId, status: "running", startedAt: startTs });
    attachLiveStream(runId);
    // 同步模式的 POST 仍在后台，静默等待它结束（避免未处理 rejection）
    req.catch(() => {});
  };

  /** 查看历史运行：在画布上叠加该次运行的节点状态 */
  const viewRun = useCallback(
    async (runId: string) => {
      closeLive();
      clearNodeStatuses();
      const startTs = Date.now();
      setLiveRun({ runId, status: "starting", startedAt: startTs });
      setNow(startTs);
      try {
        const res = await fetch(`/api/runs/${runId}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "运行记录不存在");
        if (j.steps) applySteps(j.steps);
        const st = String(j.run.status);
        const created = j.run.created_at ? new Date(j.run.created_at).getTime() : startTs;
        // 已结束的运行：用 finished_at - started_at 的精确用时，而不是 now - created_at
        const finalElapsed = TERMINAL.includes(st) ? calcElapsed(j.run) : undefined;
        setLiveRun({ runId, status: st, startedAt: created, finalElapsed });
        setNow(Date.now());
        if (!TERMINAL.includes(st)) {
          // 还在跑（或等待审批）：继续实时跟进
          attachLiveStream(runId);
        }
      } catch (e) {
        setLiveRun(null);
        toast.error(e instanceof Error ? e.message : "加载运行记录失败");
      }
    },
    [closeLive, clearNodeStatuses, applySteps, attachLiveStream, TERMINAL]
  );

  useEffect(() => {
    if (initialRunId) void viewRun(initialRunId);
  }, [initialRunId, viewRun]);

  /** 画布内审批 */
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalInfo, setApprovalInfo] = useState<{
    title: string;
    message: string;
    nodeName: string;
  } | null>(null);

  const openApproval = async () => {
    if (!liveRun?.runId) return;
    setApprovalOpen(true);
    setApprovalInfo(null);
    try {
      const res = await fetch(`/api/runs/${liveRun.runId}`);
      const j = await res.json();
      const s = (j.steps || []).find((x: { status: string }) => x.status === "waiting_approval") as
        | { node_name?: string; output?: unknown }
        | undefined;
      const out = (s?.output as { title?: string; message?: string } | null) || {};
      setApprovalInfo({
        title: String(out.title || "人工审批"),
        message: String(out.message || ""),
        nodeName: String(s?.node_name || ""),
      });
    } catch {
      setApprovalInfo({ title: "人工审批", message: "", nodeName: "" });
    }
  };

  const decideApproval = async (decision: "approved" | "rejected") => {
    if (!liveRun?.runId) return;
    setApprovalBusy(true);
    try {
      const res = await fetch(`/api/runs/${liveRun.runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: approvalComment }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "操作失败");
      toast.success(decision === "approved" ? "已批准，继续执行" : "已拒绝，流程终止");
      setApprovalOpen(false);
      setApprovalComment("");
      // 审批后 Inngest 恢复执行，SSE 会跟进后续节点状态
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setApprovalBusy(false);
    }
  };

  const loadWorkflow = useCallback(async () => {
    const res = await fetch(`/api/workflows/${workflowId}`);
    const j = await res.json();
    if (j.workflow) {
      const w = j.workflow;
      setName(w.name);
      setDescription(w.description || "");
      setVersion(w.version);
      setIsPublished(w.is_published);
      setScheduleCron(w.schedule_cron || "");
      setScheduleEnabled(w.schedule_enabled);
      load(w.definition as WorkflowDefinition);
    }
  }, [workflowId, load]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow]);

  /** 在画布视口中央添加节点 */
  const addAtCenter = useCallback(
    (type: NodeType) => {
      const el = wrapperRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const pos = reactFlow.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        addNode(type, pos);
      } else {
        addNode(type);
      }
    },
    [reactFlow, addNode]
  );

  const save = async (silent = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, definition: getDefinition() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "保存失败");
      markClean();
      await loadWorkflow();
      if (!silent) toast.success("已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    const res = await fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !isPublished }),
    });
    if (res.ok) {
      setIsPublished(!isPublished);
      setPublishOpen(true);
      toast.success(!isPublished ? "已发布为 HTTP API" : "已取消发布");
    } else {
      toast.error("操作失败");
    }
  };

  const openVersions = async () => {
    const res = await fetch(`/api/workflows/${workflowId}/versions`);
    const j = await res.json();
    if (j.versions) setVersions(j.versions);
    setVersionsOpen(true);
  };

  const restoreVersion = async (v: number) => {
    const res = await fetch(`/api/workflows/${workflowId}/versions/${v}/restore`, { method: "POST" });
    if (res.ok) {
      setVersionsOpen(false);
      await loadWorkflow();
      toast.success(`已恢复到 v${v}`);
    } else {
      toast.error("恢复失败");
    }
  };

  const saveSchedule = async () => {
    const res = await fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule_cron: scheduleCron, schedule_enabled: scheduleEnabled }),
    });
    const j = await res.json();
    if (!res.ok) {
      toast.error(j.error || "保存失败");
      return;
    }
    setScheduleOpen(false);
    toast.success("定时设置已保存");
  };

  const createApiKey = async () => {
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, name: `key-${new Date().toISOString().slice(0, 10)}` }),
    });
    const j = await res.json();
    if (res.ok) setApiKey(j.key);
    else toast.error(j.error || "创建失败");
  };

  const copyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  /** 需要 Inngest 异步执行的节点类型：人工审批（要等人）、定时触发 */
  const needsAsync = nodes.some((n) =>
    ["human-approval", "trigger-schedule"].includes(
      (n.data as { nodeType?: string } | undefined)?.nodeType ?? ""
    )
  );

  /** 实时运行时：让"前沿"的边流动起来 */
  const displayEdges = useMemo(() => {
    const streaming =
      liveRun && !TERMINAL.includes(liveRun.status) && liveRun.status !== "starting";
    if (!streaming) return edges;
    return edges.map((e) => {
      const s = nodeStatuses[e.source];
      const t = nodeStatuses[e.target];
      const animated =
        (s === "running" || s === "succeeded") &&
        t !== "succeeded" &&
        t !== "failed" &&
        t !== "skipped";
      return animated ? { ...e, animated: true } : e;
    });
  }, [edges, nodeStatuses, liveRun, TERMINAL]);

  /** 当前正在执行的节点名称（进度条用） */
  const runningNodeName = useMemo(() => {
    if (!liveRun) return "";
    const runningId = Object.keys(nodeStatuses).find((id) => nodeStatuses[id] === "running");
    if (!runningId) return "";
    const n = nodes.find((x) => x.id === runningId);
    return n ? String(n.data.label || n.id) : "";
  }, [nodeStatuses, nodes, liveRun]);

  const liveElapsed =
    liveRun?.finalElapsed ?? (liveRun ? Math.max(0, Math.floor((now - liveRun.startedAt) / 1000)) : 0);
  /** 15232s → "4时13分"，95s → "1分35秒"，45s → "45秒" */
  const formatDuration = (s: number) => {
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return m > 0 ? `${h}时${m}分` : `${h}时`;
    }
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return sec > 0 ? `${m}分${sec}秒` : `${m}分`;
    }
    return `${s}秒`;
  };
  const liveElapsedText = formatDuration(liveElapsed);
  const liveDone = liveRun ? TERMINAL.includes(liveRun.status) : false;

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* toolbar */}      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link
          href="/"
          title="返回工作流列表"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-base text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600"
        >
          ←
        </Link>
        <div className="h-5 w-px bg-slate-200" />
        <input
          className="w-52 rounded-lg border border-transparent px-2 py-1.5 text-[15px] font-semibold text-slate-900 outline-none transition-colors duration-150 hover:border-slate-200 focus:border-brand-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="工作流名称"
        />
        <Badge tone="gray">v{version}</Badge>
        {isPublished && <Badge tone="green">已发布</Badge>}
        {dirty && <Badge tone="amber">未保存</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setKbOpen(true)}>
            知识库
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setScheduleOpen(true)}>
            定时
          </Button>
          <Button size="sm" variant="secondary" onClick={openVersions}>
            版本
          </Button>
          <Link href={`/workflows/${workflowId}/runs`} className={LINK_BTN_SM}>
            运行历史
          </Link>
          <div className="mx-1 h-5 w-px bg-slate-200" />
          <Button size="sm" variant="secondary" onClick={togglePublish}>
            {isPublished ? "取消发布" : "发布"}
          </Button>
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => save()}>
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button size="sm" variant="primary" onClick={() => setRunOpen(true)}>
            运行
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <NodePanel onAdd={addAtCenter} />

        {/* canvas */}
        <div className="relative min-w-0 flex-1 bg-white" ref={wrapperRef}>
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={() => setSelected(null)}
            onNodeClick={(_e, n) => setSelected(n.id)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dde2ec" />
            <Controls
              style={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                const t = (n.data as { nodeType?: string } | undefined)?.nodeType;
                return (t && NODE_META[t as NodeType]?.color) || "#cbd5e1";
              }}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
              maskColor="rgba(15,23,42,0.06)"
            />
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <p className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-400 shadow-sm">
                  从左侧面板添加节点开始编排
                </p>
              </div>
            )}
          </ReactFlow>

          {/* 实时运行进度条 */}
          {liveRun && (
            <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
              <div
                className={`flex items-center gap-3 rounded-full border py-2 pl-4 pr-2 shadow-lg backdrop-blur ${
                  liveRun.status === "failed"
                    ? "border-red-200 bg-red-50/95"
                    : liveRun.status === "waiting_approval"
                      ? "border-amber-200 bg-amber-50/95"
                      : liveDone
                        ? "border-green-200 bg-green-50/95"
                        : "border-brand-200 bg-white/95"
                }`}
              >
                {liveRun.status === "starting" && (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                    <span className="text-[13px] font-medium text-slate-700">正在启动…</span>
                  </>
                )}
                {!liveDone && liveRun.status !== "starting" && liveRun.status !== "waiting_approval" && (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
                    </span>
                    <span className="text-[13px] font-medium text-slate-700">
                      正在运行
                      {runningNodeName && (
                        <span className="text-slate-400"> · {runningNodeName}</span>
                      )}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                      {liveElapsedText}
                    </span>
                  </>
                )}
                {liveRun.status === "waiting_approval" && (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="text-[13px] font-medium text-amber-800">
                      等待人工审批{runningNodeName ? ` · ${runningNodeName}` : ""}
                    </span>
                    <button
                      onClick={() => void openApproval()}
                      className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-600"
                    >
                      查看审批
                    </button>
                  </>
                )}
                {liveDone && (
                  <>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${liveRun.status === "succeeded" ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span className="text-[13px] font-medium text-slate-700">
                      {liveRun.status === "succeeded"
                        ? `运行成功 · 用时 ${liveElapsedText}`
                        : liveRun.status === "rejected"
                          ? "运行被拒绝"
                          : `运行失败 · 用时 ${liveElapsedText}`}
                    </span>
                    {liveRun.runId && (
                      <button
                        onClick={() => setOutputOpen(true)}
                        className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700"
                      >
                        查看输出
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={closeLive}
                  className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  title="关闭"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.3 5.3a1 1 0 0 0-1.4 1.4L8.6 10l-3.7 3.3a1 1 0 1 0 1.4 1.4L10 11.4l3.7 3.3a1 1 0 1 0 1.4-1.4L11.4 10l3.7-3.3a1 1 0 0 0-1.4-1.4L10 8.6 6.3 5.3z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* 运行输出抽屉 */}
          {outputOpen && liveRun?.runId && (
            <div className="absolute bottom-4 right-4 top-4 z-30 w-[400px] max-w-[calc(100%-2rem)]">
              <RunOutputPanel runId={liveRun.runId} onClose={() => setOutputOpen(false)} />
            </div>
          )}
        </div>

        {/* config drawer */}
        <aside className="w-80 shrink-0 border-l border-slate-200 bg-white">
          <NodeConfigPanel />
        </aside>
      </div>

      <RunDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onRun={run}
        suggestedMode={needsAsync ? "async" : "sync"}
        suggestReason={
          needsAsync
            ? "检测到人工审批或定时触发节点，需要 Inngest 异步执行。"
            : "未检测到审批/定时节点，已为你选择更快的同步执行。"
        }
      />
      <KnowledgeBase workflowId={workflowId} open={kbOpen} onClose={() => setKbOpen(false)} />

      {/* 画布内审批弹窗 */}
      <Modal open={approvalOpen} onClose={() => setApprovalOpen(false)} title="人工审批" wide>
        {!approvalInfo ? (
          <p className="py-8 text-center text-sm text-slate-400">加载审批内容…</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <h3 className="text-[15px] font-semibold text-slate-900">{approvalInfo.title}</h3>
              {approvalInfo.nodeName && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {approvalInfo.nodeName}
                </span>
              )}
            </div>
            {approvalInfo.message ? (
              <div className="mb-4 max-h-80 overflow-y-auto rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3">
                <Markdown text={approvalInfo.message} />
              </div>
            ) : (
              <p className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-400">
                该审批节点没有填写说明内容
              </p>
            )}
            <Field label="审批意见（可选，会传递给下游节点）">
              <Textarea
                rows={2}
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="例如：再短一点，突出价格优势"
              />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="danger" disabled={approvalBusy} onClick={() => void decideApproval("rejected")}>
                {approvalBusy ? "处理中…" : "拒绝终止"}
              </Button>
              <Button variant="primary" disabled={approvalBusy} onClick={() => void decideApproval("approved")}>
                {approvalBusy ? "处理中…" : "批准继续"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* publish / api info */}
      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="发布为 HTTP API" wide>
        {isPublished ? (
          <div className="space-y-3 text-sm">
            <p>
              <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                POST /api/public/workflows/{workflowId}/run
              </code>
            </p>
            <p className="text-slate-500">
              请求头：x-api-key（或 Authorization: Bearer）。Body：{"{ input, mode: 'sync'|'async' }"}
            </p>
            <Button size="sm" variant="secondary" onClick={createApiKey}>
              生成新的 API Key
            </Button>
            {apiKey && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                <p className="mb-1.5 text-xs font-semibold text-amber-700">请立即复制，关闭后不再显示：</p>
                <code className="break-all font-mono text-xs text-slate-700">{apiKey}</code>
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={copyApiKey}>
                    复制
                  </Button>
                </div>
              </div>
            )}
            <div>
              <Link href="/api-keys" className={LINK_BTN_SM}>
                管理全部 Key →
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">已取消发布，公开 API 不可用。</p>
        )}
      </Modal>

      {/* versions */}
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="版本历史">
        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.version}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm"
            >
              <div>
                <span className="font-semibold text-slate-900">v{v.version}</span>
                <span className="ml-2 text-slate-500">{v.note}</span>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {new Date(v.created_at).toLocaleString()}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setRestoreTarget(v.version)}>
                恢复
              </Button>
            </div>
          ))}
          {versions.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">暂无版本（保存后自动生成）</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={restoreTarget !== null}
        title={`恢复到 v${restoreTarget}`}
        description="当前内容将被覆盖（会先保存为新版本）。确定继续吗？"
        confirmLabel="恢复"
        onConfirm={() => {
          if (restoreTarget !== null) void restoreVersion(restoreTarget);
        }}
        onClose={() => setRestoreTarget(null)}
      />

      {/* schedule */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="定时触发">
        <Field label="启用定时运行（UTC）">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            启用
          </label>
        </Field>
        <Field label="Cron 表达式（分 时 日 月 周）">
          <Input
            className="font-mono"
            value={scheduleCron}
            onChange={(e) => setScheduleCron(e.target.value)}
            placeholder="0 9 * * *"
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={saveSchedule}>
            保存
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function FlowEditor({ workflowId, initialRunId }: { workflowId: string; initialRunId?: string }) {
  return (
    <ReactFlowProvider>
      <EditorInner workflowId={workflowId} initialRunId={initialRunId} />
    </ReactFlowProvider>
  );
}
