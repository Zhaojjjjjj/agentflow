import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

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
