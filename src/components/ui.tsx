"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  ghost: "text-slate-600 hover:bg-slate-100",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "secondary", size = "md", className = "", ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
      {...rest}
    />
  );
}

/* ---------- Badge ---------- */

type BadgeTone = "purple" | "green" | "red" | "amber" | "gray";

const BADGE_TONE: Record<BadgeTone, string> = {
  purple: "bg-brand-100 text-brand-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  gray: "bg-slate-100 text-slate-500",
};

export function Badge({
  tone = "gray",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ---------- Field / Input / Textarea / Select ---------- */

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs leading-4 text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[11px] leading-4 text-slate-400">{hint}</p>
      )}
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLS} ${props.className || ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLS} ${props.className || ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLS} ${props.className || ""}`} />;
}

/* ---------- ConfirmDialog ---------- */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- EmptyState / Skeleton ---------- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
      </span>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded bg-slate-100" />
            <div className="h-2.5 w-3/5 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- PageHeader ---------- */

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

/* ---------- StatusBadge / RunTimeline ---------- */

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-500",
  running: "bg-brand-100 text-brand-700",
  waiting_approval: "bg-amber-100 text-amber-700",
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-slate-100 text-slate-400",
  queued: "bg-slate-100 text-slate-500",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "等待",
  running: "运行中",
  waiting_approval: "待审批",
  succeeded: "成功",
  failed: "失败",
  skipped: "跳过",
  queued: "排队中",
  rejected: "已拒绝",
  cancelled: "已取消",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLE[status] || "bg-slate-100 text-slate-500"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export interface StepRow {
  id: string;
  node_id: string;
  node_type: string;
  node_name: string;
  status: string;
  tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

const STEP_DOT: Record<string, string> = {
  running: "#7C3AED",
  waiting_approval: "#D97706",
  succeeded: "#16A34A",
  failed: "#DC2626",
  rejected: "#DC2626",
  pending: "#CBD5E1",
  queued: "#CBD5E1",
  skipped: "#CBD5E1",
  cancelled: "#CBD5E1",
};

export function RunTimeline({ steps }: { steps: StepRow[] }) {
  if (steps.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
        <p className="text-sm text-slate-400">暂无节点执行记录</p>
      </div>
    );
  return (
    <ol className="relative space-y-3 border-l-2 border-slate-100 pl-6">
      {steps.map((s) => (
        <li key={s.id} className="relative">
          <span
            className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-white shadow-[0_0_0_3px_rgba(15,23,42,0.04)]"
            style={{ background: STEP_DOT[s.status] || "#CBD5E1" }}
          />
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-150 hover:border-slate-300 hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="text-sm font-semibold tracking-tight text-slate-900">
                {s.node_name || s.node_type}
              </span>
              <StatusBadge status={s.status} />
              <span className="ml-auto font-mono text-[11px] text-slate-300">{s.node_id}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {s.duration_ms != null && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  耗时 {(s.duration_ms / 1000).toFixed(1)}s
                </span>
              )}
              {s.tokens > 0 && (
                <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  {s.tokens.toLocaleString()} tokens
                </span>
              )}
              {Number(s.cost_usd) > 0 && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  ${Number(s.cost_usd).toFixed(5)}
                </span>
              )}
              {s.started_at && (
                <span className="inline-flex items-center px-1 py-0.5 text-[11px] text-slate-400">
                  {new Date(s.started_at).toLocaleTimeString()}
                </span>
              )}
            </div>
            {s.error && (
              <p className="mt-2.5 rounded-xl bg-red-50/80 p-3 font-mono text-xs leading-5 text-red-600">
                {s.error}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function JsonBlock({ title, data }: { title: string; data: unknown }) {
  if (data === null || data === undefined) return null;
  return (
    <div className="mb-4">
      <h4 className="mb-1.5 text-xs font-semibold text-slate-500">{title}</h4>
      <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3.5 font-mono text-xs leading-5 text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/* ---------- Markdown（运行输出的富文本渲染） ---------- */

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-xl font-bold tracking-tight text-slate-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2.5 mt-5 border-b border-slate-100 pb-2 text-lg font-bold tracking-tight text-slate-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-slate-900 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold text-slate-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-3 text-sm leading-7 text-slate-800 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-800">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm leading-7 text-slate-800">{children}</ol>
  ),
  li: ({ children }) => <li className="[&>p]:mb-0">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="text-slate-700">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-brand-300 bg-brand-50/50 py-2 pl-4 pr-3 text-sm leading-7 text-slate-700 [&>p]:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-auto rounded-lg bg-slate-900 p-3.5 font-mono text-xs leading-6 text-slate-100">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-slate-200" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-600 underline hover:text-brand-700">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-left font-semibold text-slate-700">{children}</th>
  ),
  td: ({ children }) => <td className="border border-slate-200 px-3 py-1.5 text-slate-700">{children}</td>,
};

export function Markdown({ text }: { text: string }) {
  return <ReactMarkdown components={mdComponents}>{text}</ReactMarkdown>;
}

/* ---------- CopyButton ---------- */

export function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 兜底：隐藏 textarea 复制
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors duration-150 ${
        done
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
      }`}
      title={label}
    >
      {done ? (
        <>
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
          </svg>
          已复制
        </>
      ) : (
        <>
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h0V3z" opacity="0.4" />
            <path fillRule="evenodd" d="M6 5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1h-1v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1V5H6z" clipRule="evenodd" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

/* ---------- OutputView ---------- */

/** 运行结果的可视化展示：按字段分块，长文本用 Markdown 易读排版而非 raw JSON */
export function OutputView({ data }: { data: unknown }) {
  // 防御：有些旧数据可能把对象存成了 JSON 字符串，先尝试还原
  let value = data;
  if (typeof value === "string") {
    const t = value.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        value = JSON.parse(t);
      } catch {
        /* 保持原字符串展示 */
      }
    }
  }
  const data2 = value;
  if (data2 === null || data2 === undefined) {
    return <p className="py-6 text-center text-sm text-slate-400">暂无输出</p>;
  }
  if (typeof data2 !== "object" || Array.isArray(data2)) {
    const text = typeof data2 === "string" ? data2 : JSON.stringify(data2, null, 2);
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-end border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
          <CopyButton text={text} />
        </div>
        <div className="max-h-96 overflow-auto px-4 py-3">
          <Markdown text={text} />
        </div>
      </div>
    );
  }
  const entries = Object.entries(data2 as Record<string, unknown>);
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">暂无输出</p>;
  }
  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const strValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        const isLongText =
          typeof value === "string" && (value.includes("\n") || value.length > 200);
        return (
          <div key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-1.5">
              <span className="font-mono text-xs font-medium text-slate-500">{key}</span>
              <CopyButton text={strValue} />
            </div>
            <div className="px-4 py-3">
              {isLongText ? (
                <Markdown text={value as string} />
              ) : typeof value === "string" ? (
                <p className="text-sm leading-6 text-slate-800">{value || <span className="text-slate-300">空</span>}</p>
              ) : (
                <pre className="overflow-auto font-mono text-xs leading-5 text-slate-600">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
