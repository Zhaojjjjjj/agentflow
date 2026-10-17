import EpisodeDetail from "@/components/studio/EpisodeDetail";

export const dynamic = "force-dynamic";

/** `/studio/[id]/episodes/[episodeId]` 剧集详情：写作进度 / 大纲审稿 / 正文阅读 / 发布 */
export default async function StudioEpisodePage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId } = await params;
  return <EpisodeDetail projectId={id} episodeId={episodeId} />;
}
