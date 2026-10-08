"use client";

import { useState } from "react";
import { NODE_META, type FlowNodeConfig, type NodeType } from "@/lib/engine/types";
import { useEditorStore } from "@/store/editorStore";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-4 text-slate-400">{hint}</p>}
    </div>
  );
}

function KVEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const entries = Object.entries(value || {});
  const set = (k: string, v: string) => onChange({ ...(value || {}), [k]: v });
  const del = (k: string) => {
    const c = { ...(value || {}) };
    delete c[k];
    onChange(c);
  };
  const [newKey, setNewKey] = useState("");
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <input className="input w-1/3" value={k} disabled title="键名" />
          <input className="input flex-1" value={v} onChange={(e) => set(k, e.target.value)} placeholder="{{变量}} 或文本" />
          <button className="btn-danger px-2" onClick={() => del(k)} title="删除">×</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="新字段名，回车添加"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newKey.trim()) {
              set(newKey.trim(), "");
              setNewKey("");
            }
          }}
        />
        <button
          className="btn-secondary"
          onClick={() => {
            if (newKey.trim()) {
              set(newKey.trim(), "");
              setNewKey("");
            }
          }}
        >
          添加
        </button>
      </div>
    </div>
  );
}

const SUB_TYPES: NodeType[] = ["llm", "http-request", "rag-retrieve", "output"];

interface SubNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; config: Record<string, unknown> };
}

function LoopSubflowEditor({
  config,
  onChange,
}: {
  config: FlowNodeConfig;
  onChange: (c: FlowNodeConfig) => void;
}) {
  const nodes = (config.nodes as SubNode[]) || [];
  const setNodes = (ns: SubNode[]) => {
    const edges = ns.slice(1).map((n, i) => ({
      id: `e-${ns[i].id}-${n.id}`,
      source: ns[i].id,
      target: n.id,
    }));
    onChange({ ...config, nodes: ns, edges });
  };
  const updateNode = (idx: number, patch: Partial<SubNode>) => {
    const ns = nodes.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    setNodes(ns);
  };
  const updateNodeData = (idx: number, data: SubNode["data"]) => updateNode(idx, { data });
  return (
    <div className="space-y-2">
      {nodes.map((n, i) => (
        <div key={n.id} className="rounded-lg border border-slate-200 p-2">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
            <select
              className="input flex-1"
              value={n.type}
              onChange={(e) => {
                const t = e.target.value as NodeType;
                updateNode(i, {
                  type: t,
                  data: { label: NODE_META[t].label, config: {} },
                });
              }}
            >
              {SUB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {NODE_META[t].label}
                </option>
              ))}
            </select>
            <button className="btn-danger px-2" onClick={() => setNodes(nodes.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
          <input
            className="input mb-2"
            value={n.data.label}
            onChange={(e) => updateNodeData(i, { ...n.data, label: e.target.value })}
            placeholder="子节点名称"
          />
          <textarea
            className="input font-mono text-xs"
            rows={4}
            value={JSON.stringify(n.data.config || {}, null, 2)}
            onChange={(e) => {
              try {
                const cfg = JSON.parse(e.target.value) as Record<string, unknown>;
                updateNodeData(i, { ...n.data, config: cfg });
              } catch {
                /* 输入非法 JSON 时暂不更新 */
              }
            }}
            placeholder='{"prompt": "处理：{{item}}"}'
          />
          <p className="mt-1 text-[11px] text-slate-400">
            可用变量：{"{{item}}"}（当前项）、{"{{itemIndex}}"}，以及外层所有节点输出如 {"{{llm-1.text}}"}
          </p>
        </div>
      ))}
      <button
        className="btn-secondary w-full"
        onClick={() =>
          setNodes([
            ...nodes,
            {
              id: `sub-${Date.now().toString(36)}`,
              type: "llm",
              position: { x: 0, y: 0 },
              data: { label: "处理单项", config: { prompt: "处理以下内容：{{item}}" } },
            },
          ])
        }
      >
        + 添加子节点（按顺序线性执行）
      </button>
    </div>
  );
}

