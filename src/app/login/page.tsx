"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";

/** Only allow same-origin relative redirects (prevents open-redirect). */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

/** 左侧视觉面板：浅色连载主题——集数时间线 + wordmark */
function VisualPanel() {
  return (
    <div className="relative hidden h-full w-full overflow-hidden border-r border-slate-200/70 bg-white md:block">
      {/* 顶部淡紫光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: "radial-gradient(560px 280px at 50% -40px, rgba(124,58,237,0.10), transparent 70%)" }}
      />

      {/* 集数时间线 */}
      <svg aria-hidden viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-100">
        <g>
          <line x1={90} y1={120} x2={90} y2={680} stroke="rgba(124,58,237,0.18)" strokeWidth={2} />
          {(
            [
              [90, 170, true],
              [90, 300, true],
              [90, 430, true],
              [90, 560, false],
            ] as [number, number, boolean][]
          ).map(([x, y, done], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={done ? 9 : 11} fill={done ? "#7C3AED" : "#fff"} stroke="#7C3AED" strokeWidth={2} strokeDasharray={done ? "none" : "4 3"} />
              {done && <path d={`M ${x - 4} ${y} l 3 3 l 6 -6`} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </g>
          ))}
        </g>
        <g fontFamily="ui-monospace, monospace" fontSize={13} fill="rgba(15,23,42,0.45)">
          <text x={120} y={175}>第 10 集 · 已发布</text>
          <text x={120} y={305}>第 11 集 · 已发布</text>
          <text x={120} y={435}>第 12 集 · 已发布</text>
          <text x={120} y={565} fill="#7C3AED" fontWeight={600}>第 13 集 · 撰写中</text>
        </g>
        <g opacity={0.5}>
          <rect x={120} y={190} width={180} height={6} rx={3} fill="rgba(15,23,42,0.08)" />
          <rect x={120} y={320} width={140} height={6} rx={3} fill="rgba(15,23,42,0.08)" />
          <rect x={120} y={450} width={160} height={6} rx={3} fill="rgba(15,23,42,0.08)" />
          <rect x={120} y={580} width={120} height={6} rx={3} fill="rgba(124,58,237,0.25)" />
        </g>
      </svg>

      {/* content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
          AI Serial Studio
        </p>
        <div>
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full bg-[#7C3AED]" />
            <span className="text-4xl font-semibold tracking-tight text-slate-900">AgentFlow</span>
          </div>
          <p className="mt-5 max-w-sm text-[15px] leading-7 text-slate-500">
            小说与网剧剧本的连载工作室——定下世界观，AI 帮你一集一集写下去。
          </p>
          <dl className="mt-10 flex gap-10">
            {[
              ["双形态", "小说 · 网剧剧本"],
              ["记忆", "前情自动召回"],
              ["审稿", "人工确认再续写"],
            ].map(([v, k]) => (
              <div key={k}>
                <dt className="font-mono text-base font-semibold text-slate-900">{v}</dt>
                <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="font-mono text-[11px] text-slate-300">大纲先行 · 前情记忆 · 人工审稿</p>
      </div>
    </div>
  );
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
    <div className="flex min-h-screen bg-white">
      {/* 左：视觉面板（桌面 55%）/ 顶部横幅（移动） */}
      <div className="hidden w-[55%] md:block">
        <VisualPanel />
      </div>
      <div className="relative h-44 overflow-hidden bg-[#0A0A0F] md:hidden">
        <div
          aria-hidden
          className="absolute -left-16 top-[-60px] h-64 w-64 rounded-full blur-[90px]"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.5), transparent 65%)" }}
        />
        <div className="relative z-10 flex h-full items-center px-6">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full bg-[#7C3AED]" />
            <span className="text-2xl font-semibold tracking-tight text-white">AgentFlow</span>
          </div>
        </div>
      </div>

      {/* 右：表单区 */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
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
        </div>
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
