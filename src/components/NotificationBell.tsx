"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface NoticeItem {
  jobId: string;
  status: string;
  at: string;
  projectId: string;
  projectTitle: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
}

const SEEN_KEY = "agentflow:notice-seen";

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/studio/notifications").catch(() => null);
    if (res && res.ok) {
      const j = await res.json();
      setItems(j.items ?? []);
    }
  }, []);

  useEffect(() => {
    setSeen(loadSeen());
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open ]);

  const unread = items.filter((i) => !seen.has(i.jobId));
  const markAllSeen = () => {
    const next = new Set(seen);
    for (const i of items) next.add(i.jobId);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-100)));
    } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllSeen();
        }}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        title="写作动态"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 20a2 2 0 0 1-3.4 0" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-medium text-white">
            {unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">最近 24 小时写作动态</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">暂无完成的任务</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((i) => (
                <li key={i.jobId}>
                  <Link
                    href={`/studio/${i.projectId}/episodes/${i.episodeId}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-slate-50"
                  >
                    <p className="text-sm text-slate-800">
                      <span className={i.status === "succeeded" ? "text-green-600" : "text-red-500"}>
                        {i.status === "succeeded" ? "✓ 写完" : "✗ 失败"}
                      </span>
                      <span className="ml-1.5">《{i.projectTitle}》第 {i.episodeNumber} 集{i.episodeTitle ? ` ${i.episodeTitle}` : ""}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{new Date(i.at).toLocaleString("zh-CN")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
