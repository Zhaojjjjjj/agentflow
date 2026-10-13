"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import Modal from "@/components/Modal";
import {
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  ConfirmDialog,
} from "@/components/ui";
import { toast } from "@/components/toast";

interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  is_published: boolean;
  schedule_enabled: boolean;
  schedule_cron: string | null;
  updated_at: string;
}

interface Health {
  supabase: boolean;
  redis: boolean;
  inngest: boolean;
  llmProviders?: string[];
  embeddings: boolean;
}

interface RunBrief {
  workflow_id: string;
  status: string;
  total_tokens: number;
  created_at: string;
}

/* ---------- 小图标 ---------- */

const PlusIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M10 4v12M4 10h12" />
  </svg>
);

const SearchIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13.5 13.5 17 17" />
  </svg>
);

const LayersIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M10 2.5 17.5 6.5 10 10.5 2.5 6.5 10 2.5Z" />
    <path d="M2.5 10.5 10 14.5l7.5-4M2.5 13.8 10 17.8l7.5-4" />
  </svg>
);

const GridIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" />
    <rect x="11" y="11" width="6.5" height="6.5" rx="3.25" />
  </svg>
);

const ActivityIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 10h4l2.5-6 4 12 2.5-6h2" />
  </svg>
);

const ZapIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
    <path d="M11 2 4 11.5h5L8.5 18 16 8.5h-5L11 2Z" />
  </svg>
);

/* ---------- 呼吸灯圆点 ---------- */

function PulseDot({ color, ping = false }: { color: string; ping?: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {ping && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

function StatusDot({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <PulseDot color={ok ? "bg-green-500" : warn ? "bg-amber-500" : "bg-slate-300"} ping={ok || warn} />
      {label}
    </span>
  );
}

/* ---------- 最近运行状态 ---------- */

function runStatusMeta(status: string): { color: string; label: string; ping: boolean } {
  switch (status) {
    case "succeeded":
      return { color: "bg-green-500", label: "运行成功", ping: false };
    case "failed":
      return { color: "bg-red-500", label: "运行失败", ping: false };
    case "running":
    case "queued":
      return { color: "bg-brand-500", label: "运行中", ping: true };
    case "waiting_approval":
      return { color: "bg-amber-500", label: "等待审批", ping: true };
    case "rejected":
    case "cancelled":
      return { color: "bg-slate-400", label: "已终止", ping: false };
    default:
      return { color: "bg-slate-300", label: "暂无运行", ping: false };
  }
}

/* ---------- 工具函数 ---------- */

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return "刚刚";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString();
}

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ---------- 动效 ---------- */

const listVar = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVar = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } },
};

type StatusFilter = "all" | "published" | "unpublished";
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "published", label: "已发布" },
  { value: "unpublished", label: "未发布" },
];

