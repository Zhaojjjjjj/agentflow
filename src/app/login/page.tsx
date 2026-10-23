"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Field, Input } from "@/components/ui";
import LoginPanel from "@/components/login/LoginPanel";

/** Only allow same-origin relative redirects (prevents open-redirect). */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshCaptcha = async () => {
    setCaptcha("");
    try {
      const res = await fetch("/api/auth/captcha");
      const j = await res.json();
      if (j.svg) setCaptchaSvg(j.svg);
    } catch {
      /* 忽略，提交时后端会校验 */
    }
  };

  useEffect(() => {
    void refreshCaptcha();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captcha }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.href = next;
      } else {
        setError(j.error || "登录失败");
        setShakeKey((k) => k + 1);
        void refreshCaptcha();
      }
    } catch {
      setError("网络错误，请重试");
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      {/* 左：视觉面板（桌面 55%） */}
      <div className="hidden w-[55%] shrink-0 md:block">
        <LoginPanel />
      </div>
      {/* 移动端顶部（浅色） */}
      <div className="border-b border-slate-100 px-6 pb-5 pt-8 md:hidden">
        <div className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true">
            <g fill="none" stroke="#7C3AED" strokeWidth="11">
              <path d="M 84.6 67.5 A 40 40 0 1 1 84.6 32.5" strokeLinecap="round" />
            </g>
            <circle cx="88" cy="50" r="8" fill="#7C3AED" />
            <circle cx="50" cy="50" r="9" fill="#7C3AED" />
          </svg>
          <span className="text-xl font-semibold tracking-tight text-slate-900">AgentFlow</span>
          <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C3AED] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
            </span>
            连载进行时
          </span>
        </div>
        <p className="mt-2.5 text-sm leading-6 text-slate-500">小说与网剧剧本的连载工作室，一集一集写下去。</p>
      </div>

      {/* 右：表单区 */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
            Console
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            登录控制台
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            管理连载作品、人物与伏笔，以及 LLM 供应商配置。
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="用户名">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoFocus
                autoComplete="username"
              />
            </Field>
            <Field label="密码">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </Field>
            <Field label="验证码">
              <div className="flex gap-2.5">
                <Input
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  placeholder="请输入验证码"
                  autoComplete="off"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => void refreshCaptcha()}
                  title="换一张"
                  className="h-[42px] w-[120px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                >
                  {captchaSvg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={captchaSvg} alt="验证码" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">加载中…</span>
                  )}
                </button>
              </div>
            </Field>
            {error && (
              <p
                key={shakeKey}
                className="animate-shake rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full !py-2.5"
              disabled={loading || !username || !password || !captcha}
            >
              {loading ? "登录中…" : "登录"}
            </Button>
          </form>

          <p className="mt-8 text-center font-mono text-[11px] text-slate-400">
            AgentFlow · MIT
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
