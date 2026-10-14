"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface MeUser {
  id: string;
  username: string;
  role: "admin" | "user";
  avatar_url: string | null;
}

export function useMe(): MeUser | null | undefined {
  const [me, setMe] = useState<MeUser | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user ?? null))
      .catch(() => setMe(null));
  }, []);
  return me;
}

function Avatar({ user, size = 32 }: { user: MeUser; size?: number }) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={user.username}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-brand-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {user.username.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function UserMenu({ user }: { user: MeUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // 回到落地页（未登录态的 / 就是落地页）
      window.location.href = "/";
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:border-slate-300"
        title={user.username}
      >
        <Avatar user={user} size={26} />
        <span className="max-w-24 truncate text-[13px] font-medium text-slate-700">{user.username}</span>
        {user.role === "admin" && (
          <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
            管理员
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-200/60">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user.username}</p>
              <p className="text-xs text-slate-400">{user.role === "admin" ? "管理员" : "普通用户"}</p>
            </div>
          </div>
          <div className="my-1.5 border-t border-slate-100" />
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            个人设置
          </Link>
          {user.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              管理后台
            </Link>
          )}
          <div className="my-1.5 border-t border-slate-100" />
          <button
            onClick={logout}
            className="block w-full px-4 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
