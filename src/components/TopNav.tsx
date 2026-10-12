"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const NAV = [
  { href: "/", label: "工作流" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/settings", label: "LLM 设置" },
];

export default function TopNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">agentflow</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
                  active
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
