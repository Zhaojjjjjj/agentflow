"use client";

import { useEffect, useState } from "react";

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
}

let push: ((kind: ToastKind, msg: string) => void) | null = null;
let seq = 0;

/** 全局轻提示。在根 layout 挂载 <Toaster/> 后可用（store 等非组件模块也可直接调用）。 */
export const toast = {
  success(msg: string) {
    push?.("success", msg);
  },
  error(msg: string) {
    push?.("error", msg);
  },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    push = (kind, msg) => {
      const id = ++seq;
      setItems((xs) => [...xs.slice(-2), { id, kind, msg }]);
      window.setTimeout(() => {
        setItems((xs) => xs.filter((t) => t.id !== id));
      }, 3200);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-80 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
        >
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              t.kind === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <p className="text-sm leading-5 text-slate-700">{t.msg}</p>
        </div>
      ))}
    </div>
  );
}
