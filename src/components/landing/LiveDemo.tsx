"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate, useReducedMotion } from "framer-motion";

/**
 * Hero 活演示：一集的完整诞生过程循环播放。
 * 前情召回 → 大纲生成 → 审稿落章 → 正文逐字扩写（字数实时跳动）→ 记忆入库 → 下一集。
 * 所有动效都来自产品本身的语义，没有装饰性动画。
 */

const OUTLINE_LINES = [
  "沈夜跟踪神秘客人到旧码头",
  "怀表的秘密被提起，冲突升级",
  "结尾悬念：电话里的声音是谁",
];
const DRAFT_LINES = [
  "雨停的时候，沈夜把怀表推回抽屉最底层。",
  "「你说谎时，左手会先动。」对面的人笑了。",
  "雾从港口漫上来，盖住了第三码头的灯。",
];
const TARGET_WORDS = 2500;
const BASE_WORDS = 31240;
const BASE_EP = 13;

type Phase = "recall" | "outline" | "draft" | "memorize" | "done";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function LiveDemo() {
  const reduce = useReducedMotion();
  const [ep, setEp] = useState(BASE_EP);
  const [phase, setPhase] = useState<Phase>("recall");
  const [recallCount, setRecallCount] = useState(0);
  const [outlineCount, setOutlineCount] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draftLines, setDraftLines] = useState(0);
  const [memCount, setMemCount] = useState(0);
  const [published, setPublished] = useState(BASE_EP - 1);
  const [totalWords, setTotalWords] = useState(BASE_WORDS);
  const runId = useRef(0);

  useEffect(() => {
    if (reduce) {
      // 减动效：直接呈现完成态
      setPhase("done");
      setRecallCount(3);
      setOutlineCount(3);
      setStamped(true);
      setProgress(1);
      setDraftLines(3);
      setMemCount(3);
      return;
    }
    const id = ++runId.current;
    const alive = () => runId.current === id;
    (async () => {
      let curEp = BASE_EP;
      let curPublished = BASE_EP - 1;
      let curWords = BASE_WORDS;
      while (alive()) {
        // reset
        setEp(curEp);
        setPhase("recall");
        setRecallCount(0);
        setOutlineCount(0);
        setStamped(false);
        setProgress(0);
        setDraftLines(0);
        setMemCount(0);
        await wait(500);
        if (!alive()) return;
        for (let i = 1; i <= 3; i++) {
          setRecallCount(i);
          await wait(320);
          if (!alive()) return;
        }
        setPhase("outline");
        for (let i = 1; i <= 3; i++) {
          await wait(430);
          if (!alive()) return;
          setOutlineCount(i);
        }
        await wait(280);
        if (!alive()) return;
        setStamped(true);
        await wait(650);
        if (!alive()) return;
        setPhase("draft");
        await animate(0, 1, {
          duration: 3.6,
          ease: [0.3, 0.6, 0.4, 1],
          onUpdate: (v) => {
            if (!alive()) return;
            setProgress(v);
            setDraftLines(v < 0.3 ? 1 : v < 0.62 ? 2 : 3);
          },
        });
        if (!alive()) return;
        setPhase("memorize");
        for (let i = 1; i <= 3; i++) {
          setMemCount(i);
          await wait(300);
          if (!alive()) return;
        }
        await wait(350);
        if (!alive()) return;
        setPhase("done");
        curPublished += 1;
        curWords += TARGET_WORDS;
        setPublished(curPublished);
        setTotalWords(curWords);
        await wait(2100);
        if (!alive()) return;
        curEp += 1;
      }
    })();
    return () => {
      runId.current++;
    };
  }, [reduce]);

  const wordsNow = Math.round(TARGET_WORDS * progress);
  const phaseLabel =
    phase === "recall"
      ? "正在检索前情…"
      : phase === "outline"
        ? stamped
          ? "大纲已确认"
          : "正在生成大纲…"
        : phase === "draft"
          ? "正在扩写正文…"
          : phase === "memorize"
            ? "正在写入记忆…"
            : "本集完成";

  return (
    <div aria-hidden>
      {/* 头：作品 + 状态 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold text-slate-900">《雾港夜行》</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            长篇小说 · 悬疑
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED]/10 px-2.5 py-1 text-[11px] font-medium text-[#7C3AED]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C3AED] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
          </span>
          连载中
        </span>
      </div>

      {/* 前情召回 */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">前情记忆</p>
          <AnimatePresence mode="wait">
            <motion.span
              key={phaseLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="text-[11px] font-medium text-[#7C3AED]"
            >
              {phaseLabel}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["近 5 集摘要", "人物当前状态", "未回收伏笔 ×2"].map((chip, i) => (
            <motion.span
              key={chip}
              initial={false}
              animate={
                recallCount > i
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 0, scale: 0.85, y: 6 }
              }
              transition={{ type: "spring", stiffness: 480, damping: 26 }}
              className="rounded-full border border-[#7C3AED]/25 bg-white px-2 py-0.5 text-[11px] text-slate-600"
            >
              <span className="mr-1 text-[#7C3AED]">✓</span>
              {chip}
            </motion.span>
          ))}
        </div>
      </div>

      {/* 大纲 */}
      <div className="relative mt-3 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/[0.03] p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7C3AED]">
            第 {ep} 集 · 大纲
          </p>
          <AnimatePresence>
            {stamped && (
              <motion.span
                initial={{ opacity: 0, scale: 1.7, rotate: -14 }}
                animate={{ opacity: 1, scale: 1, rotate: -8 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 19 }}
                className="rounded-md border-2 border-[#7C3AED]/70 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[#7C3AED]"
              >
                已审稿
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <ul className="mt-2 space-y-1.5">
          {OUTLINE_LINES.map((line, i) => (
            <motion.li
              key={line}
              initial={false}
              animate={
                outlineCount > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-[13px] leading-5 text-slate-600"
            >
              <span className="mr-1.5 font-mono text-[11px] text-[#7C3AED]">{["起", "承", "转"][i]}</span>
              {line}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* 扩写 */}
      <div className="mt-3 px-0.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-500">
            {phase === "draft" ? "正在扩写正文" : phase === "memorize" || phase === "done" ? "正文已成稿" : "等待大纲通过"}
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {wordsNow.toLocaleString()} / {TARGET_WORDS.toLocaleString()} 字
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#7C3AED] transition-[width] duration-100 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-3 min-h-[66px] space-y-1">
          {DRAFT_LINES.map((line, i) => (
            <motion.p
              key={line}
              initial={false}
              animate={draftLines > i ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
              transition={{ duration: 0.35 }}
              className="text-[13px] leading-[22px] text-slate-600"
            >
              {line}
              {phase === "draft" && draftLines === i + 1 && (
                <span
                  className="ml-0.5 inline-block h-[13px] w-[2px] bg-[#7C3AED] align-[-2px]"
                  style={{ animation: "cursor-blink 1.1s step-end infinite" }}
                />
              )}
            </motion.p>
          ))}
        </div>
      </div>

      {/* 记忆入库 + 页脚计数 */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["摘要已生成", "人物状态已更新", "伏笔 +1"].map((chip, i) => (
          <motion.span
            key={chip}
            initial={false}
            animate={memCount > i ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 480, damping: 26 }}
            className="rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[11px] font-medium text-[#7C3AED]"
          >
            {chip}
          </motion.span>
        ))}
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">
        已连载 <span className="tabular-nums text-slate-400">{published}</span> 集 · 共{" "}
        <span className="tabular-nums text-slate-400">{totalWords.toLocaleString()}</span> 字
      </p>
    </div>
  );
}
