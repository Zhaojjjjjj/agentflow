"use client";

import { useMemo, useState } from "react";
import { NODE_META, type FlowNodeConfig, type NodeType } from "@/lib/engine/types";
import { useEditorStore } from "@/store/editorStore";
import { Field, Button, ConfirmDialog } from "./ui";
import { collectUpstreamVars, subflowVars } from "./nodeConfig/vars";
import {
  TemplateTextarea,
  TemplateInput,
  TemperatureSlider,
  ConditionBuilder,
  ScheduleBuilder,
  ModelPicker,
  KVEditor,
} from "./nodeConfig/fields";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-5 text-xs font-semibold text-slate-700 first:mt-0">{children}</p>;
}

const SUB_TYPES: NodeType[] = ["llm", "http-request", "rag-retrieve", "output"];

interface SubNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; config: Record<string, unknown> };
}

/** 循环内部子流程：按子节点类型给迷你表单，不再手写 JSON */
function LoopSubflowEditor({
  config,
  onChange,
  outerVars,
}: {
  config: FlowNodeConfig;
  onChange: (c: FlowNodeConfig) => void;
  outerVars: ReturnType<typeof collectUpstreamVars>;
}) {
  const vars = useMemo(() => subflowVars(outerVars), [outerVars]);
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
    setNodes(nodes.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  };
  const setCfg = (idx: number, patch: Record<string, unknown>) => {
    const n = nodes[idx];
    updateNode(idx, { data: { ...n.data, config: { ...n.data.config, ...patch } } });
  };

  return (
    <div className="space-y-2.5">
      {nodes.map((n, i) => {
        const sc = n.data.config || {};
        return (
          <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                {i + 1}
              </span>
              <select
                className="input flex-1 !py-1.5 text-xs"
                value={n.type}
                onChange={(e) => {
                  const t = e.target.value as NodeType;
                  updateNode(i, { type: t, data: { label: NODE_META[t].label, config: {} } });
                }}
              >
                {SUB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {NODE_META[t].label}
                  </option>
                ))}
              </select>
              <button
                className="shrink-0 rounded-md px-1.5 py-1 text-sm text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                onClick={() => setNodes(nodes.filter((_, j) => j !== i))}
                title="删除子节点"
              >
                ×
              </button>
            </div>
            <input
              className="input mb-2 !py-1.5 text-xs"
              value={n.data.label}
              onChange={(e) => updateNode(i, { data: { ...n.data, label: e.target.value } })}
              placeholder="子节点名称"
            />
            {n.type === "llm" && (
              <TemplateTextarea
                rows={3}
                vars={vars}
                value={String(sc.prompt || "")}
                onChange={(v) => setCfg(i, { prompt: v })}
                placeholder="对这一项做什么，比如：把下面这段话翻译成英文：{{item}}"
              />
            )}
            {n.type === "http-request" && (
              <div className="flex gap-2">
                <select
                  className="input w-24 shrink-0 !py-1.5 text-xs"
                  value={String(sc.method || "GET")}
                  onChange={(e) => setCfg(i, { method: e.target.value })}
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <div className="min-w-0 flex-1">
                  <TemplateInput
                    vars={vars}
                    value={String(sc.url || "")}
                    onChange={(v) => setCfg(i, { url: v })}
                    placeholder="网址，如 https://api.example.com/score?text={{item}}"
                    mono
                  />
                </div>
              </div>
            )}
            {n.type === "rag-retrieve" && (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <TemplateInput
                    vars={vars}
                    value={String(sc.query || "")}
                    onChange={(v) => setCfg(i, { query: v })}
                    placeholder="搜什么，比如：{{item}}"
                  />
                </div>
                <input
                  className="input w-20 shrink-0 !py-1.5 text-xs"
                  type="number"
                  min={1}
                  max={50}
                  title="取几条"
                  value={Number(sc.topK ?? 5)}
                  onChange={(e) => setCfg(i, { topK: Number(e.target.value) })}
                />
              </div>
            )}
            {n.type === "output" && (
              <KVEditor
                vars={vars}
                value={(sc.fields as Record<string, string>) || {}}
                onChange={(v) => setCfg(i, { fields: v })}
              />
            )}
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
              {"{{item}}"} 是当前这一项，{"{{itemIndex}}"} 是第几项
            </p>
          </div>
        );
      })}
      <button
        className="w-full rounded-lg border border-dashed border-slate-200 py-2.5 text-sm text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600"
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

const REQUIRED_MSG = "此项为必填，运行前请填写";

