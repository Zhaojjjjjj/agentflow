"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function RunDialog({
  open,
  onClose,
  onRun,
}: {
  open: boolean;
  onClose: () => void;
  onRun: (input: Record<string, unknown>, mode: "async" | "sync") => Promise<void>;
}) {
  const [text, setText] = useState('{\n  "topic": "AI Agent"\n}');
  const [mode, setMode] = useState<"async" | "sync">("async");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      <label className="label">输入参数（JSON，作为 {"{{input.xxx}}"}）</label>
      <textarea className="input mb-3 font-mono text-xs" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      <label className="label">执行模式</label>
      <div className="mb-4 flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "async"} onChange={() => setMode("async")} />
          异步（Inngest 后台，可含人工审批）
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "sync"} onChange={() => setMode("sync")} />
          同步（直接返回结果，不支持审批节点）
        </label>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" disabled={busy} onClick={submit}>
          {busy ? "启动中…" : "开始运行"}
        </button>
      </div>
    </Modal>
  );
}
