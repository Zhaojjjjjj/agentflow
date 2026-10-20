import { getSupabase } from "@/lib/supabase";

export type VersionSource = "pipeline" | "edit" | "retry" | "restore" | "redraft";

interface EpisodeRow {
  outline: string;
  content: string;
  summary: string;
  word_count: number;
}

/**
 * 覆盖正文/大纲之前先把当前版本存档。008 未执行（表不存在）时静默跳过，
 * 不阻塞主流程。
 */
export async function archiveEpisodeVersion(
  episodeId: string,
  source: VersionSource
): Promise<void> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("episodes")
      .select("outline, content, summary, word_count")
      .eq("id", episodeId)
      .single();
    if (error || !data) return;
    const row = data as EpisodeRow;
    if (!row.content && !row.outline) return; // 空集不必存档
    await sb.from("episode_versions").insert({
      episode_id: episodeId,
      outline: row.outline ?? "",
      content: row.content ?? "",
      summary: row.summary ?? "",
      word_count: row.word_count ?? 0,
      source,
    });
  } catch {
    // 表不存在或写入失败都不阻塞主流程
  }
}
