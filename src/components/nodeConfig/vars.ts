// 变量选择器的数据来源：收集"当前节点上游"所有可用变量，
// 让用户点选插入，不用手写 {{nodeId.field}}。

import type { NodeType } from "@/lib/engine/types";

export interface VarOption {
  /** 不带花括号，如 "llm-draft.text" */
  value: string;
  /** 下拉中显示，如 "起草文案 · text" */
  label: string;
  /** 变量含义，如 "模型输出的文本" */
  desc: string;
  group: "触发输入" | "上游节点";
}

/** 每种节点类型的已知输出字段（傻瓜化文案） */
export const NODE_OUTPUTS: Record<string, { field: string; desc: string }[]> = {
  "trigger-manual": [],
  "trigger-schedule": [{ field: "triggered_at", desc: "触发时间" }],
  llm: [{ field: "text", desc: "模型输出的文本" }],
  "http-request": [
    { field: "status", desc: "状态码" },
    { field: "body", desc: "响应内容" },
  ],
  condition: [
    { field: "result", desc: "是否成立（true/false）" },
    { field: "branch", desc: "走的分支（true/false）" },
  ],
  loop: [{ field: "results", desc: "每一轮的结果数组" }],
  "rag-retrieve": [{ field: "chunks", desc: "检索到的文档块" }],
  "human-approval": [
    { field: "decision", desc: "审批结果（approved/rejected）" },
    { field: "comment", desc: "审批意见" },
  ],
  output: [],
};

interface MiniNode {
  id: string;
  type: string;
  data?: { label?: string; config?: Record<string, unknown> };
}
interface MiniEdge {
  source: string;
  target: string;
}

/**
 * 收集 nodeId 上游（传递闭包）所有节点的可用变量。
 * output 节点的自定义字段也会展开。
 */
export function collectUpstreamVars(
  nodes: MiniNode[],
  edges: MiniEdge[],
  nodeId: string
): VarOption[] {
  const vars: VarOption[] = [
    { value: "input", label: "input · 整个输入", desc: "运行时填的 JSON，用 input.字段名 取具体字段", group: "触发输入" },
  ];
  // 反向 BFS 找所有上游
  const byTarget = new Map<string, string[]>();
  for (const e of edges) {
    const list = byTarget.get(e.target) || [];
    list.push(e.source);
    byTarget.set(e.target, list);
  }
  const seen = new Set<string>([nodeId]);
  const queue = [...(byTarget.get(nodeId) || [])];
  const upstream: MiniNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodes.find((x) => x.id === id);
    if (n) upstream.push(n);
    queue.push(...(byTarget.get(id) || []));
  }
  // 按画布从左到右排序更符合直觉
  const posX = (n: MiniNode) => (n as { position?: { x: number } }).position?.x ?? 0;
  upstream.sort((a, b) => posX(a) - posX(b));

  for (const n of upstream) {
    const name = n.data?.label || n.id;
    const outs = NODE_OUTPUTS[n.type] || [];
    for (const o of outs) {
      vars.push({
        value: `${n.id}.${o.field}`,
        label: `${name} · ${o.field}`,
        desc: o.desc,
        group: "上游节点",
      });
    }
    // output 节点的自定义字段
    if (n.type === "output") {
      const fields = (n.data?.config?.fields as Record<string, unknown>) || {};
      for (const k of Object.keys(fields)) {
        vars.push({
          value: `${n.id}.${k}`,
          label: `${name} · ${k}`,
          desc: "该节点输出的自定义字段",
          group: "上游节点",
        });
      }
    }
  }
  return vars;
}

/** 子流程（loop 内部）可用的变量：外层变量 + item/itemIndex */
export function subflowVars(outer: VarOption[]): VarOption[] {
  return [
    { value: "item", label: "item · 当前项", desc: "循环正在处理的这一项", group: "触发输入" },
    { value: "itemIndex", label: "itemIndex · 序号", desc: "当前是第几项（从 0 开始）", group: "触发输入" },
    ...outer,
  ];
}

export type { NodeType };