export default function DashboardView() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [runsByWf, setRunsByWf] = useState<Record<string, RunBrief>>({});
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ todayRuns: 0, totalTokens: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [nameError, setNameError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [wRes, hRes, rRes] = await Promise.all([
        fetch("/api/workflows"),
        fetch("/api/health"),
        fetch("/api/runs"),
      ]);
      if (!wRes.ok || !hRes.ok || !rRes.ok) throw new Error("请求失败");
      const [w, h, r] = await Promise.all([wRes.json(), hRes.json(), rRes.json()]);
      const wfs: Workflow[] = w.workflows || [];
      setWorkflows(wfs);
      setHealth(h);

      // 运行统计：一次请求同时服务统计卡 + 每卡最近运行状态
      const runs: RunBrief[] = r.runs || [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      let todayRuns = 0;
      let totalTokens = 0;
      const byWf: Record<string, RunBrief> = {};
      for (const run of runs) {
        totalTokens += run.total_tokens || 0;
        if (new Date(run.created_at) >= startOfToday) todayRuns++;
        if (!byWf[run.workflow_id]) byWf[run.workflow_id] = run; // 接口已按创建倒序
      }
      setStats({ todayRuns, totalTokens });
      setRunsByWf(byWf);

      // 节点数：并行拉取各工作流 definition，渐进填充
      void Promise.all(
        wfs.map(async (wf) => {
          try {
            const res = await fetch(`/api/workflows/${wf.id}`);
            const j = await res.json();
            const n = j.workflow?.definition?.nodes?.length;
            if (typeof n === "number") {
              setNodeCounts((prev) => ({ ...prev, [wf.id]: n }));
            }
          } catch {
            /* 忽略，徽标保持占位 */
          }
        })
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cmd+K 命令面板可通过事件触发"新建工作流"弹窗
  useEffect(() => {
    const open = () => openCreate();
    window.addEventListener("agentflow:create-workflow", open);
    return () => window.removeEventListener("agentflow:create-workflow", open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setNewName("");
    setNewDesc("");
    setNameError("");
    setCreateOpen(true);
  };

  const create = async () => {
    if (!newName.trim()) {
      setNameError("名称不能为空");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.id) throw new Error(j.error || "创建失败");
      toast.success("工作流已创建");
      setCreateOpen(false);
      router.push(`/workflows/${j.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("已删除");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workflows.filter((w) => {
      if (statusFilter === "published" && !w.is_published) return false;
      if (statusFilter === "unpublished" && w.is_published) return false;
      if (q && !`${w.name} ${w.description || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [workflows, query, statusFilter]);

  const deleteName = workflows.find((w) => w.id === deleteId)?.name || "";
  const llmProviders = health?.llmProviders || [];
  const publishedCount = workflows.filter((w) => w.is_published).length;

  const statCards = [
    {
      label: "工作流总数",
      value: String(workflows.length),
      sub: `${publishedCount} 个已发布`,
      icon: <GridIcon />,
    },
    {
      label: "今日运行",
      value: String(stats.todayRuns),
      sub: "次执行",
      icon: <ActivityIcon />,
    },
    {
      label: "累计 Token",
      value: formatNum(stats.totalTokens),
      sub: "tokens",
      icon: <ZapIcon />,
    },
  ];

  return (
    <>
      <TopNav />
      <div className="relative">
        {/* 顶部微光背景 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(55%_100%_at_50%_0%,rgba(124,58,237,0.08),transparent)]" />

        <div className="relative mx-auto max-w-6xl px-6 py-8">
          {/* 标题栏 */}
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-slate-900">工作流</h1>
              <p className="mt-1 text-sm text-slate-500">可视化编排 AI Agent，拖拽节点即刻运行</p>
            </div>
            <Button
              variant="primary"
              onClick={openCreate}
              className="gap-1.5 shadow-[0_6px_18px_-4px_rgba(124,58,237,0.5)] transition-shadow duration-200 hover:shadow-[0_8px_24px_-4px_rgba(124,58,237,0.6)]"
            >
              <PlusIcon />
              新建工作流
            </Button>
          </div>

          {/* 服务状态细条 */}
          {health && (
            <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <StatusDot ok={health.supabase} label={`Supabase ${health.supabase ? "已连接" : "未配置"}`} />
              <StatusDot ok={health.redis} label={`Redis ${health.redis ? "已连接" : "未配置（已降级）"}`} />
              <StatusDot ok={health.inngest} warn={!health.inngest} label={`Inngest ${health.inngest ? "已配置" : "未配置（仅同步模式）"}`} />
              <StatusDot
                ok={llmProviders.length > 0}
                label={`LLM ${llmProviders.length > 0 ? llmProviders.join("、") : "未配置"}`}
              />
              <StatusDot ok={health.embeddings} label={`Embeddings ${health.embeddings ? "已配置" : "未配置"}`} />
            </div>
          )}

          {loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm text-red-600">加载失败：{loadError}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
                重试
              </Button>
            </div>
          ) : loading ? (
            <>
              {/* 统计骨架 */}
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="card animate-pulse p-5">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="mt-3 h-8 w-24 rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
              {/* 卡片骨架 */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="card animate-pulse p-5">
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="mt-3 h-3 w-full rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
                    <div className="mt-5 flex gap-2">
                      <div className="h-6 w-16 rounded-md bg-slate-100" />
                      <div className="h-6 w-20 rounded-md bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* 统计卡 */}
              <motion.div
                className="mb-6 grid gap-4 sm:grid-cols-3"
                variants={listVar}
                initial={animated ? false : "hidden"}
                animate="show"
                onAnimationComplete={() => setAnimated(true)}
              >
                {statCards.map((s) => (
                  <motion.div
                    key={s.label}
                    variants={itemVar}
                    whileHover={{ y: -3 }}
                    className="card group relative overflow-hidden p-5 transition-[box-shadow,border-color] duration-200 hover:border-brand-200 hover:shadow-[0_14px_36px_-14px_rgba(124,58,237,0.3)]"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400/0 to-transparent transition-all duration-300 group-hover:via-brand-400/80" />
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-500">{s.label}</p>
                        <p className="mt-1.5 text-[30px] font-bold tabular-nums leading-none tracking-tight text-slate-900">
                          {s.value}
                        </p>
                        <p className="mt-1.5 text-[11px] text-slate-400">{s.sub}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-200 group-hover:bg-brand-100">
                        {s.icon}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* 搜索 + 筛选 */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon />
                  </span>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索工作流名称或描述…"
                    className="pl-10"
                  />
                </div>
                <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {FILTERS.map((f) => {
                    const active = statusFilter === f.value;
                    return (
                      <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                          active
                            ? "bg-brand-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.4)]"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                {(query.trim() || statusFilter !== "all") && (
                  <span className="text-xs text-slate-400">
                    找到 {filtered.length} 个
                  </span>
                )}
              </div>

              {/* 卡片网格 / 空状态 */}
              {workflows.length === 0 ? (
                <div className="card relative overflow-hidden px-6 py-16 text-center">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,rgba(124,58,237,0.1),transparent)]" />
                  {/* 装饰性节点连线 */}
                  <div className="relative mx-auto mb-6 flex w-fit items-center gap-0">
                    {["#7C3AED", "#A78BFA", "#DDD6FE"].map((c, i) => (
                      <div key={i} className="flex items-center">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm"
                          style={{ borderColor: `${c}55` }}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                        </div>
                        {i < 2 && (
                          <div className="h-px w-10 bg-gradient-to-r from-slate-200 via-brand-200 to-slate-200" />
                        )}
                      </div>
                    ))}
                  </div>
                  <h3 className="relative text-lg font-semibold tracking-tight text-slate-900">
                    还没有工作流
                  </h3>
                  <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    创建你的第一个工作流，拖拽 LLM、工具、知识检索与审批节点，
                    即可编排出一个 AI Agent 应用
                  </p>
                  <div className="relative mt-6">
                    <Button
                      variant="primary"
                      onClick={openCreate}
                      className="gap-1.5 shadow-[0_6px_18px_-4px_rgba(124,58,237,0.5)]"
                    >
                      <PlusIcon />
                      新建工作流
                    </Button>
                  </div>
                  <p className="relative mt-4 text-xs text-slate-400">
                    也可以按 <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> 快速新建
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="card px-6 py-14 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <SearchIcon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-slate-900">没有匹配的工作流</h3>
                  <p className="mt-1.5 text-sm text-slate-500">换个关键词或调整筛选条件试试</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("all");
                    }}
                  >
                    清除筛选
                  </Button>
                </div>
              ) : (
                <motion.div
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  variants={listVar}
                  initial={animated ? false : "hidden"}
                  animate="show"
                  onAnimationComplete={() => setAnimated(true)}
                >
                  {filtered.map((w) => {
                    const lastRun = runsByWf[w.id];
                    const meta = runStatusMeta(lastRun?.status || "");
                    const nodeCount = nodeCounts[w.id];
                    return (
                      <motion.div
                        key={w.id}
                        variants={itemVar}
                        whileHover={{ y: -4 }}
                        className="card group relative flex flex-col p-5 transition-[box-shadow,border-color] duration-200 hover:border-brand-200 hover:shadow-[0_16px_40px_-16px_rgba(124,58,237,0.3)]"
                      >
                        {/* 顶部高光线 */}
                        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/0 to-transparent transition-all duration-300 group-hover:via-brand-400/70" />

                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <Link
                            href={`/workflows/${w.id}`}
                            className="truncate text-[15px] font-semibold tracking-tight text-slate-900 transition-colors hover:text-brand-600"
                          >
                            {w.name}
                          </Link>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {w.is_published && <Badge tone="green">已发布</Badge>}
                            {w.schedule_enabled && (
                              <Badge tone="purple" className="font-mono text-[10px]">
                                {w.schedule_cron}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-slate-500">
                          {w.description || <span className="text-slate-300">暂无描述</span>}
                        </p>

                        <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                            <LayersIcon />
                            {nodeCount === undefined ? (
                              <span className="inline-block h-3 w-10 animate-pulse rounded bg-slate-200" />
                            ) : (
                              `${nodeCount} 个节点`
                            )}
                          </span>
                          <span className="h-3 w-px bg-slate-200" />
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                            <PulseDot color={meta.color} ping={meta.ping} />
                            {meta.label}
                          </span>
                        </div>

                        <div className="mt-auto border-t border-slate-100 pt-3">
                          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              v{w.version} · 更新于 {timeAgo(w.updated_at)}
                            </span>
                            {lastRun && <span>上次运行 {timeAgo(lastRun.created_at)}</span>}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Link
                              href={`/workflows/${w.id}`}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
                            >
                              编辑
                            </Link>
                            <Link
                              href={`/workflows/${w.id}/runs`}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
                            >
                              运行历史
                            </Link>
                            <button
                              className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
                              onClick={() => setDeleteId(w.id)}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 新建工作流 */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建工作流">
        <Field label="名称" required error={nameError || undefined}>
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (e.target.value.trim()) setNameError("");
            }}
            placeholder="例如：客服问答助手"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </Field>
        <Field label="描述" hint="可选，一句话说明这个工作流的用途">
          <Textarea
            rows={3}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="例如：基于知识库的客服问答，含人工兜底"
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={creating} onClick={() => void create()}>
            {creating ? "创建中…" : "创建"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除工作流"
        description={`确定删除「${deleteName}」吗？运行记录将一并删除，此操作不可恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => {
          if (deleteId) void remove(deleteId);
        }}
        onClose={() => setDeleteId(null)}
      />
    </>
  );
}
