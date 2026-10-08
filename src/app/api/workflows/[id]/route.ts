import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { validateCron, cronNext } from "@/lib/engine/cron";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = getSupabase();
  const { data, error } = await sb.from("workflows").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  return NextResponse.json({ workflow: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = getSupabase();
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = String(body.name).slice(0, 120);
  if (body.description !== undefined) patch.description = String(body.description);
  if (body.is_published !== undefined) patch.is_published = Boolean(body.is_published);
  if (body.schedule_cron !== undefined) patch.schedule_cron = body.schedule_cron || null;
  if (body.schedule_enabled !== undefined) patch.schedule_enabled = Boolean(body.schedule_enabled);

  if (body.definition !== undefined) {
    const def = body.definition;
    if (!def || !Array.isArray(def.nodes)) {
      return NextResponse.json({ error: "definition 非法" }, { status: 400 });
    }
    // Validate trigger-schedule cron if present
    for (const n of def.nodes as { type?: string; data?: { config?: Record<string, unknown> } }[]) {
      if (n.type === "trigger-schedule") {
        const cron = String(n.data?.config?.cron || "");
        const err = cron ? validateCron(cron) : "定时节点缺少 cron 表达式";
        if (err) return NextResponse.json({ error: `定时节点 cron 非法: ${err}` }, { status: 400 });
      }
    }
    patch.definition = def;
    // Bump version + snapshot
    const { data: cur } = await sb.from("workflows").select("version").eq("id", id).single();
    const nextVersion = ((cur?.version as number) || 0) + 1;
    patch.version = nextVersion;
    await sb.from("workflow_versions").insert({
      workflow_id: id,
      version: nextVersion,
      definition: def,
      note: String(body.versionNote || "自动保存"),
    });
  }

  // Recompute next_run_at when scheduling changes
  const { data: after } = await sb.from("workflows").select("schedule_enabled, schedule_cron").eq("id", id).single();
  const enabled = (patch.schedule_enabled ?? (after as { schedule_enabled?: boolean } | null)?.schedule_enabled) as boolean | undefined;
  const cron = (patch.schedule_cron ?? (after as { schedule_cron?: string | null } | null)?.schedule_cron) as string | null | undefined;
  if (patch.schedule_enabled !== undefined || patch.schedule_cron !== undefined) {
    if (enabled) {
      if (!cron) return NextResponse.json({ error: "启用定时需要填写 cron 表达式" }, { status: 400 });
      const err = validateCron(cron);
      if (err) return NextResponse.json({ error: `cron 非法: ${err}` }, { status: 400 });
      const next = cronNext(cron, new Date());
      patch.next_run_at = next ? next.toISOString() : null;
    } else {
      patch.next_run_at = null;
    }
  }

  const { error } = await sb.from("workflows").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = getSupabase();
  const { error } = await sb.from("workflows").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
