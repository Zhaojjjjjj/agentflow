import { NextRequest, NextResponse } from "next/server";
import { authUser, unauthorized } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";
import { setUserAvatar } from "@/lib/users";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Upload own avatar (stored in the public `avatars` bucket). */
export async function POST(req: NextRequest) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "仅支持 PNG / JPEG / WebP / GIF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 2MB" }, { status: 400 });
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "gif";
  const path = `${me.id}/${Date.now()}.${ext}`;
  const sb = getSupabase();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await sb.storage.from("avatars").upload(path, buf, {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    return NextResponse.json(
      { error: `上传失败: ${error.message}（请确认已执行 002_users.sql 建桶）` },
      { status: 500 }
    );
  }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const avatarUrl = `${url}/storage/v1/object/public/avatars/${path}`;
  try {
    await setUserAvatar(me.id, avatarUrl);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, avatar_url: avatarUrl });
}