export default function NodeConfigPanel() {
  const { nodes, selectedId, updateNodeLabel, updateNodeConfig, removeNode } = useEditorStore();
  const node = nodes.find((n) => n.id === selectedId);
  if (!node) {
    return (
      <div className="p-4 text-sm text-slate-400">
        点击画布中的节点进行配置；点击空白处取消选择。
        <div className="mt-3 rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-500">
          模板变量语法：{"{{nodeId.field}}"}，例如 {"{{llm-1.text}}"}、{"{{input.topic}}"}。
          条件表达式示例：{"{{score}} > 0.8"}。
        </div>
      </div>
    );
  }
  const type = node.data.nodeType;
  const meta = NODE_META[type];
  const cfg = node.data.config || {};
  const set = (patch: FlowNodeConfig) => updateNodeConfig(node.id, { ...cfg, ...patch });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="mb-1 text-xs font-medium" style={{ color: meta.color }}>
          {meta.label} · {meta.category}
        </div>
        <input
          className="input font-semibold"
          value={node.data.label}
          onChange={(e) => updateNodeLabel(node.id, e.target.value)}
        />
        <p className="mt-1 text-[11px] text-slate-400">节点 ID：{node.id}（模板中引用输出时使用）</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {type === "trigger-manual" && (
          <p className="text-sm text-slate-500">
            手动触发：运行时可传入 JSON 作为 input，模板中用 {"{{input.xxx}}"} 引用。
          </p>
        )}
        {type === "trigger-schedule" && (
          <Field label="Cron 表达式（UTC）" hint="5 字段：分 时 日 月 周，例如 0 9 * * * 表示每天 9 点">
            <input className="input font-mono" value={String(cfg.cron || "")} onChange={(e) => set({ cron: e.target.value })} />
          </Field>
        )}
        {type === "llm" && (
          <>
            <Field label="模型（留空用默认）" hint="覆盖环境变量中的默认模型">
              <input className="input font-mono" value={String(cfg.model || "")} onChange={(e) => set({ model: e.target.value })} placeholder="gpt-4o-mini" />
            </Field>
            <Field label="System Prompt">
              <textarea className="input" rows={3} value={String(cfg.systemPrompt || "")} onChange={(e) => set({ systemPrompt: e.target.value })} />
            </Field>
            <Field label="Prompt（支持 {{变量}}）">
              <textarea className="input" rows={6} value={String(cfg.prompt || "")} onChange={(e) => set({ prompt: e.target.value })} />
            </Field>
            <div className="flex gap-3">
              <Field label="Temperature">
                <input className="input" type="number" step="0.1" min="0" max="2" value={Number(cfg.temperature ?? 0.7)} onChange={(e) => set({ temperature: Number(e.target.value) })} />
              </Field>
              <Field label="Max Tokens">
                <input className="input" type="number" min="1" max={128000} value={Number(cfg.maxTokens ?? 2048)} onChange={(e) => set({ maxTokens: Number(e.target.value) })} />
              </Field>
            </div>
          </>
        )}
        {type === "http-request" && (
          <>
            <Field label="Method">
              <select className="input" value={String(cfg.method || "GET")} onChange={(e) => set({ method: e.target.value })}>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="URL（支持 {{变量}}）">
              <input className="input font-mono" value={String(cfg.url || "")} onChange={(e) => set({ url: e.target.value })} />
            </Field>
            <Field label="Headers（JSON）">
              <textarea
                className="input font-mono text-xs"
                rows={3}
                value={typeof cfg.headers === "string" ? (cfg.headers as string) : JSON.stringify(cfg.headers || {}, null, 2)}
                onChange={(e) => set({ headers: e.target.value })}
              />
            </Field>
            <Field label="Body（支持 {{变量}}）">
              <textarea className="input font-mono text-xs" rows={4} value={String(cfg.body || "")} onChange={(e) => set({ body: e.target.value })} />
            </Field>
            <div className="flex items-center gap-2">
              <Field label="超时 ms">
                <input className="input" type="number" value={Number(cfg.timeoutMs ?? 30000)} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
              </Field>
              <label className="mt-5 flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={cfg.failOnError !== false} onChange={(e) => set({ failOnError: e.target.checked })} />
                非 2xx 视为失败
              </label>
            </div>
          </>
        )}
        {type === "condition" && (
          <Field
            label="条件表达式"
            hint='支持 {{变量}} 与比较：==, !=, >, <, >=, <=, contains。例如：{{score}} > 0.8'
          >
            <input className="input font-mono" value={String(cfg.expression || "")} onChange={(e) => set({ expression: e.target.value })} placeholder="{{score}} > 0.8" />
          </Field>
        )}
        {type === "loop" && (
          <>
            <Field label="Items（JSON 数组或 {{变量}}）" hint="例如：{{trigger-1.list}} 或 [&quot;a&quot;,&quot;b&quot;]">
              <textarea className="input font-mono text-xs" rows={3} value={String(cfg.items ?? "[]")} onChange={(e) => set({ items: e.target.value })} />
            </Field>
            <div className="flex gap-3">
              <Field label="单项变量名">
                <input className="input" value={String(cfg.itemVar || "item")} onChange={(e) => set({ itemVar: e.target.value })} />
              </Field>
              <Field label="最大迭代数">
                <input className="input" type="number" min="1" max="100" value={Number(cfg.maxIterations ?? 25)} onChange={(e) => set({ maxIterations: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="内部子流程">
              <LoopSubflowEditor config={cfg} onChange={(c) => updateNodeConfig(node.id, c)} />
            </Field>
          </>
        )}
        {type === "rag-retrieve" && (
          <>
            <Field label="检索 Query（支持 {{变量}}）">
              <textarea className="input" rows={3} value={String(cfg.query || "")} onChange={(e) => set({ query: e.target.value })} />
            </Field>
            <div className="flex gap-3">
              <Field label="Top K">
                <input className="input" type="number" min="1" max="50" value={Number(cfg.topK ?? 5)} onChange={(e) => set({ topK: Number(e.target.value) })} />
              </Field>
              <Field label="最低相似度">
                <input className="input" type="number" step="0.05" min="0" max="1" value={Number(cfg.minScore ?? 0)} onChange={(e) => set({ minScore: Number(e.target.value) })} />
              </Field>
            </div>
            <p className="text-[11px] text-slate-400">先在「知识库」中上传文档 chunk，检索结果为 {"{{nodeId.chunks}}"}（含 content / similarity）。</p>
          </>
        )}
        {type === "human-approval" && (
          <>
            <Field label="审批标题">
              <input className="input" value={String(cfg.title || "")} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="说明（支持 {{变量}}）">
              <textarea className="input" rows={4} value={String(cfg.message || "")} onChange={(e) => set({ message: e.target.value })} />
            </Field>
            <Field label="超时（小时），超时视为拒绝">
              <input className="input" type="number" min="1" max="720" value={Number(cfg.timeoutHours ?? 24)} onChange={(e) => set({ timeoutHours: Number(e.target.value) })} />
            </Field>
          </>
        )}
        {type === "output" && (
          <Field label="输出字段（字段名 → 模板）" hint="最终结果将合并所有 output 节点的字段">
            <KVEditor
              value={(cfg.fields as Record<string, string>) || {}}
              onChange={(v) => set({ fields: v })}
            />
          </Field>
        )}
      </div>
      <div className="border-t border-slate-200 p-3">
        <button className="btn-danger w-full" onClick={() => removeNode(node.id)}>
          删除节点
        </button>
      </div>
    </div>
  );
}
