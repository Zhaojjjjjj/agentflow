import FlowEditor from "@/components/FlowEditor";

export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FlowEditor workflowId={id} />;
}
