import Link from "next/link";
import { Inter, Instrument_Serif } from "next/font/google";
import WorkflowDemo from "./WorkflowDemo";
import DagFlowMini from "./DagFlowMini";
import Reveal from "./Reveal";
import CopyButton from "./CopyButton";

const inter = Inter({ subsets: ["latin"], display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const GITHUB_URL = "https://github.com/Zhaojjjjjj/agentflow";

/* ---------- 小构件 ---------- */

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">{children}</p>
  );
}

function SectionHead({
  micro,
  title,
  desc,
}: {
  micro: string;
  title: React.ReactNode;
  desc?: string;
}) {
  return (
    <Reveal>
      <MicroLabel>{micro}</MicroLabel>
      <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h2>
      {desc && <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-500">{desc}</p>}
    </Reveal>
  );
}

/* 特性卡内的迷你示意图（纯 SVG 线条，非图标堆砌）
   可视化编排卡用 DagFlowMini：节点依次点亮的流动画 */

function RetryMini() {
  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      <rect x={8} y={24} width={184} height={24} rx={8} fill="rgba(15,23,42,0.05)" stroke="rgba(15,23,42,0.10)" />
      <rect x={8} y={24} width={120} height={24} rx={8} fill="rgba(124,58,237,0.22)" />
      <path d="M150 36 h18 m-6 -6 6 6 -6 6" fill="none" stroke="#7C3AED" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
      </path>
      <text x={16} y={40} fill="rgba(15,23,42,0.55)" fontSize={10} fontFamily="ui-monospace,monospace">attempt 2/3 · retrying</text>
    </svg>
  );
}

function TraceMini() {
  const bars = [62, 38, 84, 52, 70, 44];
  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      {bars.map((w, i) => (
        <g key={i}>
          <rect x={8} y={8 + i * 10} width={w} height={6} rx={3} fill={i === 2 ? "rgba(124,58,237,0.75)" : "rgba(15,23,42,0.10)"} />
          <circle cx={4} cy={11 + i * 10} r={1.6} fill={i === 2 ? "#7C3AED" : "rgba(15,23,42,0.22)"} />
        </g>
      ))}
    </svg>
  );
}

function VectorMini() {
  const pts: [number, number][] = [
    [30, 20], [60, 44], [95, 18], [125, 40], [160, 24], [45, 55], [110, 58], [145, 58],
  ];
  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 2 ? 4 : 2.4} fill={i === 2 ? "#7C3AED" : "rgba(15,23,42,0.20)"} />
      ))}
      <circle cx={95} cy={18} r={10} fill="none" stroke="rgba(124,58,237,0.5)" strokeDasharray="3 3" />
      <text x={112} y={16} fill="rgba(15,23,42,0.45)" fontSize={9} fontFamily="ui-monospace,monospace">top-k</text>
    </svg>
  );
}

function ApprovalMini() {
  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      <rect x={8} y={20} width={184} height={32} rx={8} fill="rgba(15,23,42,0.03)" stroke="rgba(15,23,42,0.12)" />
      <circle cx={26} cy={36} r={5} fill="none" stroke="#7C3AED" strokeWidth={1.6} />
      <path d="M24 36 h4 M26 34 v4" stroke="#7C3AED" strokeWidth={1.6} strokeLinecap="round" />
      <text x={40} y={40} fill="rgba(15,23,42,0.55)" fontSize={10} fontFamily="ui-monospace,monospace">waiting for human…</text>
      <rect x={150} y={27} width={34} height={18} rx={5} fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.55)" />
      <text x={157} y={40} fill="#7C3AED" fontSize={9}>批准</text>
    </svg>
  );
}

const BENTO: {
  title: string;
  desc: string;
  large?: boolean;
  art: React.ReactNode;
}[] = [
  {
    title: "可视化编排",
    desc: "拖拽画布编排 DAG：条件分支、循环、子流程一次画清，复杂 Agent 逻辑一目了然。",
    large: true,
    art: <DagFlowMini />,
  },
  {
    title: "可靠执行",
    desc: "durable execution：失败自动重试，步骤不丢失、不重复。",
    art: <RetryMini />,
  },
  {
    title: "全链路可观测",
    desc: "每节点的 trace 时间线、耗时、token 与成本，线上问题可回放定位。",
    art: <TraceMini />,
  },
  {
    title: "RAG 知识库",
    desc: "文档向量化入库，pgvector 相似检索即插即用。",
    art: <VectorMini />,
  },
  {
    title: "人工审批",
    desc: "关键节点暂停等人确认，Human-in-the-loop 原生支持。",
    art: <ApprovalMini />,
  },
];

const CURL = `curl -X POST https://your-app.vercel.app/api/public/workflows/$WORKFLOW_ID/run \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input": {"topic": "新品发布"}}'`;

const CURL_RESP = `{
  "runId": "9f3a…c21d",
  "mode": "async",
  "status": "running"
}`;

/* ---------- 主组件 ---------- */

