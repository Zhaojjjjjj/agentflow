import { NextResponse } from "next/server";
import { importFromEnv } from "@/lib/llm/providerStore";

export const dynamic = "force-dynamic";

/** One-click import of env-var providers (LLM_PROVIDER_{i}_*) into the DB. Idempotent by name. */
export async function POST() {
  try {
    const result = await importFromEnv();
    return NextResponse.json(result);
  } catch (e) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status }
    );
  }
}
