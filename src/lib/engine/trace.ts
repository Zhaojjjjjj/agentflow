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
