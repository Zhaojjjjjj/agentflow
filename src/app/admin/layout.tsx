"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import { useMe } from "@/components/UserMenu";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const GROUPS: { caption: string; items: MenuItem[] }[] = [
  {
    caption: "概览",
    items: [
      {
        href: "/admin",
        label: "数据总览",
        icon: (
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
            <path d="M2 13.5V8M8 13.5V2M14 13.5V5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    caption: "管理",
    items: [
      {
        href: "/admin/users",
        label: "用户管理",
        icon: (
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2.5 13.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/admin/images",
        label: "生图模板",
        icon: (
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5.5" cy="6.5" r="1.3" fill="currentColor" />
            <path d="M2 12.5 6 9l2.5 2L11 8.5l3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
  {
    caption: "系统",
    items: [
      {
        href: "/admin/llm",
        label: "LLM 配置",
        icon: (
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5 9.8 5.6 14.2 6.3 11 9.5 11.8 13.9 8 11.7 4.2 13.9 5 9.5 1.8 6.3 6.2 5.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

function NavItem({ m, pathname }: { m: MenuItem; pathname: string }) {
  const active = pathname === m.href;
  return (
    <Link
      href={m.href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
        active
          ? "bg-[#7C3AED]/[0.08] font-medium text-[#6D28D9]"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span className={active ? "text-[#7C3AED]" : "text-slate-400"}>{m.icon}</span>
      {m.label}
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const current = ALL_ITEMS.find((m) => m.href === pathname);

  return (
    <div className="flex min-h-screen bg-[#F7F7F8] text-slate-900">
      {/* 侧边栏（桌面） */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white md:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <Logo size={22} />
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-5 tracking-tight">AgentFlow</p>
            <p className="text-xs leading-4 text-slate-400">管理后台</p>
          </div>
          <span className="ml-auto rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[11px] font-medium text-[#7C3AED]">Admin</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {GROUPS.map((g, gi) => (
            <div key={g.caption} className={gi > 0 ? "mt-6" : "mt-2"}>
              <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">{g.caption}</p>
              <div className="space-y-0.5">
                {g.items.map((m) => (
                  <NavItem key={m.href} m={m} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          {me ? (
            <div className="mb-3 flex items-center gap-2.5 px-1">
              {me.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatar_url} alt={me.username} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED]/10 text-[13px] font-semibold text-[#7C3AED]">
                  {(me.nickname || me.username).slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium leading-4 text-slate-800">{me.nickname || me.username}</p>
                <p className="text-[11px] leading-4 text-slate-400">{me.role === "admin" ? "管理员" : "用户"}</p>
              </div>
            </div>
          ) : null}
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            返回前台
          </Link>
        </div>
      </aside>

      {/* 主区 */}
      <div className="min-w-0 flex-1">
        {/* 顶栏：面包屑（桌面） */}
        <div className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-slate-200/70 bg-[#F7F7F8]/85 px-8 backdrop-blur-md md:flex">
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <span>管理后台</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-800">{current?.label ?? ""}</span>
          </p>
          <Link href="/" className="text-[13px] font-medium text-slate-500 transition-colors hover:text-[#7C3AED]">
            打开前台 →
          </Link>
        </div>
        {/* 移动端顶栏 */}
        <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <Logo size={20} />
            <span className="text-sm font-semibold">管理后台</span>
            <Link href="/" className="ml-auto text-[13px] font-medium text-slate-500">
              返回前台
            </Link>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2.5">
            {ALL_ITEMS.map((m) => {
              const active = pathname === m.href;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                    active ? "bg-[#7C3AED]/10 font-medium text-[#6D28D9]" : "text-slate-500"
                  }`}
                >
                  {m.label}
                </Link>
              );
            })}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
