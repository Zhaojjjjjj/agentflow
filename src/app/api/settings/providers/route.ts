import { NextRequest, NextResponse } from "next/server";
import {
  listProviders,
  createProvider,
  updateProvider,
  encryptionReady,
  type ProviderInput,
} from "@/lib/llm/providerStore";
import { readEnvProviders } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";

function err(e: unknown) {
  const status = (e as { status?: number })?.status ?? 500;
  return NextResponse.json(
    { error: e instanceof Error ? e.message : String(e) },
    { status }
  );
}

/** List providers (keys masked) + encryption status + env fallback count. */
export async function GET() {
  try {
    const providers = await listProviders();
    return NextResponse.json({
      providers,
      encryptionReady: encryptionReady(),
      envProviderCount: readEnvProviders().length,
    });
  } catch (e) {
    return err(e);
  }
}

/** Create a provider. The plaintext key is encrypted server-side before insert. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<ProviderInput>;
    const created = await createProvider({
      name: String(body.name || ""),
      kind: body.kind === "embedding" ? "embedding" : "chat",
      baseUrl: String(body.baseUrl || ""),
      apiKey: String(body.apiKey || ""),
      model: String(body.model || ""),
      dimensions: body.dimensions != null ? Number(body.dimensions) : null,
      priority: body.priority != null ? Number(body.priority) : 0,
      enabled: body.enabled !== false,
    });
    return NextResponse.json({ provider: created });
  } catch (e) {
    return err(e);
  }
}

/** Update a provider. Omit apiKey (or send empty) to keep the existing key. */
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<ProviderInput> & { id?: string };
    if (!body.id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    const updated = await updateProvider(body.id, {
      name: body.name != null ? String(body.name) : undefined,
      kind: body.kind === "embedding" ? "embedding" : body.kind === "chat" ? "chat" : undefined,
      baseUrl: body.baseUrl != null ? String(body.baseUrl) : undefined,
      apiKey: body.apiKey != null ? String(body.apiKey) : undefined,
      model: body.model != null ? String(body.model) : undefined,
      dimensions: body.dimensions != null ? Number(body.dimensions) : undefined,
      priority: body.priority != null ? Number(body.priority) : undefined,
      enabled: body.enabled != null ? Boolean(body.enabled) : undefined,
    });
    return NextResponse.json({ provider: updated });
  } catch (e) {
    return err(e);
  }
}
