import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authAdmin, forbidden } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MODES = new Set(["generate", "edit", "both"]);
const SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);

/** PATCH 更新模板 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 80);
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 300);
  if (typeof body.prompt === "string") {
    if (body.prompt.trim().length > 20000) return NextResponse.json({ error: "提示词过长（最多 20000 字）" }, { status: 400 });
    patch.prompt = body.prompt.trim();
  }
  if (typeof body.mode === "string" && MODES.has(body.mode)) patch.mode = body.mode;
  if (typeof body.size === "string" && SIZES.has(body.size)) patch.size = body.size;
  if (typeof body.cover_url === "string") patch.cover_url = body.cover_url.trim().slice(0, 1000);
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.sort === "number" && Number.isFinite(body.sort)) patch.sort = Math.round(body.sort);
  if ("name" in patch && !patch.name) return NextResponse.json({ error: "模板名称不能为空" }, { status: 400 });
  if ("prompt" in patch && !patch.prompt) return NextResponse.json({ error: "提示词不能为空" }, { status: 400 });

  const sb = getSupabase();
  const { data, error } = await sb.from("image_templates").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: `保存失败：${error.message}` }, { status: 500 });
  return NextResponse.json({ template: data });
}

/** DELETE 删除模板（历史任务保留，template_id 置空由外键处理） */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const { id } = await params;
  const sb = getSupabase();
  const { error } = await sb.from("image_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: `删除失败：${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
