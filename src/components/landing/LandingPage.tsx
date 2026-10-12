import Link from "next/link";
import { Inter } from "next/font/google";
import { NODE_META, type NodeType } from "@/lib/engine/types";
import HeroCanvas from "./HeroCanvas";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const GITHUB_URL = "https://github.com/Zhaojjjjjj/agentflow";

const FEATURES = [
  {
    title: "可视化编排",
    desc: "拖拽画布编排 DAG：条件分支、循环、子流程一次画清，复杂逻辑一目了然。",
  },
  {
    title: "9 种节点，开箱即用",
    desc: "LLM、HTTP 工具、RAG 检索、人工审批……覆盖 Agent 应用的核心原语。",
  },
  {
    title: "可靠执行",
    desc: "Inngest durable execution：自动重试、定时触发、人工暂停/恢复，失败不丢步。",
  },
  {
    title: "全链路可观测",
    desc: "每节点 trace 时间线、耗时、token 与成本统计，线上问题可回放定位。",
  },
  {
    title: "发布为 API",
    desc: "工作流一键发布为 HTTP 接口，API Key 鉴权，同步/异步双模式调用。",
  },
  {
    title: "RAG 知识库",
    desc: "文档向量化入库，pgvector 相似检索即插即用，打造专属知识 Agent。",
  },
];

const NODE_ORDER: NodeType[] = [
  "trigger-manual",
  "trigger-schedule",
  "llm",
  "rag-retrieve",
  "http-request",
  "condition",
  "loop",
  "human-approval",
  "output",
];

function Arrow() {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" fill="none" aria-hidden className="shrink-0 text-slate-300">
      <path d="M0 6h25M21 1.5 26.5 6 21 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArchBox({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={`${inter.className} bg-white text-slate-900 antialiased`}>
      {/* ---------- nav ---------- */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7C3AED]" />
            <span className="text-[15px] font-semibold tracking-tight text-white">agentflow</span>
          </span>
          <nav className="ml-10 hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#features" className="transition-colors duration-150 hover:text-white">特性</a>
            <a href="#nodes" className="transition-colors duration-150 hover:text-white">节点</a>
            <a href="#arch" className="transition-colors duration-150 hover:text-white">架构</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-slate-400 transition-colors duration-150 hover:text-white"
            >
              GitHub
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#6D28D9]"
            >
              进入控制台
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden bg-[#0A0A0F]">
        <HeroCanvas />
        {/* readability vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(900px 420px at 50% 42%, rgba(10,10,15,0) 30%, rgba(10,10,15,0.55) 100%)" }}
        />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs tracking-wide text-slate-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6]" />
            开源 · 可视化 Agent 工作流编排
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.12] tracking-tight text-white md:text-6xl">
            把 AI Agent 变成
            <br />
            可编排的工作流
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
            拖拽节点编排工具调用与 RAG，Inngest 保证每一步可靠执行。
            从原型到生产，一个平台搞定。
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-[#7C3AED] px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#6D28D9]"
            >
              进入控制台
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur transition-colors duration-150 hover:bg-white/10"
            >
              GitHub 仓库
            </a>
          </div>
        </div>
        {/* fade into white content */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />
      </section>

      {/* ---------- features ---------- */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">特性</p>
        <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight">
          为生产级 Agent 应用而设计
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
            >
              <h3 className="text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- node catalog ---------- */}
      <section id="nodes" className="border-y border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">节点目录</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight">
            9 种节点，拼出任意 Agent 流程
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NODE_ORDER.map((t) => {
              const meta = NODE_META[t];
              return (
                <div key={t} className="flex gap-3.5 rounded-2xl border border-slate-200 bg-white p-5">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {meta.label}
                      <span className="ml-2 text-xs font-normal text-slate-400">{meta.category}</span>
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-500">{meta.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- architecture ---------- */}
      <section id="arch" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">架构</p>
        <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight">
          全免费 Serverless 栈，一键部署
        </h2>
        <div className="mt-12 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <ArchBox title="可视化画布" desc="Next.js 全栈控制台，React Flow 画布 + SSE 实时进度" />
          <div className="flex justify-center md:block"><Arrow /></div>
          <ArchBox title="执行引擎" desc="Inngest durable functions：重试、定时、人工审批暂停" />
          <div className="flex justify-center md:block"><Arrow /></div>
          <ArchBox title="数据层" desc="Supabase Postgres + pgvector，工作流 / 运行 / 向量检索" />
          <div className="flex justify-center md:block"><Arrow /></div>
          <ArchBox title="模型层" desc="OpenAI 兼容协议，多 Provider 自动降级" />
        </div>
        <p className="mt-8 text-sm leading-6 text-slate-500">
          部署在 Vercel，数据库、缓存、执行器全部使用免费额度——个人项目零成本上线。
        </p>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl bg-[#0A0A0F] px-8 py-16 text-center md:py-20">
          <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight text-white">
            开始编排你的第一个 Agent 工作流
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400">
            登录控制台，拖入第一个节点，几分钟跑通一次真实执行。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-[#7C3AED] px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#6D28D9]"
            >
              进入控制台
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/5"
            >
              查看源码
            </a>
          </div>
        </div>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-slate-400 md:flex-row">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
            agentflow · 可视化 AI Agent 工作流编排平台
          </span>
          <span>Next.js · Inngest · Supabase · MIT</span>
        </div>
      </footer>
    </div>
  );
}
