"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  workflow_id: string;
  created_at: string;
  last_used_at: string | null;
}

interface Workflow {
  id: string;
  name: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowId, setWorkflowId] = useState("");
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");

  const load = async () => {
    const [k, w] = await Promise.all([
      fetch("/api/api-keys").then((r) => r.json()),
      fetch("/api/workflows").then((r) => r.json()),
    ]);
    if (k.keys) setKeys(k.keys);
    if (w.workflows) {
      setWorkflows(w.workflows);
      if (!workflowId && w.workflows.length) setWorkflowId(w.workflows[0].id);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!workflowId) return;
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, name: name.trim() || "默认" }),
    });
    const j = await res.json();
    if (res.ok) {
      setNewKey(j.key);
      setName("");
      await load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("删除这个 API Key？")) return;
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    await load();
  };

  const wfName = (id: string) => workflows.find((w) => w.id === id)?.name || id.slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader title="API Keys" desc="用于 POST /api/public/workflows/[id]/run 的鉴权" actions={<a className="btn-secondary" href="/">返回首页</a>} />

      {newKey && (
        <div className="card mb-5 border-amber-300 bg-amber-50 p-4">
          <p className="mb-1 text-sm font-semibold text-amber-700">请立即复制，关闭后不再显示：</p>
          <code className="break-all font-mono text-sm">{newKey}</code>
          <div><button className="btn-secondary mt-2" onClick={() => setNewKey("")}>我已保存</button></div>
        </div>
      )}

      <div className="card mb-6 flex flex-wrap gap-2 p-4">
        <select className="input w-56" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <input className="input w-44" value={name} onChange={(e) => setName(e.target.value)} placeholder="备注名" />
        <button className="btn-primary" onClick={create}>生成 Key</button>
      </div>

      <div className="card divide-y divide-slate-100">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="font-medium">{k.name} <span className="font-mono text-xs text-slate-400">{k.key_prefix}…</span></div>
              <div className="text-xs text-slate-400">
                {wfName(k.workflow_id)} · 创建于 {new Date(k.created_at).toLocaleString()}
                {k.last_used_at && ` · 上次使用 ${new Date(k.last_used_at).toLocaleString()}`}
              </div>
            </div>
            <button className="btn-danger" onClick={() => remove(k.id)}>删除</button>
          </div>
        ))}
        {keys.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-400">暂无 API Key</p>}
      </div>
    </div>
  );
}