export default function NodeConfigPanel() {
  const { nodes, edges, selectedId, updateNodeLabel, updateNodeConfig, removeNode } = useEditorStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const node = nodes.find((n) => n.id === selectedId);
  const vars = useMemo(
    () => (node ? collectUpstreamVars(nodes as never, edges as never, node.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node?.id, nodes, edges]
  );

  if (!node) {
    return (
      <div className="p-5 text-sm text-slate-400">
        点击画布中的节点进行配置；点击空白处取消选择。
        <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs leading-6 text-slate-500">
          <p className="font-semibold text-slate-600">不用记任何语法</p>
          <p>需要引用前面的结果时，点输入框上方的「+ 插入变量」，选一个就行。</p>
        </div>
      </div>
    );
  }

  const type = node.data.nodeType;
  const meta = NODE_META[type];
  const cfg = node.data.config || {};
  const set = (patch: FlowNodeConfig) => updateNodeConfig(node.id, { ...cfg, ...patch });
  const blank = (v: unknown) => !String(v ?? "").trim();

  // HTTP headers：对象用键值编辑器，解析失败的字符串回退为文本框
  const headersObj = (() => {
    const h = cfg.headers;
    if (!h) return {};
    if (typeof h === "object") return h as Record<string, string>;
    try {
      const o = JSON.parse(h as string);
      return typeof o === "object" && o ? o : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: meta.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
          {meta.label} · {meta.category}
        </div>
        <input
          className="input font-semibold"
          value={node.data.label}
          onChange={(e) => updateNodeLabel(node.id, e.target.value)}
        />
        <p className="mt-1.5 text-[11px] text-slate-400">节点 ID：{node.id}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {type === "trigger-manual" && (
          <div className="rounded-xl bg-slate-50 p-3.5 text-[13px] leading-6 text-slate-600">
            <p className="font-semibold text-slate-700">这是工作流的起点</p>
            <p className="mt-1">
              点「运行」时会让你填一段输入（JSON），后面的节点点「插入变量」就能用里面的内容。
            </p>
            <p className="mt-2 font-mono text-xs text-slate-500">
              比如输入 {"{"}"topic": "AI Agent"{"}"}，后面用 {"{{input.topic}}"} 引用
            </p>
          </div>
        )}

        {type === "trigger-schedule" && (
          <Field label="什么时候自动运行">
            <ScheduleBuilder value={String(cfg.cron || "")} onChange={(v) => set({ cron: v })} />
          </Field>
        )}

        {type === "llm" && (
          <>
            <SectionTitle>模型</SectionTitle>
            <Field label="用哪个模型">
              <ModelPicker value={String(cfg.model || "")} onChange={(v) => set({ model: v })} />
            </Field>
            <Field label="回答风格">
              <TemperatureSlider value={Number(cfg.temperature ?? 0.7)} onChange={(v) => set({ temperature: v })} />
            </Field>
            <Field label="回复长度上限" hint="单位 token，约等于汉字数，默认 2048">
              <input
                className="input"
                type="number"
                min={1}
                max={128000}
                value={Number(cfg.maxTokens ?? 2048)}
                onChange={(e) => set({ maxTokens: Number(e.target.value) })}
              />
            </Field>
            <SectionTitle>提示词</SectionTitle>
            <Field label="角色设定（可选）" hint="比如：你是一位资深中文营销文案专家">
              <textarea
                className="input"
                rows={2}
                value={String(cfg.systemPrompt || "")}
                onChange={(e) => set({ systemPrompt: e.target.value })}
                placeholder="你是一位…"
              />
            </Field>
            <Field
              label="提示词"
              required
              hint="告诉 AI 做什么。点「插入变量」把前面的结果放进来"
              error={blank(cfg.prompt) ? REQUIRED_MSG : undefined}
            >
              <TemplateTextarea
                rows={6}
                vars={vars}
                value={String(cfg.prompt || "")}
                onChange={(v) => set({ prompt: v })}
                placeholder="比如：把下面的大纲扩展成一篇文章："
              />
            </Field>
          </>
        )}

        {type === "http-request" && (
          <>
            <SectionTitle>请求</SectionTitle>
            <div className="flex gap-3">
              <div className="w-28 shrink-0">
                <Field label="方式">
                  <select className="input" value={String(cfg.method || "GET")} onChange={(e) => set({ method: e.target.value })}>
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="min-w-0 flex-1">
                <Field label="网址" required error={blank(cfg.url) ? REQUIRED_MSG : undefined}>
                  <TemplateInput
                    vars={vars}
                    mono
                    value={String(cfg.url || "")}
                    onChange={(v) => set({ url: v })}
                    placeholder="https://api.example.com/xxx"
                  />
                </Field>
              </div>
            </div>
            <Field label="请求头（一般不用填）">
              {headersObj === null ? (
                <TemplateTextarea
                  rows={3}
                  vars={vars}
                  value={String(cfg.headers || "")}
                  onChange={(v) => set({ headers: v })}
                />
              ) : (
                <KVEditor vars={vars} value={headersObj} onChange={(v) => set({ headers: v })} valuePlaceholder="比如：Bearer xxx" />
              )}
            </Field>
            <Field label="请求内容" hint="GET 请求不用填；POST 等把要发送的内容写在这里">
              <TemplateTextarea
                rows={4}
                vars={vars}
                value={String(cfg.body || "")}
                onChange={(v) => set({ body: v })}
                placeholder='{"text": "要发送的内容"}'
              />
            </Field>
            <SectionTitle>高级</SectionTitle>
            <div className="flex items-center gap-3">
              <Field label="超时（秒）">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={300}
                  value={Math.round(Number(cfg.timeoutMs ?? 30000) / 1000)}
                  onChange={(e) => set({ timeoutMs: Math.max(1, Number(e.target.value) || 30) * 1000 })}
                />
              </Field>
              <label className="mt-5 flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={cfg.failOnError !== false}
                  onChange={(e) => set({ failOnError: e.target.checked })}
                />
                报错时停下来
              </label>
            </div>
          </>
        )}

        {type === "condition" && (
          <Field label="什么时候走「是」分支" hint="比如：上一步的分数大于 0.8，就走「是」，否则走「否」">
            <ConditionBuilder value={String(cfg.expression || "")} onChange={(v) => set({ expression: v })} vars={vars} />
          </Field>
        )}

        {type === "loop" && (
          <>
            <SectionTitle>循环设置</SectionTitle>
            <Field
              label="循环处理哪些内容"
              hint="点「插入变量」选上游的数组，比如搜到的文档块"
            >
              <TemplateTextarea
                rows={3}
                vars={vars}
                value={String(cfg.items ?? "")}
                onChange={(v) => set({ items: v })}
                placeholder="{{rag-1.chunks}}"
              />
            </Field>
            <div className="flex gap-3">
              <Field label="最多循环几次" hint="防止死循环">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={Number(cfg.maxIterations ?? 25)}
                  onChange={(e) => set({ maxIterations: Number(e.target.value) })}
                />
              </Field>
              <Field label="每一项叫什么" hint="子流程里用 {{item}} 表示当前项，一般不用改">
                <input
                  className="input"
                  value={String(cfg.itemVar || "item")}
                  onChange={(e) => set({ itemVar: e.target.value })}
                />
              </Field>
            </div>
            <SectionTitle>对每一项做什么</SectionTitle>
            <LoopSubflowEditor config={cfg} onChange={(c) => updateNodeConfig(node.id, c)} outerVars={vars} />
          </>
        )}

        {type === "rag-retrieve" && (
          <>
            <SectionTitle>检索设置</SectionTitle>
            <Field
              label="要搜什么"
              required
              hint="写一句话，或点「插入变量」用上游的内容来搜"
              error={blank(cfg.query) ? REQUIRED_MSG : undefined}
            >
              <TemplateTextarea
                rows={3}
                vars={vars}
                value={String(cfg.query || "")}
                onChange={(v) => set({ query: v })}
                placeholder="比如：产品的退货政策"
              />
            </Field>
            <Field label={`取几条结果：${Number(cfg.topK ?? 5)} 条`}>
              <input
                type="range"
                min={1}
                max={50}
                value={Number(cfg.topK ?? 5)}
                onChange={(e) => set({ topK: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </Field>
            <Field label={`相似度门槛：${Number(cfg.minScore ?? 0).toFixed(2)}`} hint="0 = 不限制，越高越严格">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(cfg.minScore ?? 0)}
                onChange={(e) => set({ minScore: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </Field>
            <p className="text-[11px] leading-5 text-slate-400">
              先在「知识库」里上传文档。搜到的结果叫 {"{{节点ID.chunks}}"}，点「插入变量」就能用。
            </p>
          </>
        )}

        {type === "human-approval" && (
          <>
            <SectionTitle>审批设置</SectionTitle>
            <Field label="审批标题" hint="比如：审核营销文案">
              <input
                className="input"
                value={String(cfg.title || "")}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="审核营销文案"
              />
            </Field>
            <Field label="给审批人看什么" hint="把需要审批的内容写清楚，点「插入变量」把 AI 生成的结果放进来">
              <TemplateTextarea
                rows={4}
                vars={vars}
                value={String(cfg.message || "")}
                onChange={(v) => set({ message: v })}
                placeholder="初稿已生成，请审核："
              />
            </Field>
            <Field label="超时自动拒绝（小时）">
              <input
                className="input"
                type="number"
                min={1}
                max={720}
                value={Number(cfg.timeoutHours ?? 24)}
                onChange={(e) => set({ timeoutHours: Number(e.target.value) })}
              />
            </Field>
          </>
        )}

        {type === "output" && (
          <Field label="输出哪些内容" hint="运行结束后，这里列的内容就是最终结果">
            <KVEditor
              vars={vars}
              value={(cfg.fields as Record<string, string>) || {}}
              onChange={(v) => set({ fields: v })}
              valuePlaceholder="点「插入变量」选上游结果"
            />
          </Field>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <Button variant="ghost" size="sm" className="w-full text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
          删除节点
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除节点"
        description={`确定删除「${node.data.label || meta.label}」吗？与其相连的连线将一并移除。`}
        confirmLabel="删除"
        danger
        onConfirm={() => removeNode(node.id)}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
