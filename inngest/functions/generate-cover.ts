// Inngest：按封面提示词生成单集封面图，存 covers 桶并回写 episode.cover_url。
// 若本集还没有提示词，先按写流水线同款逻辑生成一份。

import { inngest, EVENTS } from "@/lib/inngest";
import { getSupabase } from "@/lib/supabase";
import { updateJob, failJob } from "@/lib/studio/jobs";
import { getImageGenConfig, generateCoverImage } from "@/lib/studio/image-gen";
import { gatherContext } from "@/lib/studio/context";
import { generateCoverPrompt } from "@/lib/studio/pipeline";

interface CoverEventData {
  jobId: string;
  episodeId: string;
  projectId: string;
}

export const generateCover = inngest.createFunction(
  { id: "studio-generate-cover" },
  { event: EVENTS.COVER_GENERATE_REQUESTED },
  async ({ event, step }) => {
    const { jobId, episodeId, projectId } = event.data as CoverEventData;
    const sb = getSupabase();
    try {
      if (!getImageGenConfig()) throw new Error("未配置生图服务");

      // 1. 取本集；没有提示词就先生成一份（与写流水线同款）
      const { data: ep } = await sb
        .from("episodes")
        .select("id, number, summary, cover_prompt")
        .eq("id", episodeId)
        .single();
      if (!ep) throw new Error("剧集不存在");
      let prompt = (ep as { cover_prompt?: string }).cover_prompt || "";
      if (!prompt) {
        await updateJob(jobId, { progress: "正在生成封面提示词…" });
        prompt = await step.run("cover-prompt", async () => {
          const ctx = await gatherContext(projectId, (ep as { number: number }).number);
          const p = await generateCoverPrompt(ctx, (ep as { summary?: string }).summary || "");
          await sb.from("episodes").update({ cover_prompt: p }).eq("id", episodeId);
          return p;
        });
      }

      // 2. 生图（约 20-40 秒）
      await updateJob(jobId, { progress: "正在绘制封面，请稍候…" });
      const b64 = await step.run("generate-image", async () => generateCoverImage(prompt));

      // 3. 存桶并回写
      await step.run("upload", async () => {
        const buf = Buffer.from(b64, "base64");
        const path = `${projectId}/${episodeId}/${Date.now()}.png`;
        const { data: old } = await sb.from("episodes").select("cover_url").eq("id", episodeId).single();
        const oldUrl = (old as { cover_url?: string } | null)?.cover_url;
        const m = oldUrl?.match(/\/covers\/(.+)$/);
        const { error: upErr } = await sb.storage.from("covers").upload(path, buf, {
          contentType: "image/png",
          upsert: true,
        });
        if (upErr) throw new Error(`封面上传失败：${upErr.message}`);
        if (m) await sb.storage.from("covers").remove([m[1]]);
        const { data: pub } = sb.storage.from("covers").getPublicUrl(path);
        await sb.from("episodes").update({ cover_url: pub.publicUrl }).eq("id", episodeId);
      });

      await updateJob(jobId, { status: "succeeded", progress: "封面已生成" });
    } catch (e) {
      await failJob(jobId, e instanceof Error ? e.message : String(e));
      throw e;
    }
  }
);
