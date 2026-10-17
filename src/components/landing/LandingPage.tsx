import Link from "next/link";
import { Inter, Instrument_Serif } from "next/font/google";
import Reveal from "./Reveal";

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

/* 特性卡内的迷你示意图（纯 CSS/SVG 线条，非图标堆砌） */

function MemoryFlowMini() {
  return (
    <div className="mt-6 flex items-center gap-2" aria-hidden>
      {["第 10 集", "第 11 集", "第 12 集"].map((t) => (
        <div key={t} className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
          <p className="font-mono text-[9px] text-slate-400">{t}</p>
          <div className="mt-1.5 space-y-1">
            <div className="h-1 rounded bg-slate-200" />
            <div className="h-1 w-4/5 rounded bg-slate-200" />
          </div>
        </div>
      ))}
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0">
        <path d="M1 6h16m-5-5 5 5-5 5" stroke="#7C3AED" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex-1 rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/5 px-2 py-2">
        <p className="font-mono text-[9px] font-medium text-[#7C3AED]">第 13 集</p>
        <div className="mt-1.5 space-y-1">
          <div className="h-1 rounded bg-[#7C3AED]/30" />
          <div className="h-1 w-3/5 rounded bg-[#7C3AED]/30" />
        </div>
      </div>
    </div>
  );
}

function OutlineMini() {
  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      <rect x={8} y={8} width={184} height={18} rx={6} fill="rgba(124,58,237,0.10)" stroke="rgba(124,58,237,0.35)" />
      <text x={16} y={21} fill="rgba(124,58,237,0.8)" fontSize={9}>全书大纲</text>
      <rect x={20} y={32} width={160} height={16} rx={6} fill="rgba(124,58,237,0.07)" stroke="rgba(124,58,237,0.25)" />
      <text x={28} y={44} fill="rgba(124,58,237,0.65)" fontSize={9}>分卷大纲</text>
      <rect x={32} y={54} width={136} height={14} rx={6} fill="#7C3AED" />
      <text x={40} y={64} fill="#fff" fontSize={9}>单集大纲 ✓</text>
    </svg>
  );
}

function CharacterMini() {
  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      <circle cx={30} cy={36} r={16} fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.5)" />
      <circle cx={30} cy={31} r={6} fill="rgba(124,58,237,0.35)" />
      <path d="M18 50c2-8 8-12 12-12s10 4 12 12" fill="rgba(124,58,237,0.25)" />
      <rect x={56} y={20} width={120} height={7} rx={3.5} fill="rgba(15,23,42,0.10)" />
      <rect x={56} y={33} width={88} height={7} rx={3.5} fill="rgba(15,23,42,0.07)" />
      <rect x={56} y={46} width={104} height={7} rx={3.5} fill="rgba(124,58,237,0.18)" />
    </svg>
  );
}

function ThreadMini() {
  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      <path d="M8 36 H192" stroke="rgba(15,23,42,0.15)" strokeWidth={2} strokeDasharray="4 4" />
      <circle cx={40} cy={36} r={5} fill="#7C3AED" />
      <circle cx={100} cy={36} r={5} fill="#7C3AED" />
      <circle cx={160} cy={36} r={5} fill="none" stroke="#7C3AED" strokeWidth={2} strokeDasharray="2 2" />
      <text x={30} y={56} fill="rgba(15,23,42,0.45)" fontSize={9}>第 3 集埋下</text>
      <text x={88} y={56} fill="rgba(15,23,42,0.45)" fontSize={9}>第 9 集呼应</text>
      <text x={146} y={56} fill="#7C3AED" fontSize={9}>待回收</text>
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
    title: "前情记忆",
    desc: "写第 N 集时，自动召回相关的前情摘要、人物当前状态和未回收的伏笔——再长的连载也不会走形、不会忘。",
    large: true,
    art: <MemoryFlowMini />,
  },
  {
    title: "大纲先行",
    desc: "全书 → 分卷 → 单集三级大纲，每一集都有完整的起承转合。",
    art: <OutlineMini />,
  },
  {
    title: "人物卡",
    desc: "人物小传、性格、关系、当前状态，AI 随剧情持续维护。",
    art: <CharacterMini />,
  },
  {
    title: "伏笔追踪",
    desc: "埋了哪些钩子、在哪集回收，一目了然，不再烂尾。",
    art: <ThreadMini />,
  },
  {
    title: "人工审稿",
    desc: "大纲和正文都可审可改，你点头之后才往下写。",
    art: <ApprovalMini />,
  },
];

