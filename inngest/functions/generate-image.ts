import { inngest, EVENTS } from "@/lib/inngest";
import { getSupabase } from "@/lib/supabase";
import { getImageModelConfig } from "@/lib/appSettings";
import { getChatProvidersPreferred, type LLMProviderConfig } from "@/lib/llm/providers";

/**
 * 生图流水线：读任务 → 调供应商 OpenAI 兼容图片接口 → 结果回存 images 桶 → 更新任务。
 * - generate: POST /images/generations {model, prompt, size}
 * - edit:     POST /images/edits（multipart: image + prompt + model + size）
 * 返回兼容 b64_json 与 url 两种形态；url 形态立刻下载转存，避免临时链接过期。
 */

interface ImageJob {
  id: string;
  user_id: string;
  mode: "generate" | "edit";
  prompt: string;
  source_url: string;
  size: string;
  status: string;
}

async function setProgress(jobId: string, progress: string) {
  const sb = getSupabase();
  await sb.from("image_jobs").update({ progress, updated_at: new Date().toISOString() }).eq("id", jobId);
}

async function extractBytes(payload: unknown): Promise<{ buf: Buffer; contentType: string }> {
  const data = (payload as { data?: Array<{ b64_json?: string; url?: string }> })?.data;
  const first = Array.isArray(data) ? data[0] : undefined;
  if (!first) throw new Error("供应商没有返回图片数据");
  if (first.b64_json) {
    return { buf: Buffer.from(first.b64_json, "base64"), contentType: "image/png" };
  }
  if (first.url) {
    const r = await fetch(first.url);
    if (!r.ok) throw new Error(`下载生成结果失败（${r.status}）`);
    return {
      buf: Buffer.from(await r.arrayBuffer()),
      contentType: r.headers.get("content-type") || "image/png",
    };
  }
  throw new Error("供应商返回的图片数据为空");
}

async function callProvider(provider: LLMProviderConfig, model: string, job: ImageJob): Promise<{ buf: Buffer; contentType: string }> {
  const headers = { Authorization: `Bearer ${provider.apiKey}` };
  if (job.mode === "edit") {
    if (!job.source_url) throw new Error("缺少原图");
    const src = await fetch(job.source_url);
    if (!src.ok) throw new Error("原图读取失败");
    const srcBuf = Buffer.from(await src.arrayBuffer());
    const srcType = src.headers.get("content-type") || "image/png";
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", job.prompt);
    form.append("size", job.size);
    form.append("image", new Blob([new Uint8Array(srcBuf)], { type: srcType }), "source.png");
    const res = await fetch(`${provider.baseURL}/images/edits`, { method: "POST", headers, body: form });
    const text = await res.text();
    if (!res.ok) throw new Error(`编辑接口 ${res.status}：${text.slice(0, 240)}`);
    return extractBytes(JSON.parse(text));
  }
  const res = await fetch(`${provider.baseURL}/images/generations`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: job.prompt, size: job.size, n: 1 }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`生成接口 ${res.status}：${text.slice(0, 240)}`);
  return extractBytes(JSON.parse(text));
}

export const generateImage = inngest.createFunction(
  { id: "image-generate", retries: 0 },
  { event: EVENTS.IMAGE_GENERATE_REQUESTED },
  async ({ event, step }) => {
    const { jobId } = event.data as { jobId: string };
    const sb = getSupabase();

    const job = await step.run("load-job", async () => {
      const { data } = await sb.from("image_jobs").select("*").eq("id", jobId).single();
      return data as ImageJob | null;
    });
    if (!job || job.status !== "running") return { skipped: true };

    try {
      const result = await step.run("generate", async () => {
        await setProgress(jobId, job.mode === "edit" ? "正在按模板编辑图片…" : "正在生成图片…");
        const cfg = await getImageModelConfig();
        const providers = await getChatProvidersPreferred(cfg.providerName);
        if (providers.length === 0) {
          throw new Error("还没有配置 LLM 供应商，请管理员先在后台添加供应商。");
        }
        let lastError: Error | null = null;
        let out: { buf: Buffer; contentType: string } | null = null;
        for (const provider of providers) {
          const model = cfg.model || provider.model;
          try {
            out = await callProvider(provider, model, job);
            break;
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
          }
        }
        if (!out) {
          throw new Error(
            `所有供应商都生成失败。最后错误：${lastError?.message ?? "未知"}。请管理员在后台「生图模板」确认生图模型配置（如 gpt-image-1），且供应商支持图片接口。`
          );
        }
        const ext = out.contentType.includes("jpeg") ? "jpg" : out.contentType.includes("webp") ? "webp" : "png";
        const path = `results/${job.user_id}/${job.id}.${ext}`;
        const up = await sb.storage.from("images").upload(path, out.buf, { contentType: out.contentType, upsert: true });
        if (up.error) throw new Error(`结果保存失败：${up.error.message}（请确认已执行 009_image_studio.sql 建桶）`);
        const { data } = sb.storage.from("images").getPublicUrl(path);
        return data.publicUrl;
      });

      await step.run("finish", async () => {
        await sb
          .from("image_jobs")
          .update({ status: "succeeded", progress: "完成", result_url: result, updated_at: new Date().toISOString() })
          .eq("id", jobId);
      });
      return { ok: true };
    } catch (e) {
      await sb
        .from("image_jobs")
        .update({
          status: "failed",
          progress: "失败",
          error: e instanceof Error ? e.message : String(e),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return { ok: false };
    }
  }
);
