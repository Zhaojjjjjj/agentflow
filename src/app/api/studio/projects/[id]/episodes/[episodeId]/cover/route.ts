import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject, type AuthUser } from "@/lib/access";

type Params = { params: Promise<{ id: string; episodeId: string }> };

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

async function checkEpisode(id: string, episodeId: string, me: AuthUser) {
  if (!(await canAccessProject(id, me))) return null;
  const sb = getSupabase();
  const { data } = await sb
    .from("episodes")
    .select("id, cover_url")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  return data as { id: string; cover_url: string } | null;
}

/** POST 上传本集封面（手动生图后回来上传）。存 public `covers` 桶。 */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  const ep = await checkEpisode(id, episodeId, me);
  if (!ep) return NextResponse.json({ error: "剧集不存在或无权访问" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "仅支持 PNG / JPEG / WebP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${id}/${episodeId}/${Date.now()}.${ext}`;
  const sb = getSupabase();

  // 删掉旧封面文件，避免堆积
  const oldCover = ep.cover_url as string | undefined;
  const m = oldCover?.match(/\/covers\/(.+)$/);
  if (m) await sb.storage.from("covers").remove([m[1]]);

  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await sb.storage.from("covers").upload(path, buf, {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    return NextResponse.json(
      { error: `上传失败：${error.message}（请确认已执行 007_episode_cover.sql 建桶）` },
      { status: 500 }
    );
  }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const coverUrl = `${url}/storage/v1/object/public/covers/${path}`;
  const { error: dbErr } = await sb.from("episodes").update({ cover_url: coverUrl }).eq("id", episodeId);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, cover_url: coverUrl });
}

/** DELETE 移除本集封面 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  const ep = await checkEpisode(id, episodeId, me);
  if (!ep) return NextResponse.json({ error: "剧集不存在或无权访问" }, { status: 404 });

  const sb = getSupabase();
  const oldCover = ep.cover_url as string | undefined;
  const m = oldCover?.match(/\/covers\/(.+)$/);
  if (m) await sb.storage.from("covers").remove([m[1]]);
  await sb.from("episodes").update({ cover_url: "" }).eq("id", episodeId);
  return NextResponse.json({ ok: true });
}
