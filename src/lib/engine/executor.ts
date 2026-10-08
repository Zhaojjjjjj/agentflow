// DAG workflow execution engine.
// Shared by the Inngest background worker and the synchronous API runner.

import { getSupabase } from "../supabase";
import { chat } from "../llm/providers";
import { estimateCost } from "../llm/pricing";
import { embed } from "../llm/embeddings";
import { interpolate, interpolateDeep } from "./interpolate";
import type { FlowNode, FlowEdge, WorkflowDefinition } from "./types";

/** Thrown when a human-approval node is rejected (marks the run "rejected", not "failed"). */
export class RejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RejectedError";
  }
}

export interface ApprovalRequest {
  runId: string;
  nodeId: string;
  approvalKey: string;
  title: string;
  message: string;
  timeoutHours: number;
}

export interface ApprovalDecision {
  decision: "approved" | "rejected";
  comment?: string;
}

/**
 * Step abstraction: Inngest durable steps in background mode,
 * direct invocation in synchronous mode.
 */
export interface StepRunner {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  waitForApproval(req: ApprovalRequest): Promise<ApprovalDecision>;
}

export type TraceStepStatus = "succeeded" | "failed" | "skipped" | "waiting_approval";

export interface TraceWriter {
  stepStart(
    runId: string,
    nodeId: string,
    nodeType: string,
    nodeName: string,
    input: unknown
  ): Promise<string>;
  stepEnd(
    traceId: string,
    patch: {
      status: TraceStepStatus;
      output?: unknown;
      tokens?: number;
      cost?: number;
      durationMs?: number;
      error?: string;
    }
  ): Promise<void>;
  /** Update the parent run's status (used for waiting_approval). */
  setRunStatus(runId: string, status: string): Promise<void>;
}

export interface NodeResult {
  output: Record<string, unknown>;
  tokens: number;
  cost: number;
}

interface ExecState {
  runId: string;
  workflowId: string;
  runner: StepRunner;
  trace: TraceWriter;
  stats: { tokens: number; cost: number };
  depth: number;
  prefix: string;
  rejected: boolean;
}

export interface GraphExecArgs {
  runId: string;
  workflowId: string;
  definition: WorkflowDefinition;
  baseContext: Record<string, unknown>;
  runner: StepRunner;
  trace: TraceWriter;
  stats: { tokens: number; cost: number };
  depth?: number;
  prefix?: string;
}

const MAX_LOOP_DEPTH = 3;
const MAX_LOOP_ITERATIONS = 100;

function parseOperand(t: string): unknown {
  const s = t.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "undefined") return null;
  if (s !== "" && !Number.isNaN(Number(s))) return Number(s);
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function compareValues(l: unknown, op: string, r: unknown): boolean {
  switch (op) {
    case "==":
    case "===":
      // eslint-disable-next-line eqeqeq
      return l == r;
    case "!=":
    case "!==":
      // eslint-disable-next-line eqeqeq
      return l != r;
    case ">":
      return (l as number) > (r as number);
    case "<":
      return (l as number) < (r as number);
    case ">=":
      return (l as number) >= (r as number);
    case "<=":
      return (l as number) <= (r as number);
    case "contains":
      return String(l).includes(String(r));
    case "not contains":
      return !String(l).includes(String(r));
    case "starts with":
      return String(l).startsWith(String(r));
    case "ends with":
      return String(l).endsWith(String(r));
    default:
      return false;
  }
}

/**
 * Evaluate a condition expression after template interpolation.
 * Supports: a single truthy value, or `left OP right` with
 * OP in ==,===,!=,!==,>,<,>=,<=,contains,not contains,starts with,ends with.
 */
function evaluateCondition(expr: unknown, ctx: Record<string, unknown>): boolean {
  const v = interpolate(expr, ctx);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;
  const m = s.match(
    /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<|not contains|contains|starts with|ends with)\s*(.+)$/s
  );
  if (!m) {
    const low = s.toLowerCase();
    return low !== "false" && low !== "0" && low !== "no" && low !== "null";
  }
  const left = parseOperand(m[1]);
  const right = parseOperand(m[3]);
  return compareValues(left, m[2], right);
}

