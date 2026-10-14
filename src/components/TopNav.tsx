"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu, { useMe } from "./UserMenu";
import CommandPalette from "./CommandPalette";
import Logo from "./Logo";

export default function TopNav() {
  const pathname = usePathname();
  const me = useMe();
  const openPalette = () => window.dispatchEvent(new Event("agentflow:open-palette"));

  const NAV = [
    { href: "/", label: "工作流" },
    { href: "/chat", label: "AI 助手" },
    { href: "/api-keys", label: "API Keys" },
    ...(me?.role === "admin" ? [{ href: "/admin", label: "管理后台" }] : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-stretch gap-6 px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Logo size={26} />
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">AgentFlow</span>
          </Link>
          <nav className="flex items-stretch gap-1">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`relative flex items-center px-3 text-sm transition-colors duration-150 ${
                    active ? "font-medium text-brand-700" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {n.label}
                  {active && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={openPalette}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1.5 text-xs text-slate-400 transition-colors duration-150 hover:border-slate-300 hover:text-slate-600 sm:flex"
              title="打开命令面板"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m11 11 3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>搜索…</span>
              <kbd className="kbd">⌘K</kbd>
            </button>
            {me ? (
              <UserMenu user={me} />
            ) : (
              me === null && (
                <Link href="/login" className="btn-secondary">
                  登录
                </Link>
              )
            )}
          </div>
        </div>
      </header>
      <CommandPalette />
    </>
  );
}
