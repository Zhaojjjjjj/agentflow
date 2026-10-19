"use client";

import { useEffect, useState } from "react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除/重写）：确认按钮用红色 */
  danger?: boolean;
}

type Resolver = (v: boolean) => void;

let request: ((opts: ConfirmOptions, resolve: Resolver) => void) | null = null;

/**
 * 全局确认弹窗（替代原生 confirm/alert）。
 * 点击确定 resolve(true)，取消/点遮罩/Esc resolve(false)。
 * 用法：const ok = await confirmDialog({ title: "删除本集", message: "此操作不可恢复。", confirmText: "删除", danger: true });
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!request) return resolve(false);
    request(opts, resolve);
  });
}

/** 挂在根 layout（与 <Toaster/> 并列），全局只需一份。 */
export function ConfirmHost() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: Resolver } | null>(null);

  useEffect(() => {
    request = (opts, resolve) => setState({ opts, resolve });
    return () => {
      request = null;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const r = state.resolve;
        setState(null);
        r(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [state]);

  if (!state) return null;
  const { title, message, confirmText = "确定", cancelText = "取消", danger } = state.opts;
  const done = (v: boolean) => {
    const r = state.resolve;
    setState(null);
    r(v);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={() => done(false)}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        style={{ animation: "confirm-pop-in 0.18s cubic-bezier(0.21, 0.9, 0.35, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {message ? <p className="mt-1.5 text-sm leading-6 text-slate-600">{message}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => done(false)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => done(true)}
            autoFocus
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#7C3AED] hover:bg-[#6D28D9]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
