"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
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

const nodeTypes: NodeTypes = { agentNode: FlowNodeView };

const PALETTE: NodeType[] = [
  "trigger-manual",
  "trigger-schedule",
  "llm",
  "http-request",
  "rag-retrieve",
  "condition",
  "loop",
  "human-approval",
  "output",
];

interface VersionRow {
  version: number;
  note: string;
  created_at: string;
}

function EditorInner({ workflowId }: { workflowId: string }) {
  const {
    nodes,
    edges,
    selectedId,
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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleCron, setScheduleCron] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState("");

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
      if (!silent) setNotice("已保存");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
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
    window.location.href = `/runs/${j.runId}`;
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
    }
  };

  const openVersions = async () => {
    const res = await fetch(`/api/workflows/${workflowId}/versions`);
    const j = await res.json();
    if (j.versions) setVersions(j.versions);
    setVersionsOpen(true);
  };

  const restoreVersion = async (v: number) => {
    if (!confirm(`确定恢复到 v${v} 吗？当前内容将被覆盖（会先保存为新版本）。`)) return;
    const res = await fetch(`/api/workflows/${workflowId}/versions/${v}/restore`, { method: "POST" });
    if (res.ok) {
      setVersionsOpen(false);
      await loadWorkflow();
      setNotice(`已恢复到 v${v}`);
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
      setNotice(j.error || "保存失败");
      return;
    }
    setScheduleOpen(false);
    setNotice("定时设置已保存");
  };

  const createApiKey = async () => {
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, name: `key-${new Date().toISOString().slice(0, 10)}` }),
    });
    const j = await res.json();
    if (res.ok) setApiKey(j.key);
    else setNotice(j.error || "创建失败");
  };

  return (
    <div className="flex h-screen flex-col">
      {/* toolbar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <a href="/" className="mr-1 text-slate-400 hover:text-slate-600">←</a>
        <input
          className="w-52 rounded-lg border border-transparent px-2 py-1.5 text-base font-bold outline-none hover:border-slate-200 focus:border-brand-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="text-xs text-slate-400">v{version}</span>
        {isPublished && <span className="badge bg-green-100 text-green-700">已发布</span>}
        {dirty && <span className="badge bg-amber-100 text-amber-700">未保存</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {notice && <span className="text-xs text-slate-500">{notice}</span>}
          <button className="btn-secondary" onClick={() => setKbOpen(true)}>知识库</button>
          <button className="btn-secondary" onClick={() => setScheduleOpen(true)}>定时</button>
          <button className="btn-secondary" onClick={openVersions}>版本</button>
          <a className="btn-secondary" href={`/workflows/${workflowId}/runs`}>运行历史</a>
          <button className="btn-secondary" onClick={togglePublish}>
            {isPublished ? "取消发布" : "发布"}
          </button>
          <button className="btn-secondary" disabled={saving} onClick={() => save()}>
            {saving ? "保存中…" : "保存"}
          </button>
          <button className="btn-primary" onClick={() => setRunOpen(true)}>▶ 运行</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* canvas */}
        <div className="relative min-w-0 flex-1">
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
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
            <Panel position="top-left">
              <div className="card flex flex-wrap gap-1.5 p-2">
                {PALETTE.map((t) => (
                  <button
                    key={t}
                    title={NODE_META[t].description}
                    onClick={() => addNode(t)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600"
                  >
                    + {NODE_META[t].label}
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>
        {/* config panel */}
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
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                POST /api/public/workflows/{workflowId}/run
              </code>
            </p>
            <p className="text-slate-500">请求头：x-api-key（或 Authorization: Bearer）。Body：{"{ input, mode: 'sync'|'async' }"}</p>
            <button className="btn-secondary" onClick={createApiKey}>生成新的 API Key</button>
            {apiKey && (
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="mb-1 text-xs font-semibold text-amber-700">请立即复制，关闭后不再显示：</p>
                <code className="break-all font-mono text-xs">{apiKey}</code>
              </div>
            )}
            <a className="btn-secondary inline-flex" href="/api-keys">管理全部 Key →</a>
          </div>
        ) : (
          <p className="text-sm text-slate-500">已取消发布，公开 API 不可用。</p>
        )}
      </Modal>

      {/* versions */}
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="版本历史">
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.version} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 text-sm">
              <div>
                <span className="font-semibold">v{v.version}</span>
                <span className="ml-2 text-slate-500">{v.note}</span>
                <div className="text-[11px] text-slate-400">{new Date(v.created_at).toLocaleString()}</div>
              </div>
              <button className="btn-secondary" onClick={() => restoreVersion(v.version)}>恢复</button>
            </div>
          ))}
          {versions.length === 0 && <p className="text-sm text-slate-400">暂无版本（保存后自动生成）</p>}
        </div>
      </Modal>

      {/* schedule */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="定时触发">
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
          启用定时运行（UTC）
        </label>
        <label className="label">Cron 表达式（分 时 日 月 周）</label>
        <input className="input mb-4 font-mono" value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} placeholder="0 9 * * *" />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setScheduleOpen(false)}>取消</button>
          <button className="btn-primary" onClick={saveSchedule}>保存</button>
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
