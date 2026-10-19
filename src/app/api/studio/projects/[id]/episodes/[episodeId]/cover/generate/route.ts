import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { inngest, EVENTS } from "@/lib/inngest";
import { createJob, updateJob, getJob } from "@/lib/studio/jobs";
import { getImageGenConfig } from "@/lib/studio/image-gen";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** POST 一键生成封面：建任务 → 发 Inngest 事件 → 前端按 jobId 轮询 */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  if (!getImageGenConfig()) {
    return NextResponse.json(
      { error: "未配置生图服务：请在 Vercel 环境变量添加 IMAGE_GEN_BASE_URL / IMAGE_GEN_API_KEY 后重新部署" },
      { status: 400 }
    );
  }
  const job = await createJob(episodeId);
  await updateJob(job.id, { progress: "已加入生图队列" });
  await inngest.send({
    name: EVENTS.COVER_GENERATE_REQUESTED,
    data: { jobId: job.id, episodeId, projectId: id },
  });
  return NextResponse.json({ jobId: job.id });
}

/** GET ?jobId=xxx 轮询生图任务状态 */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "缺少 jobId" }, { status: 400 });
  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  return NextResponse.json({ job });
}
