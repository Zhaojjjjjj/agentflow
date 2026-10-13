"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_META } from "@/lib/engine/types";
import type { AgentNode } from "@/store/editorStore";
import { useEditorStore } from "@/store/editorStore";

const HANDLE_STYLE = {
  width: 11,
  height: 11,
  background: "#fff",
  border: "2px solid #94a3b8",
  boxShadow: "0 1px 2px rgba(15,23,42,0.12)",
};

export default function FlowNodeView({ id, data, selected }: NodeProps<AgentNode>) {
  const meta = NODE_META[data.nodeType];
  const isTrigger = data.nodeType === "trigger-manual" || data.nodeType === "trigger-schedule";
  const isOutput = data.nodeType === "output";
  const isCondition = data.nodeType === "condition";
  const runStatus = useEditorStore((s) => s.nodeStatuses[id]);

  const statusRing =
    runStatus === "running"
      ? "border-brand-500 shadow-[0_0_0_4px_rgba(124,58,237,0.18),0_4px_14px_rgba(124,58,237,0.25)]"
      : runStatus === "succeeded"
        ? "border-green-400"
        : runStatus === "failed"
          ? "border-red-400"
          : runStatus === "waiting_approval"
            ? "border-amber-400"
            : selected
              ? "border-brand-500 shadow-[0_0_0_4px_rgba(124,58,237,0.13),0_4px_12px_rgba(15,23,42,0.08)]"
              : "border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(15,23,42,0.07)]";

  return (
    <div className={`relative min-w-[176px] max-w-[230px] rounded-[10px] border bg-white transition-all duration-150 ${statusRing}`}>
      {runStatus === "running" && (
        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500">
            <svg className="h-2.5 w-2.5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
        </span>
      )}
      {runStatus === "succeeded" && (
        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow">
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0z" clipRule="evenodd" /></svg>
        </span>
      )}
      {runStatus === "failed" && (
        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow">
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.3 5.3a1 1 0 0 0-1.4 1.4L8.6 10l-3.7 3.3a1 1 0 1 0 1.4 1.4L10 11.4l3.7 3.3a1 1 0 1 0 1.4-1.4L11.4 10l3.7-3.3a1 1 0 0 0-1.4-1.4L10 8.6 6.3 5.3z" clipRule="evenodd" /></svg>
        </span>
      )}
      {runStatus === "waiting_approval" && (
        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow">
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M6 5h4v10H6zM10 5h4v10h-4z" /></svg>
        </span>
      )}
      {runStatus === "skipped" && <span className="absolute inset-0 rounded-[10px] bg-slate-100/60" />}
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
