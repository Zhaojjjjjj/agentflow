"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const MENUS = [
  {
    href: "/admin",
    label: "数据总览",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 13.5V8M8 13.5V2M14 13.5V5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "用户管理",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 13.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/llm",
    label: "LLM 配置",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5 9.8 5.6 14.2 6.3 11 9.5 11.8 13.9 8 11.7 4.2 13.9 5 9.5 1.8 6.3 6.2 5.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/workflows",
    label: "工作流管理",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 4.5h4.5V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-slate-50/60">
      {/* 侧边栏（桌面） */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <Logo size={30} />
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-slate-900">AgentFlow</p>
            <p className="text-[11px] text-slate-400">管理后台</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {MENUS.map((m) => {
            const active = pathname === m.href;
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition-colors duration-150 ${
                  active
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {m.icon}
                {m.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            回控制台
          </Link>
        </div>
      </aside>

      {/* 主区 */}
      <div className="min-w-0 flex-1">
        {/* 移动端顶栏 */}
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200/70 bg-white/90 px-4 py-2.5 backdrop-blur-md md:hidden">
          <Link href="/" className="mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="回控制台">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {MENUS.map((m) => {
            const active = pathname === m.href;
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-500"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
