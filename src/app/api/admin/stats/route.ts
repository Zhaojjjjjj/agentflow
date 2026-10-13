import { NextRequest, NextResponse } from "next/server";
import { authAdmin, forbidden } from "@/lib/access";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Admin: platform overview + per-user stats + 14-day trend. */
export async function GET(req: NextRequest) {
  const me = await authAdmin(req);
  if (!me) return forbidden();
  try {
    const sb = getSupabase();
    const [{ count: userCount }, { data: workflows }, { data: runs }] = await Promise.all([
      sb.from("users").select("id", { count: "exact", head: true }),
      sb.from("workflows").select("id, owner_id, created_at"),
      sb.from("workflow_runs").select("id, workflow_id, total_tokens, cost_usd, status, created_at"),
    ]);

    const wfList = (workflows ?? []) as { id: string; owner_id: string | null; created_at: string }[];
    const runList = (runs ?? []) as {
      id: string;
      workflow_id: string;
      total_tokens: number | null;
      cost_usd: number | null;
      status: string;
      created_at: string;
    }[];

    const totalTokens = runList.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
    const totalCost = runList.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

    // 14-day daily trend
    const days: { date: string; runs: number; tokens: number }[] = [];
    const dayMap = new Map<string, { runs: number; tokens: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { runs: 0, tokens: 0 });
      days.push({ date: key.slice(5), runs: 0, tokens: 0 });
    }
    for (const r of runList) {
      const key = new Date(r.created_at).toISOString().slice(0, 10);
      const slot = dayMap.get(key);
      if (slot) {
        slot.runs += 1;
        slot.tokens += r.total_tokens ?? 0;
      }
    }
    days.forEach((d, i) => {
      const keys = [...dayMap.keys()];
      const slot = dayMap.get(keys[i]);
      if (slot) {
        d.runs = slot.runs;
        d.tokens = slot.tokens;
      }
    });

    // per-user token leaderboard
    const ownerByWf = new Map(wfList.map((w) => [w.id, w.owner_id]));
    const tokensByUser = new Map<string, number>();
    for (const r of runList) {
      const owner = ownerByWf.get(r.workflow_id);
      if (!owner) continue;
      tokensByUser.set(owner, (tokensByUser.get(owner) ?? 0) + (r.total_tokens ?? 0));
    }
    const { data: users } = await sb.from("users").select("id, username, avatar_url, role");
    const leaderboard = ((users ?? []) as { id: string; username: string; avatar_url: string | null; role: string }[])
      .map((u) => ({ ...u, tokens: tokensByUser.get(u.id) ?? 0 }))
      .sort((a, b) => b.tokens - a.tokens);

    return NextResponse.json({
      overview: {
        users: userCount ?? 0,
        workflows: wfList.length,
        runs: runList.length,
        tokens: totalTokens,
        cost_usd: Math.round(totalCost * 10000) / 10000,
      },
      daily: days,
      leaderboard,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "加载失败" }, { status: 500 });
  }
}
