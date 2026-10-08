import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "agentflow",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export const EVENTS = {
  RUN_REQUESTED: "agentflow/workflow.run.requested",
  APPROVAL_DECIDED: "agentflow/approval.decided",
} as const;
