"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { PageHeader, Skeleton } from "@/components/ui";

interface Overview {
  users: number;
  workflows: number;
  runs: number;
  tokens: number;
  cost_usd: number;
}
interface DayPoint {
  date: string;
  runs: number;
  tokens: number;
}
interface LeaderRow {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  tokens: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** 14 天运行次数柱状图（纯 SVG） */
function TrendChart({ days }: { days: DayPoint[] }) {
  const W = 640;
  const H = 180;
  const PAD = 28;
  const max = Math.max(1, ...days.map((d) => d.runs));
  const bw = (W - PAD * 2) / days.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = H - PAD - (H - PAD * 2) * f;
        return <line key={f} x1={PAD} x2={W - 8} y1={y} y2={y} stroke="#f1f5f9" strokeWidth={1} />;
      })}
      {days.map((d, i) => {
        const h = Math.max(2, ((H - PAD * 2) * d.runs) / max);
        const x = PAD + i * bw + bw * 0.22;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={H - PAD - h}
              width={bw * 0.56}
              height={h}
              rx={3}
              className="fill-brand-500/85 transition-all hover:fill-brand-600"
            >
              <title>{`${d.date}: ${d.runs} 次运行 / ${fmtNum(d.tokens)} tokens`}</title>
            </rect>
            {i % 2 === 0 && (
              <text x={x + bw * 0.28} y={H - 10} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {d.date}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** 用户 Token 横向排行 */
function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.tokens));
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-slate-400">暂无数据</p>;
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3">
          <span className="w-5 text-right text-xs font-semibold text-slate-400">{i + 1}</span>
          {r.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.avatar_url} alt={r.username} width={28} height={28} className="rounded-full object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {r.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="w-28 truncate text-sm font-medium text-slate-700">{r.username}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
              style={{ width: `${Math.max(2, (r.tokens / max) * 100)}%` }}
            />
          </div>
          <span className="w-20 text-right font-mono text-xs text-slate-500">{fmtNum(r.tokens)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [days, setDays] = useState<DayPoint[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((s) => {
        if (s.error) throw new Error(s.error);
        setOverview(s.overview);
        setDays(s.daily);
        setLeaders(s.leaderboard);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const cards = overview
    ? [
        { label: "用户数", value: String(overview.users) },
        { label: "工作流", value: String(overview.workflows) },
        { label: "运行次数", value: fmtNum(overview.runs) },
        { label: "Token 消耗", value: fmtNum(overview.tokens) },
        { label: "预估费用", value: `$${overview.cost_usd.toFixed(4)}` },
      ]
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="数据总览" desc="平台使用情况一览" />

      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="card p-4">
                <p className="text-xs text-slate-400">{c.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="card p-5 lg:col-span-3">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">近 14 天运行趋势</h3>
              <TrendChart days={days} />
            </div>
            <div className="card p-5 lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">用户 Token 消耗排行</h3>
              <Leaderboard rows={leaders} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
