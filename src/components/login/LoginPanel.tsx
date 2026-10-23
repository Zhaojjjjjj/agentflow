"use client";

import { useEffect, useRef, useState } from "react";
import { motion, animate, useReducedMotion } from "framer-motion";

/**
 * 登录页左侧面板：一部正在连载的作品，实时往下写。
 * 时间线上的集数逐个完成、正文逐字打出、字数与集数计数跟着涨——
 * 和落地页同一个世界观：连载进行时。
 */

const MANUSCRIPT = [
  "雨停的时候，沈夜把怀表推回抽屉最底层。",
  "「你说谎时，左手会先动。」对面的人笑了。",
];
const EP_WORDS = 2500;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface EpRow {
  n: number;
  state: "done" | "active" | "next";
}

export default function LoginPanel() {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<EpRow[]>([
    { n: 10, state: "done" },
    { n: 11, state: "done" },
    { n: 12, state: "done" },
    { n: 13, state: "active" },
    { n: 14, state: "next" },
  ]);
  const [progress, setProgress] = useState(0);
  const [typed, setTyped] = useState("");
  const [published, setPublished] = useState(12);
  const [totalWords, setTotalWords] = useState(31240);
  const runId = useRef(0);

  useEffect(() => {
    if (reduce) {
      setProgress(1);
      setTyped(MANUSCRIPT.join("\n"));
      return;
    }
    const id = ++runId.current;
    const alive = () => runId.current === id;
    (async () => {
      let cur = [
        { n: 10, state: "done" },
        { n: 11, state: "done" },
        { n: 12, state: "done" },
        { n: 13, state: "active" },
        { n: 14, state: "next" },
      ] as EpRow[];
      let pub = 12;
      let words = 31240;
      while (alive()) {
        setRows(cur);
        setProgress(0);
        setTyped("");
        await wait(600);
        if (!alive()) return;
        // 打字：两行正文逐字出现（约 3.2s）
        const full = MANUSCRIPT.join("\n");
        const typer = animate(0, full.length, {
          duration: 3.4,
          ease: "linear",
          onUpdate: (v) => {
            if (alive()) setTyped(full.slice(0, Math.floor(v)));
          },
        });
        const prog = animate(0, 1, {
          duration: 5.2,
          ease: [0.3, 0.6, 0.4, 1],
          onUpdate: (v) => {
            if (alive()) setProgress(v);
          },
        });
        await Promise.all([typer, prog]);
        if (!alive()) return;
        await wait(500);
        if (!alive()) return;
        // 当前集完成 → 推进
        const activeIdx = cur.findIndex((r) => r.state === "active");
        const doneN = cur[activeIdx].n;
        cur = cur
          .map((r, i) =>
            i === activeIdx
              ? { ...r, state: "done" as const }
              : i === activeIdx + 1
                ? { ...r, state: "active" as const }
                : r
          )
          .filter((r) => r.n > doneN - 3);
        cur.push({ n: cur[cur.length - 1].n + 1, state: "next" });
        pub += 1;
        words += EP_WORDS;
        setPublished(pub);
        setTotalWords(words);
        // 跑满 3 集后回到初始，循环
        if (doneN >= 15) {
          await wait(1600);
          if (!alive()) return;
          cur = [
            { n: 10, state: "done" },
            { n: 11, state: "done" },
            { n: 12, state: "done" },
            { n: 13, state: "active" },
            { n: 14, state: "next" },
          ] as EpRow[];
          pub = 12;
          words = 31240;
          setPublished(pub);
          setTotalWords(words);
        }
        await wait(900);
      }
    })();
    return () => {
      runId.current++;
    };
  }, [reduce]);

  const wordsNow = Math.round(EP_WORDS * progress);

  return (
    <div className="relative hidden h-full w-full overflow-hidden border-r border-slate-200/70 bg-white md:block">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: "radial-gradient(560px 280px at 50% -40px, rgba(124,58,237,0.08), transparent 70%)" }}
      />
      <div className="relative z-10 flex h-full flex-col p-10 xl:p-12">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400"
        >
          AI Serial Studio
        </motion.p>

        {/* 连载时间线 */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mt-10"
        >
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">《雾港夜行》</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C3AED] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
              </span>
              连载中
            </span>
          </div>

          <div className="relative mt-6 pl-1">
            <span aria-hidden className="absolute bottom-3 left-[10px] top-2 w-px bg-slate-200" />
            <div className="space-y-4">
              {rows.map((row) => (
                <motion.div
                  key={row.n}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: row.state === "next" ? 0.45 : 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="relative"
                >
                  <div className="flex items-center gap-3">
                    {row.state === "done" ? (
                      <motion.span
                        initial={{ scale: 0.6 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED] text-white"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5.5 4 8 8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </motion.span>
                    ) : row.state === "active" ? (
                      <span className="relative z-10 flex h-5 w-5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C3AED] opacity-25" />
                        <span className="relative h-2.5 w-2.5 rounded-full bg-[#7C3AED]" />
                      </span>
                    ) : (
                      <span className="z-10 h-5 w-5 rounded-full border-2 border-dashed border-slate-300 bg-white" />
                    )}
                    <p className={`text-sm ${row.state === "active" ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                      第 {row.n} 集
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {row.state === "done" ? "已发布" : row.state === "active" ? "撰写中" : "待创作"}
                      </span>
                    </p>
                    {row.state === "done" && (
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-slate-300">2,500 字</span>
                    )}
                  </div>

                  {row.state === "active" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.4 }}
                      className="ml-8 mt-3 overflow-hidden rounded-xl border border-[#7C3AED]/25 bg-[#7C3AED]/[0.03] p-3.5"
                    >
                      <p className="min-h-[44px] whitespace-pre-wrap text-[13px] leading-[22px] text-slate-600">
                        {typed}
                        <span
                          className="ml-0.5 inline-block h-[13px] w-[2px] bg-[#7C3AED] align-[-2px]"
                          style={{ animation: "cursor-blink 1.1s step-end infinite" }}
                        />
                      </p>
                      <div className="mt-2.5 flex items-center gap-2.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200/70">
                          <div
                            className="h-full rounded-full bg-[#7C3AED] transition-[width] duration-100 ease-linear"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-slate-400">
                          {wordsNow.toLocaleString()} 字
                        </span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="flex-1" />

        {/* 底部 wordmark + 数据 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25 }}
        >
          <div className="flex items-center gap-2.5">
            <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true">
              <g fill="none" stroke="#7C3AED" strokeWidth="11">
                <path d="M 84.6 67.5 A 40 40 0 1 1 84.6 32.5" strokeLinecap="round" />
              </g>
              <circle cx="88" cy="50" r="8" fill="#7C3AED" />
              <circle cx="50" cy="50" r="9" fill="#7C3AED" />
            </svg>
            <span className="text-[26px] font-semibold tracking-tight text-slate-900">AgentFlow</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
            小说与网剧剧本的连载工作室——定下世界观，AI 帮你一集一集写下去。
          </p>
          <dl className="mt-7 flex gap-10 border-t border-slate-100 pt-5">
            <div>
              <dt className="font-mono text-lg font-semibold tabular-nums text-slate-900">{published} 集</dt>
              <dd className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">已连载</dd>
            </div>
            <div>
              <dt className="font-mono text-lg font-semibold tabular-nums text-slate-900">{totalWords.toLocaleString()} 字</dt>
              <dd className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">总字数</dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-slate-900">双形态</dt>
              <dd className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">小说 · 网剧</dd>
            </div>
          </dl>
        </motion.div>
      </div>
    </div>
  );
}
