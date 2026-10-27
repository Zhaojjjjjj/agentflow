import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { getSettings, setSetting } from "@/lib/appSettings";

export const dynamic = "force-dynamic";

const KEYS = ["chat.provider", "chat.model", "chat.system_prompt", "image.provider", "image.model"] as const;

/** Get chat model config (admin). */
export async function GET(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const s = await getSettings([...KEYS]);
  return NextResponse.json({
    provider: s["chat.provider"] || "",
    model: s["chat.model"] || "",
    system_prompt: s["chat.system_prompt"] || "",
    image_provider: s["image.provider"] || "",
    image_model: s["image.model"] || "",
  });
}

/** Update chat model config (admin). */
export async function PUT(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const body = await req.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const systemPrompt = typeof body.system_prompt === "string" ? body.system_prompt.trim() : "";
  // 生图配置：字段不在请求里就不动（LLM 页保存时只发 chat 字段）
  const hasImage = "image_provider" in body || "image_model" in body;
  const imageProvider = typeof body.image_provider === "string" ? body.image_provider.trim() : "";
  const imageModel = typeof body.image_model === "string" ? body.image_model.trim() : "";
  if (systemPrompt.length > 4000) {
    return NextResponse.json({ error: "系统提示词过长（最多 4000 字）" }, { status: 400 });
  }
  try {
    await setSetting("chat.provider", provider);
    await setSetting("chat.model", model);
    await setSetting("chat.system_prompt", systemPrompt);
    if (hasImage) {
      await setSetting("image.provider", imageProvider);
      await setSetting("image.model", imageModel);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
