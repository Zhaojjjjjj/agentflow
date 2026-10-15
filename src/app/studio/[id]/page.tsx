import ProjectDetail from "@/components/studio/ProjectDetail";

export const dynamic = "force-dynamic";

/** `/studio/[id]` 作品详情页（middleware 已要求登录） */
export default async function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
