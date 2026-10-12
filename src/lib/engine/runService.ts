import { randomBytes, createHash } from "crypto";
import { getSupabase } from "../supabase";
import { inngest, EVENTS } from "../inngest";
import { executeGraph, RejectedError } from "./executor";
import { makeSyncRunner } from "./runners";
import { SupabaseTraceWriter } from "./trace";
import type { WorkflowDefinition } from "./types";
import { findCycle } from "./types";
import { configuredProviders } from "../llm/providers";
import { getEmbeddingConfig } from "../llm/embeddings";

export type RunMode = "async" | "sync";

export async function createRun(opts: {
  workflowId: string;
  input?: Record<string, unknown>;
  trigger?: string;
  mode?: RunMode;
}): Promise<{ runId: string; mode: RunMode }> {
  const mode: RunMode = opts.mode ?? "async";
  const sb = getSupabase();

  const { data: wf, error } = await sb
    .from("workflows")
    .select("id, definition")
    .eq("id", opts.workflowId)
    .single();
  if (error || !wf) throw new Error("工作流不存在");
  const definition = wf.definition as WorkflowDefinition;
  if (!definition.nodes || definition.nodes.length === 0) {
    throw new Error("工作流没有任何节点");
  }
  const cycle = findCycle(definition);
  if (cycle) {
    throw new Error(`工作流存在循环依赖，无法执行：${cycle.join(" → ")}`);
  }

  // Pre-flight: fail fast with a clear message when required model providers are missing,
  // instead of letting the run die mid-execution with a cryptic error.
  const nodeTypes = new Set(definition.nodes.map((n) => n.type));
  if (nodeTypes.has("llm")) {
    const providers = await configuredProviders().catch(() => [] as string[]);
    if (providers.length === 0) {
      throw new Error("未配置 LLM 供应商：请先到「设置 / LLM 供应商」中添加，或配置 LLM_PROVIDER_* 环境变量");
    }
  }
  if (nodeTypes.has("rag-retrieve")) {
    try {
      await getEmbeddingConfig();
    } catch {
      throw new Error("未配置 Embedding 模型：请先到「设置 / LLM 供应商」中添加 embedding 供应商，或配置 LLM_EMBEDDING_* 环境变量");
    }
  }

  const { data: run, error: rerr } = await sb
    .from("workflow_runs")
    .insert({
      workflow_id: opts.workflowId,
      trigger: opts.trigger ?? "manual",
      status: "queued",
      input: opts.input ?? {},
    })
    .select("id")
    .single();
  if (rerr) throw new Error(`创建运行记录失败: ${rerr.message}`);
  const runId = run.id as string;
  const now = new Date().toISOString();

  if (mode === "async") {
    if (!process.env.INNGEST_EVENT_KEY) {
      await sb.from("workflow_runs").update({ status: "failed", error: "异步模式需要配置 INNGEST_EVENT_KEY", finished_at: now }).eq("id", runId);
      throw new Error("异步模式需要配置 INNGEST_EVENT_KEY（或使用同步模式）");
    }
    await sb.from("workflow_runs").update({ status: "running", started_at: now }).eq("id", runId);
    try {
      await inngest.send({ name: EVENTS.RUN_REQUESTED, data: { runId } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("workflow_runs").update({
        status: "failed",
        error: `Inngest 事件发送失败: ${msg}`,
        finished_at: new Date().toISOString(),
      }).eq("id", runId);
      throw new Error(`Inngest 事件发送失败: ${msg}`);
    }
    return { runId, mode: "async" };
  }

  // ---- synchronous: execute inline ----
  const trace = new SupabaseTraceWriter();
  const stats = { tokens: 0, cost: 0 };
  await sb.from("workflow_runs").update({ status: "running", started_at: now }).eq("id", runId);
  try {
    const { outputs } = await executeGraph({
      runId,
      workflowId: opts.workflowId,
      definition,
      baseContext: { input: opts.input ?? {} },
      runner: makeSyncRunner(),
      trace,
      stats,
    });
    await sb.from("workflow_runs").update({
      status: "succeeded",
      output: outputs,
      total_tokens: stats.tokens,
      estimated_cost_usd: stats.cost,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
    return { runId, mode: "sync" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = e instanceof RejectedError ? "rejected" : "failed";
    await sb.from("workflow_runs").update({
      status,
      error: msg,
      total_tokens: stats.tokens,
      estimated_cost_usd: stats.cost,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
    throw e;
  }
}

/** Self-healing: mark runs stuck in queued/running beyond the timeout as failed.
 * Covers: Inngest app not connected (event never consumed), Vercel killing a
 * sync execution at maxDuration, or any other silent death. Call it lazily
 * from read paths (e.g. GET /api/runs) so no cron infrastructure is needed. */
export async function sweepStaleRuns(timeoutMinutes = 15): Promise<number> {
  const sb = getSupabase();
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("workflow_runs")
    .update({
      status: "failed",
      error:
        "执行超时未结束：若使用异步模式，请确认已在 Inngest 后台连接了应用地址（https://你的域名/api/inngest）；若使用同步模式，可能是执行超过平台时长限制被终止。请检查配置后重试。",
      finished_at: new Date().toISOString(),
    })
    .in("status", ["queued", "running"])
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.warn(`[agentflow] sweepStaleRuns failed: ${error.message}`);
    return 0;
  }
  return data?.length ?? 0;
}

/** Generate a new API key, storing only its SHA-256 hash. Returns the plaintext once. */
export async function mintApiKey(
  workflowId: string,
  name: string
): Promise<{ id: string; key: string; prefix: string }> {
  const sb = getSupabase();
  const key = `af_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 11);
  const { data, error } = await sb
    .from("api_keys")
    .insert({ name, key_hash: keyHash, key_prefix: prefix, workflow_id: workflowId })
    .select("id")
    .single();
  if (error) throw new Error(`创建 API Key 失败: ${error.message}`);
  return { id: data.id as string, key, prefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Validate an API key for a workflow. Returns the key row or null. */
export async function validateApiKey(
  key: string,
  workflowId: string
): Promise<{ id: string } | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("api_keys")
    .select("id")
    .eq("key_hash", hashApiKey(key))
    .eq("workflow_id", workflowId)
    .single();
  if (!data) return null;
  await sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id as string };
}
