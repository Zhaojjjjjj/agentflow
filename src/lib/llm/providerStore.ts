// Server-side admin helpers for the llm_providers registry.
// Plaintext API keys never leave this module: rows are decrypted only to
// compute a display mask, and every write encrypts first.

import { getSupabase } from "@/lib/supabase";
import { decryptSecret, encryptSecret, maskSecret, isEncryptionConfigured } from "@/lib/crypto";
import { readEnvProviders } from "@/lib/llm/providers";

export type ProviderKind = "chat" | "embedding" | "image";

export interface DbProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  base_url: string;
  api_key_encrypted: string;
  model: string;
  dimensions: number | null;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderPublic extends Omit<DbProvider, "api_key_encrypted"> {
  key_mask: string;
}

const PUBLIC_COLS =
  "id,name,kind,base_url,api_key_encrypted,model,dimensions,priority,enabled,created_at,updated_at";

function toPublic(r: DbProvider): ProviderPublic {
  let keyMask = "****";
  try {
    keyMask = maskSecret(decryptSecret(r.api_key_encrypted));
  } catch {
    // Key undecryptable (e.g. APP_ENCRYPTION_KEY rotated) — show masked placeholder.
  }
  const { api_key_encrypted: _drop, ...rest } = r;
  return { ...rest, key_mask: keyMask };
}

export function encryptionReady(): boolean {
  return isEncryptionConfigured();
}

export async function listProviders(): Promise<ProviderPublic[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("llm_providers")
    .select(PUBLIC_COLS)
    .order("kind", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`读取供应商列表失败：${error.message}`);
  return ((data ?? []) as DbProvider[]).map(toPublic);
}

export interface ProviderInput {
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey?: string; // required on create; optional on update (empty = keep existing)
  model: string;
  dimensions?: number | null;
  priority?: number;
  enabled?: boolean;
}

function validateInput(input: ProviderInput, isCreate: boolean): string | null {
  if (!input.name?.trim()) return "名称不能为空";
  if (input.kind !== "chat" && input.kind !== "embedding" && input.kind !== "image") return "类型只能是 chat、embedding 或 image";
  if (!input.baseUrl?.trim()) return "Base URL 不能为空";
  if (isCreate && !input.apiKey?.trim()) return "API Key 不能为空";
  if (!input.model?.trim()) return "模型不能为空";
  if (input.kind === "embedding") {
    const d = Number(input.dimensions);
    if (input.dimensions != null && (!Number.isInteger(d) || d <= 0)) return "dimensions 必须是正整数";
  }
  return null;
}

export async function createProvider(input: ProviderInput): Promise<ProviderPublic> {
  const err = validateInput(input, true);
  if (err) throw Object.assign(new Error(err), { status: 400 });
  const sb = getSupabase();
  const { data: existing } = await sb.from("llm_providers").select("id").eq("name", input.name.trim()).limit(1);
  if (existing && existing.length > 0) {
    throw Object.assign(new Error(`已存在同名供应商「${input.name.trim()}」`), { status: 409 });
  }
  const row = {
    name: input.name.trim(),
    kind: input.kind,
    base_url: input.baseUrl.trim().replace(/\/$/, ""),
    api_key_encrypted: encryptSecret(input.apiKey!.trim()), // throws when APP_ENCRYPTION_KEY missing
    model: input.model.trim(),
    dimensions: input.kind === "embedding" ? Number(input.dimensions) || 1024 : null,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    enabled: input.enabled !== false,
  };
  const { data, error } = await sb.from("llm_providers").insert(row).select(PUBLIC_COLS).single();
  if (error) throw new Error(`创建失败：${error.message}`);
  return toPublic(data as DbProvider);
}

