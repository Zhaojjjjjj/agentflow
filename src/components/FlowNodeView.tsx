"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_META } from "@/lib/engine/types";
import type { AgentNode } from "@/store/editorStore";

const HANDLE_STYLE = { width: 10, height: 10, background: "#94a3b8", border: "2px solid #fff" };

export default function FlowNodeView({ data, selected }: NodeProps<AgentNode>) {
  const meta = NODE_META[data.nodeType];
  const isTrigger = data.nodeType === "trigger-manual" || data.nodeType === "trigger-schedule";
  const isOutput = data.nodeType === "output";
  const isCondition = data.nodeType === "condition";

  return (
    <div
      className={`min-w-[170px] max-w-[220px] rounded-xl border bg-white shadow-sm transition-shadow duration-150 ${
        selected ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200"
      }`}
    >
      {!isTrigger && <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: meta.color }}
          title={meta.category}
        />
        <span className="truncate text-[13px] font-semibold text-slate-900">
          {data.label || meta.label}
        </span>
      </div>
      <div className="px-3 pb-2.5 pt-1 text-[11px] text-slate-400">{meta.label}</div>
      {!isOutput && !isCondition && (
        <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
      )}
      {isCondition && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ ...HANDLE_STYLE, top: "38%", background: "#16a34a" }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ ...HANDLE_STYLE, top: "72%", background: "#dc2626" }}
          />
          <div className="flex justify-between px-3 pb-2.5 text-[10px] font-medium">
            <span className="text-green-600">true →</span>
            <span className="text-red-600">false →</span>
          </div>
        </>
      )}
    </div>
  );
}
