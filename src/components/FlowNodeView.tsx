"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_META } from "@/lib/engine/types";
import type { AgentNode } from "@/store/editorStore";

const HANDLE_STYLE = {
  width: 11,
  height: 11,
  background: "#fff",
  border: "2px solid #94a3b8",
  boxShadow: "0 1px 2px rgba(15,23,42,0.12)",
};

export default function FlowNodeView({ data, selected }: NodeProps<AgentNode>) {
  const meta = NODE_META[data.nodeType];
  const isTrigger = data.nodeType === "trigger-manual" || data.nodeType === "trigger-schedule";
  const isOutput = data.nodeType === "output";
  const isCondition = data.nodeType === "condition";

  return (
    <div
      className={`min-w-[176px] max-w-[230px] rounded-[10px] border bg-white transition-all duration-150 ${
        selected
          ? "border-brand-500 shadow-[0_0_0_4px_rgba(124,58,237,0.13),0_4px_12px_rgba(15,23,42,0.08)]"
          : "border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(15,23,42,0.07)]"
      }`}
    >
      {!isTrigger && <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
          style={{ background: meta.color, boxShadow: `0 0 0 1px ${meta.color}33` }}
          title={meta.category}
        />
        <span className="truncate text-[13px] font-semibold tracking-tight text-slate-900">
          {data.label || meta.label}
        </span>
      </div>
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
        <span className="text-[11px] text-slate-400">{meta.label}</span>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {meta.category}
        </span>
      </div>
      {!isOutput && !isCondition && (
        <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
      )}
      {isCondition && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ ...HANDLE_STYLE, top: "36%", borderColor: "#16a34a" }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ ...HANDLE_STYLE, top: "70%", borderColor: "#dc2626" }}
          />
          <div className="flex justify-between border-t border-slate-100 px-3 py-1.5 text-[10px] font-medium">
            <span className="text-green-600">true →</span>
            <span className="text-red-500">→ false</span>
          </div>
        </>
      )}
    </div>
  );
}
