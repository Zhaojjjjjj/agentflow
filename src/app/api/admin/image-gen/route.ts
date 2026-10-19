import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { getSettings, setSetting } from "@/lib/appSettings";

export const dynamic = "force-dynamic";

/** 封面生图服务配置（存 app_settings，手动生图时备用；优先级高于环境变量） */
const KEYS = ["image_gen.base_url", "image_gen.api_key", "image_gen.model"] as const;

export async function GET(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const s = await getSettings([...KEYS]);
  const apiKey = s["image_gen.api_key"] || "";
  return NextResponse.json({
    base_url: s["image_gen.base_url"] || "",
    api_key: apiKey ? "••••••••" + apiKey.slice(-4) : "",
    api_key_set: !!apiKey,
    model: s["image_gen.model"] || "",
  });
}

export async function PUT(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const body = await req.json().catch(() => ({}));
  const baseUrl = typeof body.base_url === "string" ? body.base_url.trim().replace(/\/$/, "") : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  // api_key 为空表示不修改（前端显示为掩码）
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  try {
    await setSetting("image_gen.base_url", baseUrl);
    await setSetting("image_gen.model", model);
    if (apiKey && !apiKey.startsWith("••••")) {
      await setSetting("image_gen.api_key", apiKey);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
