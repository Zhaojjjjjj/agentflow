// Shared workflow graph types used by the editor, API routes and the executor.

export type NodeType =
  | "trigger-manual"
  | "trigger-schedule"
  | "llm"
  | "http-request"
  | "condition"
  | "loop"
  | "rag-retrieve"
  | "human-approval"
  | "output";

export interface FlowNodeConfig {
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: FlowNodeConfig;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface WorkflowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "rejected"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "waiting_approval";

export const NODE_META: Record<
  NodeType,
  { label: string; description: string; category: string; color: string }
> = {
  "trigger-manual": {
    label: "手动触发",
    description: "从控制台或 API 手动启动，携带输入参数",
    category: "触发器",
    color: "#2563eb",
  },
  "trigger-schedule": {
    label: "定时触发",
    description: "按 cron 表达式定时自动运行",
    category: "触发器",
    color: "#7c3aed",
  },
  llm: {
    label: "大模型",
    description: "调用 LLM 生成文本，支持模板变量与多 Provider 降级",
    category: "AI",
    color: "#059669",
  },
  "http-request": {
    label: "HTTP 请求",
    description: "调用任意 HTTP API（GET/POST/PUT/PATCH/DELETE）",
    category: "工具",
    color: "#ea580c",
  },
  condition: {
    label: "条件分支",
    description: "按表达式结果走 true / false 分支",
    category: "逻辑",
    color: "#ca8a04",
  },
  loop: {
    label: "循环",
    description: "遍历数组，对每项执行内部子流程（含迭代上限保护）",
    category: "逻辑",
    color: "#0d9488",
  },
  "rag-retrieve": {
    label: "知识检索",
    description: "在工作流知识库中做向量相似检索",
    category: "AI",
    color: "#4f46e5",
  },
  "human-approval": {
    label: "人工审批",
    description: "暂停等待人工确认 / 拒绝后继续",
    category: "逻辑",
    color: "#dc2626",
  },
  output: {
    label: "输出汇总",
    description: "汇总指定字段作为工作流最终结果",
    category: "输出",
    color: "#16a34a",
  },
};

export function emptyDefinition(): WorkflowDefinition {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger-manual",
        position: { x: 80, y: 200 },
        data: { label: "手动触发", config: {} },
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 480, y: 200 },
        data: { label: "输出汇总", config: { fields: { result: "{{trigger-1}}" } } },
      },
    ],
    edges: [{ id: "e1", source: "trigger-1", target: "output-1" }],
  };
}
