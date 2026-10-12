"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_META, type NodeType, type WorkflowDefinition } from "@/lib/engine/types";
import { useEditorStore } from "@/store/editorStore";
import FlowNodeView from "./FlowNodeView";
import NodeConfigPanel from "./NodeConfigPanel";
import RunDialog from "./RunDialog";
import KnowledgeBase from "./KnowledgeBase";
import Modal from "./Modal";
import { Button, Badge, Field, Input, ConfirmDialog } from "./ui";
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

function EditorInner({ workflowId }: { workflowId: string }) {
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

  const run = async (input: Record<string, unknown>, mode: "async" | "sync") => {
    if (dirty) await save(true);
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, input, mode }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "启动失败");
    router.push(`/runs/${j.runId}`);
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

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* toolbar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
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
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={() => setSelected(null)}
            onNodeClick={(_e, n) => setSelected(n.id)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e9ebf1" gap={24} />
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
        </div>

        {/* config drawer */}
        <aside className="w-80 shrink-0 border-l border-slate-200 bg-white">
          <NodeConfigPanel />
        </aside>
      </div>

      <RunDialog open={runOpen} onClose={() => setRunOpen(false)} onRun={run} />
      <KnowledgeBase workflowId={workflowId} open={kbOpen} onClose={() => setKbOpen(false)} />

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

export default function FlowEditor({ workflowId }: { workflowId: string }) {
  return (
    <ReactFlowProvider>
      <EditorInner workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
