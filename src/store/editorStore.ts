"use client";

import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from "@xyflow/react";
import type { FlowNodeConfig, NodeType, StepStatus, WorkflowDefinition } from "@/lib/engine/types";
import { NODE_META, findCycle } from "@/lib/engine/types";
import { toast } from "@/components/toast";

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  config: FlowNodeConfig;
  nodeType: NodeType;
}

export type AgentNode = Node<AgentNodeData, "agentNode">;
export type AgentEdge = Edge;

let counter = 0;
function nid(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function defaultConfig(type: NodeType): FlowNodeConfig {
  switch (type) {
    case "trigger-manual":
      return {};
    case "trigger-schedule":
      return { cron: "0 9 * * *" };
    case "llm":
      return {
        model: "",
        systemPrompt: "",
        prompt: "请用一句话介绍 {{input.topic}}。",
        temperature: 0.7,
        maxTokens: 2048,
      };
    case "http-request":
      return {
        method: "GET",
        url: "https://api.example.com/data",
        headers: {},
        body: "",
        timeoutMs: 30000,
        failOnError: true,
      };
    case "condition":
      return { expression: "" };
    case "loop": {
      const subLlm = "sub-llm-1";
      const subOut = "sub-output-1";
      return {
        items: "[]",
        itemVar: "item",
        maxIterations: 25,
        nodes: [
          {
            id: subLlm,
            type: "llm",
            position: { x: 0, y: 0 },
            data: {
              label: "处理单项",
              config: { model: "", systemPrompt: "", prompt: "处理以下内容：{{item}}", temperature: 0.7, maxTokens: 1024 },
            },
          },
          {
            id: subOut,
            type: "output",
            position: { x: 0, y: 0 },
            data: { label: "单项输出", config: { fields: { text: "{{sub-llm-1.text}}" } } },
          },
        ],
        edges: [{ id: `e-${subLlm}-${subOut}`, source: subLlm, target: subOut }],
      };
    }
    case "rag-retrieve":
      return { query: "", topK: 5, minScore: 0 };
    case "human-approval":
      return { title: "请审批", message: "工作流已暂停，等待人工确认后继续。", timeoutHours: 24 };
    case "output":
      return { fields: { result: "" } };
  }
}

interface EditorState {
  nodes: AgentNode[];
  edges: AgentEdge[];
  selectedId: string | null;
  dirty: boolean;
  onNodesChange: OnNodesChange<AgentNode>;
  onEdgesChange: OnEdgesChange<AgentEdge>;
  onConnect: OnConnect;
  setSelected: (id: string | null) => void;
  addNode: (type: NodeType, position?: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeConfig: (id: string, config: FlowNodeConfig) => void;
  load: (def: WorkflowDefinition) => void;
  getDefinition: () => WorkflowDefinition;
  markClean: () => void;
  /** 实时运行中的节点状态（runId 维度，key 为节点 id） */
  nodeStatuses: Record<string, StepStatus>;
  setNodeStatuses: (s: Record<string, StepStatus>) => void;
  clearNodeStatuses: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  dirty: false,

  onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), dirty: true })),
  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges), dirty: true })),
  onConnect: (conn: Connection) => {
    if (!conn.source || !conn.target) return;
    // 防呆：新连线会形成循环依赖时直接拒绝，并用 toast 提示
    const { nodes, edges } = get();
    const candidate = {
      id: nid("e"),
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle ?? null,
      targetHandle: conn.targetHandle ?? null,
    };
    const def = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        position: n.position,
        data: { label: n.data.label, config: n.data.config },
      })),
      edges: [
        ...edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
        })),
        candidate,
      ],
    };
    if (findCycle(def)) {
      toast.error("连接会形成循环依赖，已拒绝");
      return;
    }
    set((s) => ({ edges: addEdge({ ...conn, id: candidate.id }, s.edges), dirty: true }));
  },

  setSelected: (id) => set({ selectedId: id }),

  addNode: (type, position) =>
    set((s) => {
      const n = s.nodes.length;
      const pos = position
        ? { x: position.x + ((n * 37) % 60) - 30, y: position.y + ((n * 53) % 60) - 30 }
        : { x: 120 + (n % 6) * 60, y: 120 + Math.floor(n / 6) * 80 };
      const node: AgentNode = {
        id: nid(type),
        type: "agentNode",
        position: pos,
        data: { label: NODE_META[type].label, config: defaultConfig(type), nodeType: type },
      };
      return { nodes: [...s.nodes, node], selectedId: node.id, dirty: true };
    }),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      dirty: true,
    })),

  updateNodeLabel: (id, label) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
      dirty: true,
    })),

  updateNodeConfig: (id, config) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config } } : n)),
      dirty: true,
    })),

  load: (def) =>
    set({
      nodes: def.nodes.map((n) => ({
        id: n.id,
        type: "agentNode",
        position: n.position,
        data: { label: n.data.label, config: n.data.config || {}, nodeType: n.type },
      })),
      edges: def.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      })),
      selectedId: null,
      dirty: false,
    }),

  getDefinition: () => {
    const { nodes, edges } = get();
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        position: n.position,
        data: { label: n.data.label, config: n.data.config },
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    };
  },

  markClean: () => set({ dirty: false }),

  nodeStatuses: {},
  setNodeStatuses: (s) => set({ nodeStatuses: s }),
  clearNodeStatuses: () => set({ nodeStatuses: {} }),
}));
