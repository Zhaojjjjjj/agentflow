import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { latestJob, STAGE_LABELS } from "@/lib/studio/jobs";

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** GET 该集最新的写作任务状态（前端轮询用） */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const job = await latestJob(episodeId);
  if (!job) return NextResponse.json({ job: null });
  return NextResponse.json({
    job: { ...job, stageLabel: STAGE_LABELS[job.stage] ?? job.stage },
  });
}
