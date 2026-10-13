import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { createUser, listUsers } from "@/lib/users";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Admin: list users with per-user stats. */
export async function GET(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  try {
    const users = await listUsers();
    const sb = getSupabase();
    const { data: workflows } = await sb.from("workflows").select("id, owner_id");
    const wfByOwner = new Map<string, number>();
    const wfIds: string[] = [];
    for (const w of (workflows ?? []) as { id: string; owner_id: string | null }[]) {
      wfIds.push(w.id);
      if (w.owner_id) wfByOwner.set(w.owner_id, (wfByOwner.get(w.owner_id) ?? 0) + 1);
    }
    let runs: { workflow_id: string; total_tokens: number }[] = [];
    if (wfIds.length > 0) {
      const { data } = await sb.from("workflow_runs").select("workflow_id, total_tokens").in("workflow_id", wfIds);
      runs = (data ?? []) as typeof runs;
    }
    const wfOwnerById = new Map<string, string | null>();
    for (const w of (workflows ?? []) as { id: string; owner_id: string | null }[]) {
      wfOwnerById.set(w.id, w.owner_id);
    }
    const stats = new Map<string, { runs: number; tokens: number }>();
    for (const r of runs) {
      const owner = wfOwnerById.get(r.workflow_id);
      if (!owner) continue;
      const s = stats.get(owner) ?? { runs: 0, tokens: 0 };
      s.runs += 1;
      s.tokens += r.total_tokens ?? 0;
      stats.set(owner, s);
    }
    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        workflow_count: wfByOwner.get(u.id) ?? 0,
        run_count: stats.get(u.id)?.runs ?? 0,
        total_tokens: stats.get(u.id)?.tokens ?? 0,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "加载失败" }, { status: 500 });
  }
}

/** Admin: create a user. */
export async function POST(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  const body = await req.json().catch(() => ({}));
  try {
    const user = await createUser({
      username: String(body.username || ""),
      password: String(body.password || ""),
      role: body.role === "admin" ? "admin" : "user",
    });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "创建失败" }, { status: 400 });
  }
}
