"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface WF {
  id: string;
  name: string;
}

interface Item {
  id: string;
  label: string;
  sub?: string;
  kind: "action" | "nav" | "workflow";
  run: () => void;
}

/**
 * Cmd+K / Ctrl+K 命令面板：搜索工作流、快速跳转、常用操作。
 * 通过 `agentflow:open-palette` 事件也可从 TopNav 的 ⌘K 按钮打开。
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [workflows, setWorkflows] = useState<WF[]>([]);
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("agentflow:open-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("agentflow:open-palette", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.workflows)) {
          setWorkflows(
            j.workflows.map((w: { id: string; name: string }) => ({
              id: w.id,
              name: w.name || "未命名工作流",
            }))
          );
        }
      })
      .catch(() => {});
    return () => clearTimeout(t);
  }, [open ]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const createWorkflow = useCallback(() => {
    setOpen(false);
    if (pathname === "/") {
      window.dispatchEvent(new Event("agentflow:create-workflow"));
    } else {
      router.push("/");
      window.setTimeout(() => window.dispatchEvent(new Event("agentflow:create-workflow")), 600);
    }
  }, [pathname, router]);

  const logout = useCallback(async () => {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }, [router]);

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const list: Item[] = [];
    if (match("新建工作流") || match("new workflow") || match("create")) {
      list.push({ id: "act-new", label: "新建工作流", sub: "动作", kind: "action", run: createWorkflow });
    }
    const navs = [
      { label: "工作流列表", href: "/" },
      { label: "API Keys", href: "/api-keys" },
      { label: "LLM 设置", href: "/settings" },
    ];
    for (const n of navs) {
      if (match(n.label)) list.push({ id: `nav-${n.href}`, label: `前往${n.label}`, sub: "导航", kind: "nav", run: () => go(n.href) });
    }
    for (const w of workflows) {
      if (match(w.name)) {
        list.push({ id: `wf-${w.id}`, label: w.name, sub: "工作流", kind: "workflow", run: () => go(`/workflows/${w.id}`) });
      }
    }
    if (match("退出登录") || match("logout")) {
      list.push({ id: "act-logout", label: "退出登录", sub: "动作", kind: "action", run: logout });
    }
    return list.slice(0, 12);
  }, [query, workflows, go, createWorkflow, logout]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[index]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, index]);

  if (!open) return null;

  return (
    <div
      className="cmd-overlay fixed inset-0 z-[80] bg-slate-950/30 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
    >
      <div
        className="cmd-panel mx-auto mt-[14vh] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0 text-slate-400" aria-hidden>
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m11 11 3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索工作流、页面或操作…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">没有匹配结果</p>
          )}
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => it.run()}
              onMouseEnter={() => setIndex(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-100 ${
                i === index ? "bg-brand-50" : "bg-transparent"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  it.kind === "workflow" ? "bg-brand-500" : it.kind === "nav" ? "bg-slate-300" : "bg-emerald-400"
                }`}
              />
              <span className="flex-1 truncate text-slate-800">{it.label}</span>
              {it.sub && <span className="text-xs text-slate-400">{it.sub}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑↓</kbd> 选择</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> 确认</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}
