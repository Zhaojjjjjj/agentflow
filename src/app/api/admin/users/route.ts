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
    const { data: projects } = await sb.from("story_projects").select("id, owner_id");
    const projList = (projects ?? []) as { id: string; owner_id: string | null }[];
    const projByOwner = new Map<string, number>();
    const projIds: string[] = [];
    const projOwnerById = new Map<string, string | null>();
    for (const p of projList) {
      projIds.push(p.id);
      projOwnerById.set(p.id, p.owner_id);
      if (p.owner_id) projByOwner.set(p.owner_id, (projByOwner.get(p.owner_id) ?? 0) + 1);
    }
    let episodes: { project_id: string; word_count: number | null }[] = [];
    if (projIds.length > 0) {
      const { data } = await sb.from("episodes").select("project_id, word_count").in("project_id", projIds);
      episodes = (data ?? []) as typeof episodes;
    }
    const stats = new Map<string, { episodes: number; words: number }>();
    for (const e of episodes) {
      const owner = projOwnerById.get(e.project_id);
      if (!owner) continue;
      const s = stats.get(owner) ?? { episodes: 0, words: 0 };
      s.episodes += 1;
      s.words += e.word_count ?? 0;
      stats.set(owner, s);
    }
    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        project_count: projByOwner.get(u.id) ?? 0,
        episode_count: stats.get(u.id)?.episodes ?? 0,
        word_count: stats.get(u.id)?.words ?? 0,
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