async function executeNode(
  node: FlowNode,
  ctx: Record<string, unknown>,
  st: ExecState,
  fullId: string
): Promise<NodeResult> {
  const cfg = node.data.config || {};

  switch (node.type) {
    case "trigger-manual":
    case "trigger-schedule": {
      const input = (ctx["input"] as Record<string, unknown>) ?? {};
      return { output: { ...input }, tokens: 0, cost: 0 };
    }

    case "llm": {
      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
      const system = cfg.systemPrompt ? String(interpolate(cfg.systemPrompt, ctx) ?? "") : "";
      const prompt = String(interpolate(cfg.prompt ?? "", ctx) ?? "");
      if (!prompt.trim()) throw new Error(`LLM 节点 "${node.id}" 的 prompt 为空`);
      if (system.trim()) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });
      const result = await chat(messages, {
        temperature: cfg.temperature !== undefined ? Number(cfg.temperature) : 0.7,
        maxTokens: cfg.maxTokens !== undefined ? Number(cfg.maxTokens) : 2048,
        model: cfg.model ? String(cfg.model) : undefined,
      });
      const cost = estimateCost(result.model, result.promptTokens, result.completionTokens);
      return {
        output: {
          text: result.text,
          provider: result.provider,
          model: result.model,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
        },
        tokens: result.totalTokens,
        cost,
      };
    }

    case "http-request": {
      const method = String(cfg.method || "GET").toUpperCase();
      const url = String(interpolate(cfg.url ?? "", ctx) ?? "");
      if (!url) throw new Error(`HTTP 节点 "${node.id}" 的 URL 为空`);
      let headers: Record<string, string> = {};
      if (cfg.headers) {
        const h = interpolateDeep(cfg.headers, ctx) as unknown;
        if (typeof h === "string") {
          try {
            headers = JSON.parse(h);
          } catch {
            throw new Error(`HTTP 节点 "${node.id}" 的 headers 不是合法 JSON`);
          }
        } else if (h && typeof h === "object") {
          headers = h as Record<string, string>;
        }
      }
      const timeoutMs = cfg.timeoutMs ? Number(cfg.timeoutMs) : 30000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let body: string | undefined;
        if (cfg.body !== undefined && cfg.body !== "" && method !== "GET" && method !== "HEAD") {
          const b = interpolate(cfg.body, ctx);
          body = typeof b === "string" ? b : JSON.stringify(b);
          if (!headers["Content-Type"] && !headers["content-type"]) {
            headers["Content-Type"] = "application/json";
          }
        }
        const res = await fetch(url, { method, headers, body, signal: controller.signal });
        const text = await res.text();
        let data: unknown = text;
        try {
          data = JSON.parse(text);
        } catch {
          /* keep as text */
        }
        const outHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          outHeaders[k] = v;
        });
        if (!res.ok && cfg.failOnError !== false) {
          throw new Error(`HTTP ${method} ${url} 返回 ${res.status}: ${text.slice(0, 300)}`);
        }
        return { output: { status: res.status, ok: res.ok, headers: outHeaders, data }, tokens: 0, cost: 0 };
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error(`HTTP 请求超时（${timeoutMs}ms）: ${method} ${url}`);
        }
        throw e;
      } finally {
        clearTimeout(timer);
      }
    }

    case "condition": {
      const result = evaluateCondition(cfg.expression ?? "", ctx);
      return {
        output: { result, branch: result ? "true" : "false", expression: String(cfg.expression ?? "") },
        tokens: 0,
        cost: 0,
      };
    }

    case "loop": {
      if (st.depth >= MAX_LOOP_DEPTH) {
        throw new Error(`循环嵌套超过最大深度 ${MAX_LOOP_DEPTH}`);
      }
      const rawItems = interpolate(cfg.items ?? "[]", ctx);
      if (!Array.isArray(rawItems)) {
        throw new Error(`循环节点 "${node.id}" 的 items 解析后不是数组`);
      }
      const maxIter = Math.min(Math.max(1, Number(cfg.maxIterations) || 25), MAX_LOOP_ITERATIONS);
      const items = rawItems.slice(0, maxIter);
      const itemVar = String(cfg.itemVar || "item");
      const subNodes = (cfg.nodes as FlowNode[]) || [];
      const subEdges = (cfg.edges as FlowEdge[]) || [];
      if (subNodes.length === 0) throw new Error(`循环节点 "${node.id}" 未配置内部子流程`);
      const results: unknown[] = [];
      for (let i = 0; i < items.length; i++) {
        const subBase: Record<string, unknown> = {
          ...ctx,
          [itemVar]: items[i],
          item: items[i],
          itemIndex: i,
        };
        const sub = await executeGraph({
          runId: st.runId,
          workflowId: st.workflowId,
          definition: { nodes: subNodes, edges: subEdges },
          baseContext: subBase,
          runner: st.runner,
          trace: st.trace,
          stats: st.stats,
          depth: st.depth + 1,
          prefix: `${fullId}/`,
        });
        results.push(sub.outputs);
      }
      return {
        output: { results, count: results.length, totalItems: rawItems.length, truncated: rawItems.length > maxIter },
        tokens: 0,
        cost: 0,
      };
    }

    case "rag-retrieve": {
      const query = String(interpolate(cfg.query ?? "", ctx) ?? "").trim();
      if (!query) throw new Error(`检索节点 "${node.id}" 的 query 为空`);
      const topK = Math.min(Math.max(1, Number(cfg.topK) || 5), 50);
      const minScore = Number(cfg.minScore) || 0;
      const vector = await embed(query);
      const sb = getSupabase();
      const { data, error } = await sb.rpc("match_documents", {
        query_embedding: vector,
        match_count: topK,
        filter_workflow_id: st.workflowId,
        min_similarity: minScore,
      });
      if (error) throw new Error(`向量检索失败: ${error.message}`);
      const chunks = (data || []).map((d: { content: string; metadata: unknown; similarity: number }) => ({
        content: d.content,
        metadata: d.metadata,
        similarity: d.similarity,
      }));
      return { output: { query, chunks, count: chunks.length }, tokens: 0, cost: 0 };
    }

    case "output": {
      const fields = (cfg.fields as Record<string, unknown>) || {};
      const out: Record<string, unknown> = {};
      for (const [k, tpl] of Object.entries(fields)) {
        out[k] = interpolate(tpl, ctx);
      }
      return { output: out, tokens: 0, cost: 0 };
    }

    case "human-approval": {
      // Handled by the scheduler (must run outside step.run for Inngest waitForEvent).
      throw new Error("human-approval 节点不应直接执行");
    }

    default:
      throw new Error(`未知节点类型: ${node.type}`);
  }
}

