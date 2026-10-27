import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";

export const dynamic = "force-dynamic";

/** GET 已启用的模板列表（用户端） */
export async function GET(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("image_templates")
    .select("id, name, description, prompt, mode, size, cover_url, sort")
    .eq("enabled", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: `读取失败：${error.message}` }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}
