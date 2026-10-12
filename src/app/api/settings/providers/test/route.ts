import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { decryptSecret } from "@/lib/crypto";
import { testConnection } from "@/lib/llm/providerStore";

export const dynamic = "force-dynamic";

/**
 * Test a provider connection server-side.
 * Body: { id } for a saved provider, or { baseUrl, apiKey, model } for ad-hoc testing.
 * Plaintext keys never leave the server.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    };
    let baseUrl = body.baseUrl || "";
    let apiKey = body.apiKey || "";
    let model = body.model || "";
    if (body.id) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("llm_providers")
        .select("base_url,api_key_encrypted,model")
        .eq("id", body.id)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: "供应商不存在" }, { status: 404 });
      }
      const row = data as { base_url: string; api_key_encrypted: string; model: string };
      baseUrl = row.base_url;
      apiKey = decryptSecret(row.api_key_encrypted);
      model = row.model;
    }
    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "缺少 baseUrl / apiKey / model" }, { status: 400 });
    }
    const result = await testConnection(baseUrl, apiKey, model);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
