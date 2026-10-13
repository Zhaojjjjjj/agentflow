"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { Button, Field } from "./ui";

const MODES = [
  {
    value: "async" as const,
    title: "异步执行",
    desc: "Inngest 后台运行，可包含人工审批节点，适合长流程",
  },
  {
    value: "sync" as const,
    title: "同步执行",
    desc: "直接返回结果，不支持审批节点，适合快速验证",
  },
];

export default function RunDialog({
  open,
  onClose,
  onRun,
  suggestedMode = "async",
  suggestReason = "",
}: {
  open: boolean;
  onClose: () => void;
  onRun: (input: Record<string, unknown>, mode: "async" | "sync") => Promise<void>;
  /** 根据工作流节点自动推荐的执行模式 */
  suggestedMode?: "async" | "sync";
  suggestReason?: string;
}) {
  const [text, setText] = useState('{\n  "topic": "AI Agent"\n}');
  const [mode, setMode] = useState<"async" | "sync">(suggestedMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 每次打开对话框时，按当前工作流重新推荐模式（用户仍可手动切换）
  useEffect(() => {
    if (open) setMode(suggestedMode);
  }, [open, suggestedMode]);

  const submit = async () => {
    setError("");
    let input: Record<string, unknown> = {};
    if (text.trim()) {
      try {
        input = JSON.parse(text);
      } catch {
        setError("input 不是合法 JSON");
        return;
      }
    }
    setBusy(true);
    try {
      await onRun(input, mode);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="手动运行">
      <Field label="输入参数（JSON，作为 {{input.xxx}}）">
        <textarea
          className="input font-mono text-xs"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <p className="mb-1.5 text-xs font-medium text-slate-600">执行模式</p>
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`rounded-xl border p-3.5 text-left transition-colors duration-150 ${
                active
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    active ? "border-brand-600" : "border-slate-300"
                  }`}
                >
                  {active && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                </span>
                <span className={`text-sm font-medium ${active ? "text-brand-700" : "text-slate-900"}`}>
                  {m.title}
                </span>
              </span>
              <span className="mt-1.5 block text-xs leading-5 text-slate-500">{m.desc}</span>
            </button>
          );
        })}
      </div>
      {suggestReason && (
        <p className="mb-4 -mt-2 text-xs leading-5 text-slate-500">
          <span className="font-medium text-slate-600">自动选择：</span>
          {suggestReason}
        </p>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" disabled={busy} onClick={submit}>
          {busy ? "启动中…" : "开始运行"}
        </Button>
      </div>
    </Modal>
  );
}
