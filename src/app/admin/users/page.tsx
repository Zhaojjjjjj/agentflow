"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { PageHeader, Button, Field, Input, Select, Badge, ConfirmDialog, Skeleton, CopyButton } from "@/components/ui";
import Modal from "@/components/Modal";

interface UserRow {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  project_count: number;
  episode_count: number;
  word_count: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** 新建用户成功后：展示可一键复制的登录信息 */
function CredentialShare({
  info,
  onClose,
}: {
  info: { username: string; password: string } | null;
  onClose: () => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!info) return null;
  const text = `AgentFlow 控制台登录信息\n登录地址：${origin}/login\n账号：${info.username}\n密码：${info.password}`;
  return (
    <Modal open={!!info} onClose={onClose} title="用户已创建">
      <div className="rounded-xl border border-green-200 bg-green-50/60 p-4">
        <div className="space-y-1.5 font-mono text-[13px] leading-6 text-slate-700">
          <p>
            <span className="text-slate-400">登录地址：</span>
            {origin}/login
          </p>
          <p>
            <span className="text-slate-400">账号：</span>
            {info.username}
          </p>
          <p>
            <span className="text-slate-400">密码：</span>
            {info.password}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-amber-600">密码只显示一次，请立即复制发给对方</p>
          <CopyButton text={text} label="一键复制" />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          完成
        </Button>
      </div>
    </Modal>
  );
}

function CreateUserModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (cred: { username: string; password: string }) => void;
}) {
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
      const cred = { username, password };
      setUsername("");
      setPassword("");
      setRole("user");
      onClose();
      onDone(cred);
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
        <p className="text-xs leading-5 text-slate-400">
          创建成功后会生成登录信息（含地址、账号、密码），可一键复制发给对方。
        </p>
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [cred, setCred] = useState<{ username: string; password: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setUsers(j.users);
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="用户管理" desc="创建账号、重置密码、查看每位用户的使用情况" />

      {loading ? (
        <Skeleton rows={5} />
      ) : (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              共 <span className="font-semibold text-slate-800">{users.length}</span> 位用户
            </p>
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
                  <th className="pb-2 pr-4 font-medium">作品</th>
                  <th className="pb-2 pr-4 font-medium">集数</th>
                  <th className="pb-2 pr-4 font-medium">总字数</th>
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
                        {u.nickname && (
                          <span className="text-xs text-slate-400">（{u.nickname}）</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={u.role === "admin" ? "purple" : "gray"}>
                        {u.role === "admin" ? "管理员" : "普通用户"}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{u.project_count}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{u.episode_count}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{fmtNum(u.word_count)}</td>
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
      )}

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={(c) => {
          setCred(c);
          void load();
        }}
      />
      <CredentialShare info={cred} onClose={() => setCred(null)} />

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
        description={`确定删除用户「${deleteTarget?.username}」吗？其创建的作品、集数、人物与伏笔将一并删除。`}
        confirmLabel="删除"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void doDelete()}
      />
    </main>
  );
}