/* Hero 视觉：连载中的作品面板 mock */
function SerialDemo() {
  return (
    <div aria-hidden>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold text-slate-900">《雾港夜行》</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            长篇小说 · 悬疑
          </p>
        </div>
        <span className="rounded-full bg-[#7C3AED]/10 px-2.5 py-1 text-[11px] font-medium text-[#7C3AED]">
          连载中
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">前情提要</p>
        <p className="mt-1.5 text-[13px] leading-6 text-slate-600">
          沈夜在雨夜酒吧发现怀表里的照片，与三年前的雾港大火有关……
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/[0.03] p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7C3AED]">
            第 13 集 · 大纲已确认
          </p>
          <span className="text-[11px] text-slate-400">✓ 已审稿</span>
        </div>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-slate-600">
          <li>· 沈夜跟踪神秘客人到旧码头</li>
          <li>· 怀表的秘密被提起，冲突升级</li>
          <li>· 结尾悬念：电话里的声音是谁</li>
        </ul>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-500">正在扩写正文…</span>
          <span className="font-mono text-slate-400">68%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[68%] animate-pulse rounded-full bg-[#7C3AED]" />
        </div>
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">
        已连载 12 集 · 共 31,240 字
      </p>
    </div>
  );
}

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
            <a href="#how" className="transition-colors hover:text-slate-900">连载</a>
            <a href="#studio" className="transition-colors hover:text-slate-900">工作室</a>
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
              进入工作室
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
              <MicroLabel>AI 连载创作平台</MicroLabel>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.06] tracking-tight text-slate-900 md:text-7xl">
                好故事，
                <br />
                <span className={`${serif.className} italic text-[#7C3AED]`}>一集一集</span>写下去
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-md text-[15px] leading-7 text-slate-500 md:text-base">
                AgentFlow 是小说与网剧剧本的连载工作室：定下世界观，AI
                帮你写大纲、写正文——每一集都完整，每一集都记得之前发生过什么。
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="rounded-xl bg-[#7C3AED] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6D28D9]"
                >
                  开始创作
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
                  ["双形态", "小说 · 网剧剧本"],
                  ["记忆", "前情自动召回"],
                  ["审稿", "人工确认再续写"],
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
              <SerialDemo />
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
                为连载创作<span className={`${serif.className} italic text-[#7C3AED]`}>而设计</span>
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

      {/* ---------- how it works ---------- */}
      <section id="how" className="border-t border-slate-200/70">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            micro="How it works"
            title={
              <>
                写一集，只需要<span className={`${serif.className} italic text-[#7C3AED]`}>四步</span>
              </>
            }
            desc="从世界观到正文，AI 负责执行，你负责拍板。"
          />
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              ["01", "定世界观", "题材、梗概、人物、风格一次设定好，之后每集都沿着它写。"],
              ["02", "出大纲", "AI 生成本集大纲：起承转合完整，结尾留好悬念。"],
              ["03", "审稿", "大纲和正文你都可以改，确认之后才往下写。"],
              ["04", "连载", "正文入库并生成摘要，成为下一集的前情记忆。"],
            ].map(([no, title, desc], i) => (
              <Reveal key={no} delay={i * 0.06} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6">
                  <p className="font-mono text-xs font-semibold text-[#7C3AED]">{no}</p>
                  <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
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
                ["双形态", "Novel & Drama", "长篇小说与网剧剧本，一个故事两种形态"],
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
            desc="Next.js 全栈工作室部署在 Vercel，故事库、流水线与模型层解耦，各司其职。"
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-4">
            {[
              ["01 / Studio", "创作工作室", "Next.js 全栈 · 作品管理 · 连载流 · 人物与伏笔面板"],
              ["02 / Pipeline", "写集流水线", "大纲 → 审稿 → 扩写 → 记忆入库，Inngest 异步执行"],
              ["03 / Memory", "故事记忆", "Supabase Postgres + pgvector：剧情摘要向量召回"],
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
              开始你的第一部
              <br />
              <span className={`${serif.className} italic text-[#7C3AED]`}>连载</span>
            </h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-[#7C3AED] px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6D28D9]"
              >
                进入工作室
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
            AgentFlow · AI 连载创作平台
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300">
            MIT · Next.js · Inngest · Supabase
          </span>
        </div>
      </footer>
    </div>
  );
}
