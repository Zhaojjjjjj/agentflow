"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";

/** Only allow same-origin relative redirects (prevents open-redirect). */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

/** 左侧深色视觉面板：CSS aurora + 隐约工作流 SVG 线条 + wordmark */
function VisualPanel() {
  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-[#0A0A0F] md:block">
      {/* aurora blobs */}
      <div aria-hidden className="absolute inset-0">
        <div
          className="absolute -left-24 top-[8%] h-[420px] w-[420px] rounded-full blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(124,58,237,0.42), transparent 65%)",
            animation: "aurora-a 14s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[4%] right-[-80px] h-[380px] w-[380px] rounded-full blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.30), transparent 65%)",
            animation: "aurora-b 18s ease-in-out infinite",
          }}
        />
        <div
          className="absolute left-[38%] top-[52%] h-[300px] w-[300px] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(76,29,149,0.5), transparent 65%)" }}
        />
      </div>

      {/* subtle workflow line-work */}
      <svg aria-hidden viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-[0.35]">
        <g fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={1.2}>
          <path d="M-20 620 C 120 620, 140 480, 280 480 S 440 340, 620 340" />
          <path d="M-20 700 C 140 700, 180 560, 320 560 S 480 420, 620 420" />
          <path d="M-20 540 C 100 540, 160 400, 300 400" strokeDasharray="5 7" />
        </g>
        <g>
          {[
            [150, 585],
            [300, 480],
            [450, 392],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={16} fill="rgba(124,58,237,0.12)" stroke="rgba(139,92,246,0.45)" />
              <circle cx={x} cy={y} r={3.5} fill="#A78BFA" />
            </g>
          ))}
        </g>
        <circle r={3} fill="#C4B5FD" opacity={0.9}>
          <animateMotion dur="9s" repeatCount="indefinite" path="M-20 620 C 120 620, 140 480, 280 480 S 440 340, 620 340" />
        </circle>
      </svg>

      {/* content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
          Open source
        </p>
        <div>
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full bg-[#7C3AED]" />
            <span className="text-4xl font-semibold tracking-tight text-white">agentflow</span>
          </div>
          <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/55">
            可视化编排 AI Agent 工作流——从拖拽节点，到可靠执行，到一键发布为 API。
          </p>
          <dl className="mt-10 flex gap-10">
            {[
              ["9", "节点类型"],
              ["DAG", "拓扑执行"],
              ["API", "一键发布"],
            ].map(([v, k]) => (
              <div key={k}>
                <dt className="font-mono text-base font-semibold text-white">{v}</dt>
                <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="font-mono text-[11px] text-white/30">durable execution · observable · human-in-the-loop</p>
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
            <span className="text-2xl font-semibold tracking-tight text-white">agentflow</span>
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
            管理工作流、运行记录与 LLM 供应商配置。
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
            agentflow · MIT
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
