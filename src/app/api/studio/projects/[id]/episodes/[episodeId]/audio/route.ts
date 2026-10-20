import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authUser, unauthorized, canAccessProject } from "@/lib/access";
import { getChatProviders } from "@/lib/llm/providers";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string; episodeId: string }> };

/** 粗略去掉 Markdown 符号，让 TTS 不读出井号星号 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/[*_`>#|-]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 按句切分 ~1200 字一块 */
function chunkText(text: string, maxLen = 1200): string[] {
  const chunks: string[] = [];
  let buf = "";
  for (const sent of text.split(/(?<=[。！？…])\s*/)) {
    if (buf && buf.length + sent.length > maxLen) {
      chunks.push(buf);
      buf = sent;
    } else {
      buf += sent;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

/**
 * POST 生成本集有声版（mp3 下载，可上传喜马拉雅主播平台）。
 * 用首个 LLM 供应商的 OpenAI-compatible /audio/speech 接口。
 * body: { voice?, model? }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const me = await authUser(req);
  if (!me) return unauthorized();
  const { id, episodeId } = await params;
  if (!(await canAccessProject(id, me))) {
    return NextResponse.json({ error: "作品不存在或无权访问" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const voice = typeof body.voice === "string" && body.voice ? body.voice : "alloy";
  const model = typeof body.model === "string" && body.model ? body.model : "tts-1";

  const sb = getSupabase();
  const { data: ep } = await sb
    .from("episodes")
    .select("number, title, content")
    .eq("id", episodeId)
    .eq("project_id", id)
    .single();
  if (!ep) return NextResponse.json({ error: "剧集不存在" }, { status: 404 });
  const row = ep as { number: number; title: string; content: string };
  if (!row.content?.trim()) return NextResponse.json({ error: "本集还没有正文" }, { status: 400 });

  const providers = await getChatProviders();
  if (providers.length === 0) {
    return NextResponse.json({ error: "没有可用的 LLM 供应商，请先在管理后台配置" }, { status: 400 });
  }
  const pv = providers[0];

  const plain = stripMarkdown(row.content);
  const chunks = chunkText(plain);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const res = await fetch(`${pv.baseURL.replace(/\/$/, "")}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pv.apiKey}`,
      },
      body: JSON.stringify({ model, input: chunks[i], voice, response_format: "mp3" }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "").then((t) => t.slice(0, 200));
      return NextResponse.json(
        { error: `TTS 合成失败（第 ${i + 1}/${chunks.length} 段，HTTP ${res.status}）。中转站可能不支持语音接口。${msg}` },
        { status: 502 }
      );
    }
    const buf = await res.arrayBuffer();
    parts.push(new Uint8Array(buf));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    merged.set(p, off);
    off += p.length;
  }

  const heading = row.title ? `第${row.number}集${row.title}` : `第${row.number}集`;
  return new NextResponse(Buffer.from(merged), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="audio"; filename*=UTF-8''${encodeURIComponent(`${heading}.mp3`)}`,
    },
  });
}
