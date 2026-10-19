import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "agentflow",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export const EVENTS = {
  RUN_REQUESTED: "agentflow/workflow.run.requested",
  APPROVAL_DECIDED: "agentflow/approval.decided",
  // Studio 连载流水线
  EPISODE_WRITE_REQUESTED: "studio/episode.write.requested",
  OUTLINE_APPROVED: "studio/episode.outline.approved",
  COVER_GENERATE_REQUESTED: "studio/cover.generate.requested",
} as const;