export async function updateProvider(id: string, input: Partial<ProviderInput>): Promise<ProviderPublic> {
  if (!id) throw Object.assign(new Error("缺少 id"), { status: 400 });
  const sb = getSupabase();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name != null) {
    if (!input.name.trim()) throw Object.assign(new Error("名称不能为空"), { status: 400 });
    patch.name = input.name.trim();
  }
  if (input.kind != null) {
    if (input.kind !== "chat" && input.kind !== "embedding") throw Object.assign(new Error("类型只能是 chat 或 embedding"), { status: 400 });
    patch.kind = input.kind;
  }
  if (input.baseUrl != null) patch.base_url = input.baseUrl.trim().replace(/\/$/, "");
  if (input.apiKey?.trim()) patch.api_key_encrypted = encryptSecret(input.apiKey.trim());
  if (input.model != null) {
    if (!input.model.trim()) throw Object.assign(new Error("模型不能为空"), { status: 400 });
    patch.model = input.model.trim();
  }
  if (input.dimensions != null) patch.dimensions = Number(input.dimensions) || null;
  if (input.priority != null) patch.priority = Number(input.priority) || 0;
  if (input.enabled != null) patch.enabled = Boolean(input.enabled);
  const { data, error } = await sb.from("llm_providers").update(patch).eq("id", id).select(PUBLIC_COLS).single();
  if (error) throw Object.assign(new Error(`更新失败：${error.message}`), { status: error.code === "PGRST116" ? 404 : 500 });
  return toPublic(data as DbProvider);
}

export async function deleteProvider(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("llm_providers").delete().eq("id", id);
  if (error) throw new Error(`删除失败：${error.message}`);
}

/** Swap priority with the adjacent provider in the same kind group. */
export async function moveProvider(id: string, direction: "up" | "down"): Promise<ProviderPublic[]> {
  const sb = getSupabase();
  const { data: cur, error: curErr } = await sb
    .from("llm_providers")
    .select("id,kind,priority")
    .eq("id", id)
    .single();
  if (curErr || !cur) throw Object.assign(new Error("供应商不存在"), { status: 404 });
  const { data: group } = await sb
    .from("llm_providers")
    .select("id,priority,created_at")
    .eq("kind", (cur as { kind: string }).kind)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (group ?? []) as { id: string; priority: number }[];
  const idx = rows.findIndex((r) => r.id === id);
  const neighbor = direction === "up" ? rows[idx - 1] : rows[idx + 1];
  if (idx < 0 || !neighbor) return listProviders(); // already at edge — no-op
  const curP = (cur as { priority: number }).priority;
  await sb.from("llm_providers").update({ priority: curP }).eq("id", neighbor.id);
  await sb.from("llm_providers").update({ priority: neighbor.priority }).eq("id", id);
  return listProviders();
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

/** Server-side connectivity test: tries GET /models, falls back to a minimal chat call. */
export async function testConnection(
  baseURL: string,
  apiKey: string,
  model: string
): Promise<TestResult> {
  const base = baseURL.replace(/\/$/, "");
  const t0 = Date.now();
  const headers = { Authorization: `Bearer ${apiKey}` };
  // 1) lightweight: list models
  try {
    const r = await fetch(`${base}/models`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      return { ok: true, latencyMs: Date.now() - t0, message: "连接成功（GET /models 返回 200）" };
    }
  } catch {
    // fall through to chat probe
  }
  // 2) minimal chat completion probe
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const ms = Date.now() - t0;
    if (r.ok) return { ok: true, latencyMs: ms, message: "连接成功（chat 调用返回 200）" };
    const body = await r.text().catch(() => "");
    return { ok: false, latencyMs: ms, message: `HTTP ${r.status}：${body.slice(0, 200) || r.statusText}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, message: `请求失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Import env-var chat providers into the DB (idempotent by name). */
export async function importFromEnv(): Promise<{ imported: string[]; skipped: string[] }> {
  const envProviders = readEnvProviders();
  const sb = getSupabase();
  const { data: existing } = await sb.from("llm_providers").select("name");
  const names = new Set(((existing ?? []) as { name: string }[]).map((r) => r.name));
  const { data: maxRow } = await sb
    .from("llm_providers")
    .select("priority")
    .eq("kind", "chat")
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextPriority = Number((maxRow as { priority: number } | null)?.priority ?? -1) + 1;
  const imported: string[] = [];
  const skipped: string[] = [];
  for (const p of envProviders) {
    if (names.has(p.name)) {
      skipped.push(p.name);
      continue;
    }
    await sb.from("llm_providers").insert({
      name: p.name,
      kind: "chat",
      base_url: p.baseURL,
      api_key_encrypted: encryptSecret(p.apiKey), // throws when APP_ENCRYPTION_KEY missing
      model: p.model,
      dimensions: null,
      priority: nextPriority++,
      enabled: true,
    });
    names.add(p.name);
    imported.push(p.name);
  }
  return { imported, skipped };
}
