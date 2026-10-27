"use client";

import type { ReactNode } from "react";

/** 后台分区卡片：统一的标题区（标题+说明+右侧操作）与内容区，是后台页面的基本构图单元。 */
export function Section({
  title,
  desc,
  actions,
  children,
  flush = false,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** flush=true 时内容区无内边距（适合列表/表格贴边） */
  flush?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
          {desc && <p className="mt-0.5 text-[13px] leading-5 text-slate-400">{desc}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pt-0.5">{actions}</div>}
      </header>
      <div className={flush ? "" : "px-6 py-5"}>{children}</div>
    </section>
  );
}

/** 开关 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${
        checked ? "bg-[#7C3AED]" : "bg-slate-200 hover:bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** 图标操作按钮（带 tooltip 的 title） */
export function IconBtn({
  title,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "hover:border-red-100 hover:bg-red-50 hover:text-red-500"
          : "hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

/** 状态点 + 文字 */
export function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${ok ? "text-emerald-600" : "text-slate-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </span>
  );
}

/* ---------- 常用小图标（16px，stroke currentColor） ---------- */
const S = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none" } as const;

export const IPlug = (
  <svg {...S}>
    <path d="M5 2v3M11 2v3M3.5 5h9v2.5a4.5 4.5 0 0 1-9 0V5ZM8 12v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IUp = (
  <svg {...S}>
    <path d="M8 13V3m0 0L4 7m4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IDown = (
  <svg {...S}>
    <path d="M8 3v10m0 0 4-4M8 13 4 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IPencil = (
  <svg {...S}>
    <path d="M11.3 2.2a1.8 1.8 0 0 1 2.5 2.5L5 13.5 2 14l.5-3 8.8-8.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
export const ITrash = (
  <svg {...S}>
    <path d="M2.5 4h11M6.5 4V2.8c0-.5.4-.8.8-.8h1.4c.4 0 .8.3.8.8V4M4 4l.7 8.2c0 .5.4.8.9.8h4.8c.5 0 .9-.3.9-.8L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IPlus = (
  <svg {...S}>
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/* ---------- 右侧滑出抽屉（长表单的新建/编辑标准形态） ---------- */
import { AnimatePresence, motion } from "framer-motion";
import { useEscapeClose } from "@/components/ui";

export function Drawer({
  open,
  onClose,
  title,
  desc,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  /** 粘性底部操作区（取消/保存） */
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEscapeClose(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute right-0 top-0 flex h-full w-[min(620px,100vw)] flex-col bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
                {desc && <p className="mt-0.5 text-[13px] leading-5 text-slate-400">{desc}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="关闭"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="border-t border-slate-100 bg-white px-6 py-4">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
