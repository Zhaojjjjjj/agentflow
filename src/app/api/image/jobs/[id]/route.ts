import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";
import { inngest, EVENTS } from "@/lib/inngest";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST 重新生成：按原任务保存的参数原样新建一个任务并投递（模板后来改了也不影响） */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  const { data: orig } = await sb
    .from("image_jobs")
    .select("template_id, template_name, mode, prompt, user_prompt, source_url, size, status")
    .eq("id", id)
    .eq("user_id", me.id)
    .single();
  if (!orig) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  if (orig.status === "running") return NextResponse.json({ error: "这个任务还在生成中" }, { status: 400 });

  const { data: job, error } = await sb
    .from("image_jobs")
    .insert({
      user_id: me.id,
      template_id: orig.template_id,
      template_name: orig.template_name,
      mode: orig.mode,
      prompt: orig.prompt,
      user_prompt: orig.user_prompt,
      source_url: orig.source_url,
      size: orig.size,
      status: "running",
      progress: "已加入队列",
    })
    .select("id")
    .single();
  if (error || !job) {
    return NextResponse.json({ error: `创建任务失败：${error?.message ?? "未知错误"}` }, { status: 500 });
  }

  try {
    await inngest.send({ name: EVENTS.IMAGE_GENERATE_REQUESTED, data: { jobId: job.id } });
  } catch (e) {
    await sb
      .from("image_jobs")
      .update({ status: "failed", error: `任务投递失败：${e instanceof Error ? e.message : String(e)}`, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return NextResponse.json({ error: "任务投递失败，请稍后重试" }, { status: 500 });
  }
  return NextResponse.json({ jobId: job.id });
}

/** DELETE 删除一条生图记录（连同结果文件） */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const sb = getSupabase();
  const { data } = await sb
    .from("image_jobs")
    .select("id, result_url")
    .eq("id", id)
    .eq("user_id", me.id)
    .single();
  if (!data) return NextResponse.json({ error: "记录不存在" }, { status: 404 });

  const m = (data.result_url as string)?.match(/\/images\/(.+)$/);
  if (m) await sb.storage.from("images").remove([m[1]]).catch(() => {});
  const { error } = await sb.from("image_jobs").delete().eq("id", id).eq("user_id", me.id);
  if (error) return NextResponse.json({ error: `删除失败：${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