/** Decide whether an outgoing edge fires given the node's result. */
function edgeFires(node: FlowNode, edge: FlowEdge, output: Record<string, unknown>): boolean {
  if (node.type === "condition") {
    const branch = (output as { branch?: string }).branch;
    const h = edge.sourceHandle;
    if (!h) return true;
    return h === branch;
  }
  return true;
}

export async function executeGraph(args: GraphExecArgs): Promise<{
  context: Record<string, unknown>;
  outputs: Record<string, unknown>;
}> {
  const { definition, baseContext, runner, trace, stats } = args;
  const st: ExecState = {
    runId: args.runId,
    workflowId: args.workflowId,
    runner,
    trace,
    stats,
    depth: args.depth ?? 0,
    prefix: args.prefix ?? "",
    rejected: false,
  };
  const ctx: Record<string, unknown> = { ...baseContext };

  const nodeMap = new Map(definition.nodes.map((n) => [n.id, n]));
  const outEdges = new Map<string, FlowEdge[]>();
  const inEdges = new Map<string, FlowEdge[]>();
  for (const e of definition.edges) {
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue;
    const o = outEdges.get(e.source) || [];
    o.push(e);
    outEdges.set(e.source, o);
    const ii = inEdges.get(e.target) || [];
    ii.push(e);
    inEdges.set(e.target, ii);
  }

  const pending = new Map<string, number>();
  for (const n of definition.nodes) pending.set(n.id, (inEdges.get(n.id) || []).length);
  const skipped = new Set<string>();
  const done = new Set<string>();
  const deadEdges = new Set<string>();
  const queuedSet = new Set<string>();
  const queue: string[] = [];
  const enqueue = (id: string) => {
    if (!queuedSet.has(id) && !done.has(id) && !skipped.has(id)) {
      queuedSet.add(id);
      queue.push(id);
    }
  };
  for (const n of definition.nodes) {
    if ((inEdges.get(n.id) || []).length === 0) enqueue(n.id);
  }

  function markSkipped(id: string): void {
    if (skipped.has(id) || done.has(id)) return;
    skipped.add(id);
    for (const e of outEdges.get(id) || []) resolveEdge(e, false);
  }

  function resolveEdge(e: FlowEdge, fired: boolean): void {
    const t = e.target;
    if (skipped.has(t) || done.has(t)) return;
    if (!fired) {
      deadEdges.add(e.id);
      const ins = inEdges.get(t) || [];
      if (ins.length > 0 && ins.every((ie) => deadEdges.has(ie.id))) {
        markSkipped(t);
        return;
      }
    }
    const p = (pending.get(t) ?? 1) - 1;
    pending.set(t, p);
    if (p <= 0) enqueue(t);
  }

  async function runNode(id: string): Promise<void> {
    done.add(id);
    const node = nodeMap.get(id);
    if (!node) return;
    const fullId = st.prefix + id;
    const label = node.data?.label || node.type;
    const traceId = await trace.stepStart(st.runId, fullId, node.type, label, node.data?.config ?? {});
    const t0 = Date.now();
    const finishOk = (output: unknown, tokens: number, cost: number) =>
      trace.stepEnd(traceId, {
        status: "succeeded",
        output,
        tokens,
        cost,
        durationMs: Date.now() - t0,
      });
    const finishFail = (error: string) =>
      trace.stepEnd(traceId, { status: "failed", error, durationMs: Date.now() - t0 });

    try {
      if (st.rejected) {
        await trace.stepEnd(traceId, { status: "skipped", durationMs: Date.now() - t0 });
        markSkipped(id);
        return;
      }
      let result: NodeResult;
      if (node.type === "human-approval") {
        const cfg = node.data.config || {};
        await trace.stepEnd(traceId, {
          status: "waiting_approval",
          output: { status: "waiting_for_approval" },
          durationMs: Date.now() - t0,
        });
        await trace.setRunStatus(st.runId, "waiting_approval").catch(() => undefined);
        const decision = await runner.waitForApproval({
          runId: st.runId,
          nodeId: fullId,
          approvalKey: `${st.runId}:${fullId}`,
          title: String(cfg.title || label),
          message: String(interpolate(cfg.message ?? "", ctx) ?? ""),
          timeoutHours: cfg.timeoutHours ? Number(cfg.timeoutHours) : 24,
        });
        await trace.setRunStatus(st.runId, "running").catch(() => undefined);
        if (decision.decision === "approved") {
          result = { output: { decision: "approved", comment: decision.comment ?? "" }, tokens: 0, cost: 0 };
        } else {
          const reason = decision.comment ? `：${decision.comment}` : "";
          await trace.stepEnd(traceId, {
            status: "failed",
            error: `人工审批被拒绝${reason}`,
            durationMs: Date.now() - t0,
          });
          st.rejected = true;
          markSkipped(id);
          return;
        }
      } else {
        result = await runner.run(`node:${fullId}`, () => executeNode(node, ctx, st, fullId));
      }
      ctx[id] = result.output;
      stats.tokens += result.tokens;
      stats.cost += result.cost;
      await finishOk(result.output, result.tokens, result.cost);
      for (const e of outEdges.get(id) || []) {
        resolveEdge(e, edgeFires(node, e, result.output));
      }
    } catch (err) {
      if (err instanceof RejectedError) {
        st.rejected = true;
        markSkipped(id);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await finishFail(msg).catch(() => undefined);
      throw err;
    }
  }

  while (queue.length > 0) {
    const batch = queue.splice(0, queue.length);
    await Promise.all(
      batch.map((id) => {
        if (skipped.has(id)) {
          done.add(id);
          markSkipped(id);
          return Promise.resolve();
        }
        return runNode(id);
      })
    );
    if (st.rejected) break;
  }

  // Merge outputs from all output nodes that actually ran
  const outputs: Record<string, unknown> = {};
  for (const n of definition.nodes) {
    if (n.type === "output" && ctx[n.id] && typeof ctx[n.id] === "object") {
      Object.assign(outputs, ctx[n.id] as Record<string, unknown>);
    }
  }
  return { context: ctx, outputs };
}
