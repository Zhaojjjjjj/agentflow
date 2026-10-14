"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setOk(true);
    setTimeout(() => setOk(false), 1600);
  };

  return (
    <button
      onClick={copy}
      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
    >
      {ok ? "已复制" : "复制"}
    </button>
  );
}
