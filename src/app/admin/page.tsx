"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { PageHeader, Button, Field, Input, Select, Badge, ConfirmDialog, Skeleton } from "@/components/ui";
import Modal from "@/components/Modal";

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
interface UserRow extends LeaderRow {
  created_at: string;
  workflow_count: number;
  run_count: number;
  total_tokens: number;
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

function CreateUserModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "创建失败");
      toast.success(`用户 ${username} 已创建`);
      setUsername("");
      setPassword("");
      setRole("user");
      onClose();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="新建用户">
      <div className="space-y-4">
        <Field label="用户名（3-40 位字母/数字/_.@-）">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="zhangsan" />
        </Field>
        <Field label="初始密码（至少 6 位）">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="角色">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" disabled={busy || !username || !password} onClick={submit}>
            {busy ? "创建中…" : "创建"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [days, setDays] = useState<DayPoint[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, u] = await Promise.all([
        fetch("/api/admin/stats").then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      if (u.error) throw new Error(u.error);
      setOverview(s.overview);
      setDays(s.daily);
      setLeaders(s.leaderboard);
      setUsers(u.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const doReset = async () => {
    if (!resetTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "重置失败");
      toast.success("密码已重置");
      setResetTarget(null);
      setResetPw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重置失败");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "删除失败");
      toast.success("用户已删除");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="数据统计" desc="平台使用情况总览与用户管理（仅管理员可见）" />

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

          <div className="mb-6 grid gap-4 lg:grid-cols-5">
            <div className="card p-5 lg:col-span-3">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">近 14 天运行趋势</h3>
              <TrendChart days={days} />
            </div>
            <div className="card p-5 lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">用户 Token 消耗排行</h3>
              <Leaderboard rows={leaders} />
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">用户管理</h3>
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                新建用户
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="pb-2 pr-4 font-medium">用户</th>
                    <th className="pb-2 pr-4 font-medium">角色</th>
                    <th className="pb-2 pr-4 font-medium">工作流</th>
                    <th className="pb-2 pr-4 font-medium">运行</th>
                    <th className="pb-2 pr-4 font-medium">Token</th>
                    <th className="pb-2 pr-4 font-medium">创建时间</th>
                    <th className="pb-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-2">
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt={u.username} width={24} height={24} className="rounded-full object-cover" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                              {u.username.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium text-slate-800">{u.username}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={u.role === "admin" ? "purple" : "gray"}>
                          {u.role === "admin" ? "管理员" : "普通用户"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{u.workflow_count}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{u.run_count}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{fmtNum(u.total_tokens)}</td>
                      <td className="py-2.5 pr-4 text-xs text-slate-400">
                        {new Date(u.created_at).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          className="mr-3 text-xs text-slate-500 hover:text-brand-600"
                          onClick={() => {
                            setResetTarget(u);
                            setResetPw("");
                          }}
                        >
                          重置密码
                        </button>
                        <button
                          className="text-xs text-slate-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(u)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => void load()} />

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`重置密码 · ${resetTarget?.username ?? ""}`}>
        <div className="space-y-4">
          <Field label="新密码（至少 6 位）">
            <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              取消
            </Button>
            <Button variant="primary" disabled={busy || resetPw.length < 6} onClick={doReset}>
              {busy ? "处理中…" : "确认重置"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除用户"
        description={`确定删除用户「${deleteTarget?.username}」吗？其创建的工作流将保留但失去归属。`}
        confirmLabel="删除"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void doDelete()}
      />
    </main>
  );
}
