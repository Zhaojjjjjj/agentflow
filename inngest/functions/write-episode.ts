// Inngest 长任务：写一集完整流水线。
//
// 阶段：前情检索 → 生成大纲 → [人工审稿：waitForEvent] → 分节扩写 →
//       一致性检查 → 修订 → 记忆入库 → 完成（待发布）
//
// 进度全部写入 episode_jobs，前端轮询展示。
// 人工审稿通过 step.waitForEvent 实现，超时 7 天自动取消。

import { inngest, EVENTS } from "@/lib/inngest";
import { getSupabase } from "@/lib/supabase";
import { gatherContext } from "@/lib/studio/context";
import { updateJob, failJob, type JobStage } from "@/lib/studio/jobs";
import {
  generateOutline,
  parseSections,
  expandSection,
  checkConsistency,
  reviseContent,
  memorizeEpisode,
  generateCoverPrompt,
} from "@/lib/studio/pipeline";

interface WriteEventData {
  jobId: string;
  episodeId: string;
  projectId: string;
}

interface ApprovalEventData {
  jobId: string;
  episodeId: string;
  outline: string;
}

async function setStage(jobId: string, stage: JobStage, progress: string) {
  await updateJob(jobId, { stage, progress });
}

async function setEpisodeStatus(episodeId: string, status: "draft" | "reviewing" | "published") {
  const sb = getSupabase();
  await sb.from("episodes").update({ status }).eq("id", episodeId);
}

async function saveOutline(episodeId: string, outline: string) {
  const sb = getSupabase();
  await sb.from("episodes").update({ outline }).eq("id", episodeId);
}

async function saveContent(episodeId: string, content: string) {
  const sb = getSupabase();
  await sb.from("episodes").update({ content }).eq("id", episodeId);
}

export const writeEpisode = inngest.createFunction(
  { id: "studio-write-episode", retries: 1 },
  { event: EVENTS.EPISODE_WRITE_REQUESTED },
  async ({ event, step }) => {
    const { jobId, episodeId, projectId } = event.data as WriteEventData;

    try {
      // ---- 1. 前情检索 ----
      const ctx = await step.run("gather-context", async () => {
        await setStage(jobId, "context", "正在检索前情：摘要、人物、伏笔…");
        const episodeNumber = await getEpisodeNumber(episodeId);
        return await gatherContext(projectId, episodeNumber);
      });

      // ---- 2. 生成大纲 ----
      await step.run("generate-outline", async () => {
        await setStage(jobId, "outline", "正在生成本集大纲…");
        const outline = await generateOutline(ctx);
        await saveOutline(episodeId, outline);
      });

      // ---- 3. 人工审稿（等待用户确认） ----
      await setStage(jobId, "outline_review", "大纲已生成，等待你审稿确认");
      const approval = await step.waitForEvent("wait-outline-approval", {
        event: EVENTS.OUTLINE_APPROVED,
        match: "data.jobId",
        timeout: "7d",
      });
      if (!approval) {
        await updateJob(jobId, { status: "cancelled", progress: "审稿超时（7天），任务已取消" });
        return { ok: false, reason: "approval-timeout" };
      }
      const finalOutline = (approval.data as ApprovalEventData).outline;
      // 用户可能改过大纲，写回
      await step.run("save-final-outline", async () => {
        await saveOutline(episodeId, finalOutline);
      });

      // ---- 4. 分节扩写 ----
      const sections = parseSections(finalOutline, ctx.kind);
      if (sections.length === 0) throw new Error("大纲解析失败：没有找到可扩写的节/场");
      let fullContent = "";
      for (let i = 0; i < sections.length; i++) {
        const part = await step.run(`draft-section-${i}`, async () => {
          await setStage(jobId, "drafting", `正在扩写第 ${i + 1}/${sections.length} 节…`);
          return await expandSection(ctx, finalOutline, sections[i], fullContent, sections.length);
        });
        fullContent += (fullContent ? "\n\n" : "") + part;
      }
      await step.run("save-draft", async () => {
        await saveContent(episodeId, fullContent);
      });

      // ---- 5. 一致性检查 + 修订 ----
      const issues = await step.run("consistency-check", async () => {
        await setStage(jobId, "review", "正在检查人物、剧情一致性…");
        return await checkConsistency(ctx, finalOutline, fullContent);
      });
      if (issues.length > 0) {
        const revised = await step.run("revise", async () => {
          await setStage(jobId, "review", `发现 ${issues.length} 处问题，正在修订…`);
          return await reviseContent(fullContent, issues);
        });
        fullContent = revised;
        await step.run("save-revised", async () => {
          await saveContent(episodeId, fullContent);
        });
      }

      // ---- 6. 记忆入库 ----
      const { summary } = await step.run("memorize", async () => {
        await setStage(jobId, "memorize", "正在生成摘要、更新人物与伏笔…");
        return await memorizeEpisode(projectId, episodeId, ctx.episodeNumber, ctx, fullContent);
      });

      // ---- 7. 封面图提示词（附加步骤：失败不影响主流程） ----
      await step.run("cover-prompt", async () => {
        await setStage(jobId, "cover", "正在生成本集封面图提示词…");
        try {
          const prompt = await generateCoverPrompt(ctx, summary);
          const sb = getSupabase();
          await sb.from("episodes").update({ cover_prompt: prompt }).eq("id", episodeId);
        } catch (e) {
          // 列不存在（007 未执行）等情况只记日志，不让任务失败
          console.warn("[studio] cover prompt skipped:", e instanceof Error ? e.message : e);
        }
      });

      // ---- 完成 ----
      await step.run("finish", async () => {
        await setEpisodeStatus(episodeId, "reviewing");
        await updateJob(jobId, { stage: "done", status: "succeeded", progress: "正文已完成，等待你发布" });
      });

      return { ok: true, episodeId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await failJob(jobId, msg);
      throw e;
    }
  }
);

async function getEpisodeNumber(episodeId: string): Promise<number> {
  const sb = getSupabase();
  const { data } = await sb.from("episodes").select("number").eq("id", episodeId).single();
  return (data as { number: number } | null)?.number ?? 1;
}
