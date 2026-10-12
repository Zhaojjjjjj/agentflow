import { NextRequest, NextResponse } from "next/server";
import { moveProvider } from "@/lib/llm/providerStore";

export const dynamic = "force-dynamic";

/** Move a provider up/down within its kind group (swaps priority with neighbor). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; direction?: string };
    if (!body.id || (body.direction !== "up" && body.direction !== "down")) {
      return NextResponse.json({ error: "参数错误：需要 id 和 direction(up|down)" }, { status: 400 });
    }
    const providers = await moveProvider(body.id, body.direction);
    return NextResponse.json({ providers });
  } catch (e) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status }
    );
  }
}
