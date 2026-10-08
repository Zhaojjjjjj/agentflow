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
      className={`min-w-[170px] max-w-[220px] rounded-xl border-2 bg-white shadow-sm transition-shadow ${
        selected ? "border-brand-500 shadow-md" : "border-slate-200"
      }`}
    >
      {!isTrigger && <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />}
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-2 text-[13px] font-semibold text-white"
        style={{ background: meta.color }}
      >
        <span className="truncate">{data.label || meta.label}</span>
      </div>
      <div className="px-3 py-1.5 text-[11px] text-slate-500">{meta.label}</div>
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
          <div className="flex justify-between px-3 pb-2 text-[10px] font-medium">
            <span className="text-green-600">true →</span>
            <span className="text-red-600">false →</span>
          </div>
        </>
      )}
    </div>
  );
}
