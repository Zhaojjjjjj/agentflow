import { getSupabase } from "../supabase";
import type { TraceWriter } from "./executor";

/** Writes per-node trace rows to Supabase. */
export class SupabaseTraceWriter implements TraceWriter {
  async stepStart(
    runId: string,
    nodeId: string,
    nodeType: string,
    nodeName: string,
    input: unknown
  ): Promise<string> {
    const sb = getSupabase();
    // Idempotent for Inngest retries: step.run() memoizes completed steps, but
    // this insert runs outside of it — reuse the existing row for
    // (run_id, node_id) instead of creating a duplicate timeline entry.
    const { data: existing } = await sb
      .from("run_steps")
      .select("id, attempt")
      .eq("run_id", runId)
      .eq("node_id", nodeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; attempt: number };
      const { error } = await sb
        .from("run_steps")
        .update({
          status: "running",
          node_type: nodeType,
          node_name: nodeName,
          input: (input as object) ?? {},
          output: null,
          tokens: 0,
          cost_usd: 0,
          duration_ms: null,
          error: null,
          started_at: new Date().toISOString(),
          finished_at: null,
          attempt: (row.attempt ?? 0) + 1,
        })
        .eq("id", row.id);
      if (error) throw new Error(`trace stepStart failed: ${error.message}`);
      return row.id as string;
    }
    const { data, error } = await sb
      .from("run_steps")
      .insert({
        run_id: runId,
        node_id: nodeId,
        node_type: nodeType,
        node_name: nodeName,
        status: "running",
        input: (input as object) ?? {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`trace stepStart failed: ${error.message}`);
    return data.id as string;
  }

  async stepEnd(
    traceId: string,
    patch: {
      status: "succeeded" | "failed" | "skipped" | "waiting_approval";
      output?: unknown;
      tokens?: number;
      cost?: number;
      durationMs?: number;
      error?: string;
    }
  ): Promise<void> {
    const sb = getSupabase();
    const terminal = patch.status !== "waiting_approval";
    const { error } = await sb
      .from("run_steps")
      .update({
        status: patch.status,
        output: patch.output ?? null,
        tokens: patch.tokens ?? 0,
        cost_usd: patch.cost ?? 0,
        duration_ms: patch.durationMs ?? null,
        error: patch.error ?? null,
        finished_at: terminal ? new Date().toISOString() : null,
      })
      .eq("id", traceId);
    if (error) throw new Error(`trace stepEnd failed: ${error.message}`);
  }

  async setRunStatus(runId: string, status: string): Promise<void> {
    const sb = getSupabase();
    const { error } = await sb.from("workflow_runs").update({ status }).eq("id", runId);
    if (error) throw new Error(`trace setRunStatus failed: ${error.message}`);
  }
}

/**
 * Sum tokens/cost from trace rows — the source of truth for run totals.
 * Retry-safe: unlike the in-memory accumulator, memoized Inngest steps are
 * never double-counted.
 */
export async function sumRunStats(runId: string): Promise<{ tokens: number; cost: number }> {
  const sb = getSupabase();
  const { data } = await sb.from("run_steps").select("tokens, cost_usd").eq("run_id", runId);
  let tokens = 0;
  let cost = 0;
  for (const r of (data ?? []) as { tokens: number; cost_usd: number | string }[]) {
    tokens += Number(r.tokens) || 0;
    cost += Number(r.cost_usd) || 0;
  }
  return { tokens, cost };
}