export default function LandingPage() {
  return (
    <div className={`${inter.className} bg-white text-slate-900 antialiased`}>
      {/* ---------- nav ---------- */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7C3AED]" />
            <span className="text-[15px] font-semibold tracking-tight">AgentFlow</span>
          </span>
          <nav className="ml-10 hidden items-center gap-7 text-sm text-slate-500 md:flex">
            <a href="#features" className="transition-colors hover:text-slate-900">特性</a>
            <a href="#api" className="transition-colors hover:text-slate-900">API</a>
            <a href="#nodes" className="transition-colors hover:text-slate-900">节点</a>
            <a href="#arch" className="transition-colors hover:text-slate-900">架构</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-slate-900"
            >
              GitHub
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6D28D9]"
            >
              进入控制台
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{ background: "radial-gradient(720px 320px at 50% -40px, rgba(124,58,237,0.10), transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <Reveal>
              <MicroLabel>Open source · Agent workflow orchestration</MicroLabel>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.06] tracking-tight text-slate-900 md:text-7xl">
                把 AI Agent
                <br />
                变成<span className={`${serif.className} italic text-[#7C3AED]`}>可编排</span>的工作流
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-md text-[15px] leading-7 text-slate-500 md:text-base">
                拖拽节点编排 LLM、工具调用与 RAG 知识库，durable
                执行引擎保证每一步可靠运行。从原型到生产，一个平台搞定。
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="rounded-xl bg-[#7C3AED] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6D28D9]"
                >
                  进入控制台
                </Link>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-mono text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  $ git clone agentflow
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <dl className="mt-12 flex gap-10 border-t border-slate-200 pt-6">
                {[
                  ["9", "节点类型"],
                  ["DAG", "拓扑执行"],
                  ["API", "一键发布"],
                ].map(([v, k]) => (
                  <div key={k}>
                    <dt className="font-mono text-lg font-semibold text-slate-900">{v}</dt>
                    <dd className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">{k}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="min-w-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Live demo
                </p>
                <div className="flex gap-1.5">
                  {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                    <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  ))}
                </div>
              </div>
              <WorkflowDemo />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- bento features ---------- */}
      <section id="features" className="border-t border-slate-200/70 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            micro="Features"
            title={
              <>
                为生产级 Agent 应用<span className={`${serif.className} italic text-[#7C3AED]`}>而设计</span>
              </>
            }
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {BENTO.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06} className={f.large ? "md:col-span-2" : ""}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7C3AED]/40 hover:shadow-lg hover:shadow-[#7C3AED]/10">
                  <h3 className="text-[15px] font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{f.desc}</p>
                  {f.art}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- API ---------- */}
      <section id="api" className="border-t border-slate-200/70">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <SectionHead
            micro="Publish as API"
            title={
              <>
                工作流<span className={`${serif.className} italic text-[#7C3AED]`}>即</span> API
              </>
            }
            desc="发布开关一开，工作流就是 HTTP 接口。API Key 鉴权，同步 / 异步双模式，定时触发开箱即用。"
          />
          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
                <div className="flex gap-1.5">
                  {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                    <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <CopyButton text={CURL} />
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-slate-700">
                <code>{CURL}</code>
              </pre>
              <div className="border-t border-slate-200 bg-white px-5 py-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">Response</p>
                <pre className="font-mono text-[12.5px] leading-6 text-slate-500">
                  <code>{CURL_RESP}</code>
                </pre>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- studio features ---------- */}
      <section id="studio" className="overflow-hidden border-t border-slate-200/70 bg-slate-50/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHead
            micro="Serial studio"
            title={
              <>
                为<span className={`${serif.className} italic text-[#7C3AED]`}>连载</span>而生的创作工作室
              </>
            }
            desc="小说与网剧剧本，一集一集往下写。每一集都完整，每一集都记得之前发生过什么。"
          />
        </div>
        <Reveal className="mt-12">
          <div
            className="marquee relative"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            }}
          >
            <div className="marquee-track flex w-max gap-4 pr-4">
              {[
                ["大纲先行", "Outline", "全书 → 分卷 → 单集三级大纲，单集完整有起承转合"],
                ["前情记忆", "Memory", "每集自动生成剧情摘要，写新集时自动召回相关前情"],
                ["人物卡", "Characters", "人物小传、性格、关系、当前状态，AI 持续维护"],
                ["伏笔追踪", "Plot threads", "埋了哪些伏笔、在哪集回收，一目了然"],
                ["人工审稿", "Review", "大纲和正文都可审可改，确认后再往下写"],
                ["双形态", "Novel & Drama", "长篇小说与网剧剧本，一套工作流两种输出"],
              ].flatMap((c) => [c, c]).map(([title, micro, desc], i) => (
                <div
                  key={`${title}-${i}`}
                  className="flex w-64 shrink-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#7C3AED]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{title}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      {micro}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- architecture ---------- */}
      <section id="arch" className="border-t border-slate-200/70">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            micro="Architecture"
            title={
              <>
                Serverless 架构，<span className={`${serif.className} italic text-[#7C3AED]`}>一键</span>部署
              </>
            }
            desc="Next.js 全栈控制台部署在 Vercel，数据层、执行器与模型层解耦，各司其职。"
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-4">
            {[
              ["01 / Console", "可视化画布", "Next.js 全栈 · React Flow 画布 · SSE 实时进度"],
              ["02 / Engine", "执行引擎", "Inngest durable functions：重试、定时、人工审批暂停"],
              ["03 / Data", "数据层", "Supabase Postgres + pgvector：工作流、运行记录、向量检索"],
              ["04 / Models", "模型层", "OpenAI 兼容协议，多 Provider 按序自动降级"],
            ].map(([no, title, desc], i) => (
              <Reveal key={no} delay={i * 0.06} className="h-full">
                <div className="flex h-full flex-col bg-white p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7C3AED]">{no}</p>
                  <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-slate-500">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="border-t border-slate-200/70 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-6 py-28 text-center">
          <Reveal>
            <MicroLabel>Get started</MicroLabel>
            <h2 className="mx-auto mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              开始编排你的第一个
              <br />
              Agent <span className={`${serif.className} italic text-[#7C3AED]`}>工作流</span>
            </h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-[#7C3AED] px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6D28D9]"
              >
                进入控制台
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-200 bg-white px-7 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                查看源码
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-slate-200/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <span className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
            AgentFlow · 可视化 AI Agent 工作流编排平台
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300">
            MIT · Next.js · Inngest · Supabase
          </span>
        </div>
      </footer>
    </div>
  );
}
