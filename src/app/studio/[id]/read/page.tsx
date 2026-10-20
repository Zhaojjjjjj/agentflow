import ReadView from "@/components/studio/ReadView";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReadView projectId={id} />;
}
