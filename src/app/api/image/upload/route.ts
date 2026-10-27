import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized } from "@/lib/access";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/** POST 上传原图（图生图的输入），存 images 桶 inputs/<userId>/ 下，返回公开 URL */
export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "仅支持 PNG / JPEG / WebP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 10MB" }, { status: 400 });
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `inputs/${me.id}/${Date.now()}.${ext}`;
  const sb = getSupabase();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await sb.storage.from("images").upload(path, buf, { contentType: file.type });
  if (error) {
    return NextResponse.json(
      { error: `上传失败：${error.message}（请确认已执行 009_image_studio.sql 建桶）` },
      { status: 500 }
    );
  }
  const { data } = sb.storage.from("images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
