import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authAdmin, forbidden } from "@/lib/access";

export const dynamic = "force-dynamic";

const MODES = new Set(["generate", "edit", "both"]);
const SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);

function clean(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const mode = typeof body.mode === "string" && MODES.has(body.mode) ? body.mode : "generate";
  const size = typeof body.size === "string" && SIZES.has(body.size) ? body.size : "1024x1024";
  return {
    name: name.slice(0, 80),
    description: typeof body.description === "string" ? body.description.trim().slice(0, 300) : "",
    prompt,
    mode,
    size,
    cover_url: typeof body.cover_url === "string" ? body.cover_url.trim().slice(0, 1000) : "",
    enabled: body.enabled !== false,
    sort: typeof body.sort === "number" && Number.isFinite(body.sort) ? Math.round(body.sort) : 0,
  };
}

/** GET 全部模板（含停用的） */
export async function GET(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("image_templates")
    .select("*")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: `读取失败：${error.message}（请确认已执行 009_image_studio.sql）` }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

/** POST 新建模板 */
export async function POST(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const body = await req.json().catch(() => ({}));
  const v = clean(body as Record<string, unknown>);
  if (!v.name) return NextResponse.json({ error: "请填写模板名称" }, { status: 400 });
  if (!v.prompt) return NextResponse.json({ error: "请填写提示词" }, { status: 400 });
  if (v.prompt.length > 20000) return NextResponse.json({ error: "提示词过长（最多 20000 字）" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("image_templates").insert(v).select("*").single();
  if (error) return NextResponse.json({ error: `保存失败：${error.message}` }, { status: 500 });
  return NextResponse.json({ template: data });
}
