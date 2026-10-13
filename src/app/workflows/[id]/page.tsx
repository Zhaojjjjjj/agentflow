import FlowEditor from "@/components/FlowEditor";

export default async function WorkflowEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ runId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return <FlowEditor workflowId={id} initialRunId={sp.runId} />;
}
