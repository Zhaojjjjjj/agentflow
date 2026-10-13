import type { StepRunner, ApprovalRequest, ApprovalDecision } from "./executor";

/** Synchronous runner: executes steps inline (used for sync API mode). */
export function makeSyncRunner(): StepRunner {
  return {
    run: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn(),
    waitForApproval: async (_req: ApprovalRequest): Promise<ApprovalDecision> => {
      throw new Error("human-approval 节点需要异步模式（Inngest），同步执行不支持");
    },
  };
}

/** Minimal structural type for Inngest step tools (avoids deep type imports). */
export interface InngestStepLike {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  waitForEvent(
    name: string,
    opts: { event: string; match: string; timeout: string }
  ): Promise<{ data?: Record<string, unknown> } | null>;
}

/** Durable runner backed by Inngest steps. */
export function makeInngestRunner(step: InngestStepLike): StepRunner {
  return {
    run: (name, fn) => step.run(name, fn),
    waitForApproval: async (req: ApprovalRequest): Promise<ApprovalDecision> => {
      const hours = Math.max(1, Math.round(req.timeoutHours));
      // 注意：Inngest 的 match 是拿"触发事件"的同名字段来比对的。
      // 触发事件只有 { runId }，没有 approvalKey，所以必须 match runId，
      // 否则审批事件永远匹配不上、工作流永远无法恢复（2026-10-13 修）。
      const evt = await step.waitForEvent("wait-for-approval", {
        event: "agentflow/approval.decided",
        match: "data.runId",
        timeout: `${hours}h`,
      });
      if (!evt) return { decision: "rejected", comment: "审批超时未处理" };
      const d = evt.data || {};
      return {
        decision: d["decision"] === "approved" ? "approved" : "rejected",
        comment: typeof d["comment"] === "string" ? (d["comment"] as string) : undefined,
      };
    },
  };
}
