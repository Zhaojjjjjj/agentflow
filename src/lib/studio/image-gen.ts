// 单集封面图生成：OpenAI 兼容的 images/generations 接口。
//
// 配置走环境变量（Vercel → Settings → Environment Variables 添加后重新部署）：
//   IMAGE_GEN_BASE_URL  如 https://www.jiji.cc/v1
//   IMAGE_GEN_API_KEY
//   IMAGE_GEN_MODEL     如 gpt-image-2（默认）

export interface ImageGenConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getImageGenConfig(): ImageGenConfig | null {
  const baseUrl = process.env.IMAGE_GEN_BASE_URL?.trim();
  const apiKey = process.env.IMAGE_GEN_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    model: process.env.IMAGE_GEN_MODEL?.trim() || "gpt-image-2",
  };
}

/** 调生图接口，返回图片 base64（竖版封面 1024x1536）。失败抛错，错误信息已做用户可读处理。 */
export async function generateCoverImage(prompt: string): Promise<string> {
  const cfg = getImageGenConfig();
  if (!cfg) throw new Error("未配置生图服务（IMAGE_GEN_BASE_URL / IMAGE_GEN_API_KEY）");
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: cfg.model, prompt, size: "1024x1536", n: 1 }),
    });
  } catch {
    throw new Error("封面生成失败：生图服务连接超时");
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    const msg = err.error?.message || `生图接口返回 ${res.status}`;
    throw new Error(`封面生成失败：${msg}`.slice(0, 500));
  }
  const b64 = (data as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
  if (!b64) throw new Error("封面生成失败：接口未返回图片数据");
  return b64;
}
