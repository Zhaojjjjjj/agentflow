import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** SSE: polls Supabase for run + step updates and streams them to the browser. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();

  let lastPayload = "";
  let polls = 0;
  const maxPolls = 300; // ~5 minutes

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      const timer = setInterval(async () => {
        polls++;
        try {
          const { data: run } = await sb.from("workflow_runs").select("*").eq("id", id).single();
          if (!run) {
            send({ type: "error", message: "运行记录不存在" });
            clearInterval(timer);
            controller.close();
            return;
          }
          const { data: steps } = await sb
            .from("run_steps")
            .select("id, node_id, node_type, node_name, status, tokens, cost_usd, duration_ms, error, started_at, finished_at")
            .eq("run_id", id)
            .order("created_at", { ascending: true });
          const payload = JSON.stringify({ type: "update", run, steps: steps || [] });
          if (payload !== lastPayload) {
            lastPayload = payload;
            send({ type: "update", run, steps: steps || [] });
          }
          const terminal = ["succeeded", "failed", "rejected", "cancelled"].includes(
            (run as { status: string }).status
          );
          if (terminal || polls >= maxPolls) {
            send({ type: "done", run });
            clearInterval(timer);
            controller.close();
          }
        } catch (e) {
          send({ type: "error", message: e instanceof Error ? e.message : String(e) });
          clearInterval(timer);
          controller.close();
        }
      }, 1000);
    },
    cancel() {
      /* client disconnected */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
