import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";
import { inngest, EVENTS } from "@/lib/inngest";

export const dynamic = "force-dynamic";

const SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);

/** GET 我的生图记录（最近 60 条） */
export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("image_jobs")
    .select("id, template_id, template_name, mode, user_prompt, source_url, size, status, progress, result_url, error, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: `读取失败：${error.message}（请确认已执行 009_image_studio.sql）` }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

/**
 * POST 创建生图任务。
 * body: { templateId?, mode?: 'generate'|'edit', prompt?: string（无模板时的自由提示词）,
 *         userPrompt?: string（附在模板提示词后的补充要求）, sourceUrl?: string }
 */
export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const sb = getSupabase();

  let template: { id: string; name: string; prompt: string; mode: string; size: string } | null = null;
  if (typeof body.templateId === "string" && body.templateId) {
    const { data } = await sb
      .from("image_templates")
      .select("id, name, prompt, mode, size")
      .eq("id", body.templateId)
      .eq("enabled", true)
      .single();
    if (!data) return NextResponse.json({ error: "模板不存在或已停用" }, { status: 400 });
    template = data;
  }

  const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt.trim().slice(0, 2000) : "";
  const freePrompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";

  // 模式判定：模板模式优先，其次请求指定
  let mode: "generate" | "edit";
  if (template) {
    if (template.mode === "edit") mode = "edit";
    else if (template.mode === "generate") mode = "generate";
    else mode = body.mode === "edit" ? "edit" : "generate";
  } else {
    mode = body.mode === "edit" ? "edit" : "generate";
  }

  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim().slice(0, 1000) : "";
  if (mode === "edit" && !sourceUrl) {
    return NextResponse.json({ error: "这个模板需要先上传一张图片" }, { status: 400 });
  }

  // 最终提示词：模板全文 + 用户补充；无模板时用自由提示词
  let prompt: string;
  if (template) {
    prompt = userPrompt ? `${template.prompt}\n\n用户补充要求：${userPrompt}` : template.prompt;
  } else {
    if (!freePrompt) return NextResponse.json({ error: "请先选择模板，或写下你想生成的画面" }, { status: 400 });
    prompt = freePrompt;
  }

  const size =
    template?.size && SIZES.has(template.size)
      ? template.size
      : typeof body.size === "string" && SIZES.has(body.size)
        ? body.size
        : "1024x1024";

  const { data: job, error } = await sb
    .from("image_jobs")
    .insert({
      user_id: me.id,
      template_id: template?.id ?? null,
      template_name: template?.name ?? "",
      mode,
      prompt,
      user_prompt: userPrompt || freePrompt,
      source_url: sourceUrl,
      size,
      status: "running",
      progress: "已加入队列",
    })
    .select("id")
    .single();
  if (error || !job) {
    return NextResponse.json({ error: `创建任务失败：${error?.message ?? "未知错误"}` }, { status: 500 });
  }

  try {
    await inngest.send({
      name: EVENTS.IMAGE_GENERATE_REQUESTED,
      data: { jobId: job.id },
    });
  } catch (e) {
    await sb
      .from("image_jobs")
      .update({ status: "failed", error: `任务投递失败：${e instanceof Error ? e.message : String(e)}`, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return NextResponse.json({ error: "任务投递失败，请稍后重试" }, { status: 500 });
  }

  return NextResponse.json({ jobId: job.id });
}
