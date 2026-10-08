import { inngest, EVENTS } from "../src/lib/inngest";
import { getSupabase } from "../src/lib/supabase";
import { executeGraph, RejectedError } from "../src/lib/engine/executor";
import { makeInngestRunner } from "../src/lib/engine/runners";
import { SupabaseTraceWriter } from "../src/lib/engine/trace";
import { cronNext, validateCron } from "../src/lib/engine/cron";
import type { WorkflowDefinition } from "../src/lib/engine/types";

/** Background durable execution of a workflow run, node by node. */
export const executeWorkflowFn = inngest.createFunction(
  { id: "execute-workflow", retries: 1 },
  { event: EVENTS.RUN_REQUESTED },
  async ({ event, step }) => {
    const runId = (event.data as { runId?: string }).runId;
    if (!runId) throw new Error("event 缺少 runId");
    const sb = getSupabase();

    const { data: run } = await sb
      .from("workflow_runs")
      .select("id, workflow_id, input, status")
      .eq("id", runId)
      .single();
    if (!run) throw new Error(`运行记录不存在: ${runId}`);
    if (["succeeded", "failed", "rejected", "cancelled"].includes(run.status)) {
      return { runId, skipped: true, reason: `already ${run.status}` };
    }

    const { data: wf } = await sb
      .from("workflows")
      .select("id, definition")
      .eq("id", run.workflow_id)
      .single();
    if (!wf) throw new Error(`工作流不存在: ${run.workflow_id}`);
    const definition = wf.definition as WorkflowDefinition;

    const trace = new SupabaseTraceWriter();
    const runner = makeInngestRunner(step as unknown as Parameters<typeof makeInngestRunner>[0]);
    const stats = { tokens: 0, cost: 0 };
    await sb
      .from("workflow_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);

    try {
      const { outputs } = await executeGraph({
        runId,
        workflowId: wf.id as string,
        definition,
        baseContext: { input: (run.input as Record<string, unknown>) ?? {} },
        runner,
        trace,
        stats,
      });
      await sb
        .from("workflow_runs")
        .update({
          status: "succeeded",
          output: outputs,
          total_tokens: stats.tokens,
          estimated_cost_usd: stats.cost,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
      return { runId, status: "succeeded" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof RejectedError) {
        await sb
          .from("workflow_runs")
          .update({
            status: "rejected",
            error: msg,
            total_tokens: stats.tokens,
            estimated_cost_usd: stats.cost,
            finished_at: new Date().toISOString(),
          })
          .eq("id", runId);
        return { runId, status: "rejected" };
      }
      await sb
        .from("workflow_runs")
        .update({
          status: "failed",
          error: msg,
          total_tokens: stats.tokens,
          estimated_cost_usd: stats.cost,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
      throw e;
    }
  }
);

/** Every minute: fire scheduled workflows whose next_run_at has passed. */
export const scheduleTickFn = inngest.createFunction(
  { id: "schedule-tick", retries: 0 },
  { cron: "* * * * *" },
  async () => {
    const sb = getSupabase();
    const now = new Date();
    const { data: wfs, error } = await sb
      .from("workflows")
      .select("id, schedule_cron")
      .eq("schedule_enabled", true)
      .lte("next_run_at", now.toISOString());
    if (error) throw new Error(`查询定时工作流失败: ${error.message}`);
    let fired = 0;
    for (const wf of wfs || []) {
      const cron = (wf as { schedule_cron: string | null }).schedule_cron;
      if (!cron || validateCron(cron)) continue;
      const next = cronNext(cron, now);
      await sb.from("workflows").update({ next_run_at: next ? next.toISOString() : null }).eq("id", wf.id);
      const { data: run } = await sb
        .from("workflow_runs")
        .insert({
          workflow_id: wf.id,
          trigger: "schedule",
          status: "running",
          input: { scheduledAt: now.toISOString() },
          started_at: now.toISOString(),
        })
        .select("id")
        .single();
      if (run) {
        await inngest.send({ name: EVENTS.RUN_REQUESTED, data: { runId: (run as { id: string }).id } });
        fired++;
      }
    }
    return { fired, checkedAt: now.toISOString() };
  }
);

export const functions = [executeWorkflowFn, scheduleTickFn];
