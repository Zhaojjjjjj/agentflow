"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import Modal from "@/components/Modal";

interface Provider {
  id: string;
  name: string;
  kind: "chat" | "embedding";
  base_url: string;
  model: string;
  dimensions: number | null;
  priority: number;
  enabled: boolean;
  key_mask: string;
  created_at: string;
}

interface FormState {
  id?: string;
  name: string;
  kind: "chat" | "embedding";
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: string;
  priority: string;
  enabled: boolean;
}

const emptyForm = (kind: "chat" | "embedding"): FormState => ({
  name: "",
  kind,
  baseUrl: "",
  apiKey: "",
  model: "",
  dimensions: "1536",
  priority: "0",
  enabled: true,
});

export default function SettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [envCount, setEnvCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm("chat"));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/settings/providers").then((r) => r.json());
      if (j.providers) setProviders(j.providers);
      setEncryptionReady(j.encryptionReady !== false);
      setEnvCount(j.envProviderCount || 0);
      if (j.error) setNotice(j.error);
    } catch (e) {
      setNotice(`加载失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = (kind: "chat" | "embedding") => {
    setForm(emptyForm(kind));
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (p: Provider) => {
    setForm({
      id: p.id,
      name: p.name,
      kind: p.kind,
      baseUrl: p.base_url,
      apiKey: "",
      model: p.model,
      dimensions: String(p.dimensions ?? 1536),
      priority: String(p.priority),
      enabled: p.enabled,
    });
    setFormError("");
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError("");
    try {
      const isEdit = Boolean(form.id);
      if (!isEdit && !form.apiKey.trim()) {
        setFormError("API Key 不能为空");
        setSaving(false);
        return;
      }
      const body = {
        id: form.id,
        name: form.name.trim(),
        kind: form.kind,
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey,
        model: form.model.trim(),
        dimensions: form.kind === "embedding" ? Number(form.dimensions) || 1536 : null,
        priority: Number(form.priority) || 0,
        enabled: form.enabled,
      };
      const res = await fetch("/api/settings/providers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setFormError(j.error || "保存失败");
        setSaving(false);
        return;
      }
      setModalOpen(false);
      setNotice(isEdit ? "已更新" : "已添加");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Provider) => {
    if (!confirm(`删除供应商「${p.name}」？`)) return;
    await fetch(`/api/settings/providers/${p.id}`, { method: "DELETE" });
    await load();
  };

  const toggleEnabled = async (p: Provider) => {
    await fetch("/api/settings/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, enabled: !p.enabled }),
    });
    await load();
  };

  const move = async (p: Provider, direction: "up" | "down") => {
    const res = await fetch("/api/settings/providers/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, direction }),
    });
    const j = await res.json();
    if (j.providers) setProviders(j.providers);
  };

  const test = async (p: Provider) => {
    setTesting(p.id);
    setTestResults((m) => {
      const n = { ...m };
      delete n[p.id];
      return n;
    });
    try {
      const res = await fetch("/api/settings/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      const j = await res.json();
      setTestResults((m) => ({
        ...m,
        [p.id]: {
          ok: Boolean(j.ok),
          msg: j.ok ? `成功（${j.latencyMs}ms）— ${j.message}` : `失败：${j.message || j.error}`,
        },
      }));
    } catch (e) {
      setTestResults((m) => ({
        ...m,
        [p.id]: { ok: false, msg: `请求失败：${e instanceof Error ? e.message : String(e)}` },
      }));
    } finally {
      setTesting(null);
    }
  };

  const importEnv = async () => {
    if (!confirm(`将环境变量中的 ${envCount} 个供应商导入数据库？（同名会跳过）`)) return;
    const res = await fetch("/api/settings/providers/import", { method: "POST" });
    const j = await res.json();
    if (!res.ok) {
      setNotice(`导入失败：${j.error}`);
      return;
    }
    setNotice(`导入完成：新增 ${j.imported.length} 个，跳过 ${j.skipped.length} 个`);
    await load();
  };

  const group = (kind: "chat" | "embedding") =>
    providers.filter((p) => p.kind === kind);

  const renderGroup = (kind: "chat" | "embedding", title: string, desc: string) => {
    const rows = group(kind);
    return (
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-slate-400">{desc}</p>
          </div>
          <button className="btn-primary" onClick={() => openCreate(kind)}>+ 添加</button>
        </div>
        <div className="card divide-y divide-slate-100">
          {rows.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${p.enabled ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="badge bg-slate-100 text-slate-500">{p.model}</span>
                  <span className={`badge ${p.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                    {p.enabled ? "启用" : "禁用"}
                  </span>
                  {testResults[p.id] && (
                    <span className={`badge ${testResults[p.id].ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {testResults[p.id].msg}
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-slate-400">
                  {p.base_url} · Key {p.key_mask} · 优先级 {p.priority}
                  {p.kind === "embedding" && ` · 维度 ${p.dimensions ?? 1536}`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button className="btn-secondary !px-2.5 !py-1 text-xs" disabled={testing === p.id} onClick={() => test(p)}>
                  {testing === p.id ? "测试中…" : "测试连接"}
                </button>
                <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => move(p, "up")} title="上移（优先级更高）">↑</button>
                <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => move(p, "down")} title="下移">↓</button>
                <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => toggleEnabled(p)}>
                  {p.enabled ? "禁用" : "启用"}
                </button>
                <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => openEdit(p)}>编辑</button>
                <button className="btn-danger !px-2.5 !py-1 text-xs" onClick={() => remove(p)}>删除</button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              暂无{kind === "chat" ? "对话" : "向量"}供应商{kind === "chat" ? "（将回退到环境变量配置）" : ""}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="LLM 供应商"
        desc="在后台管理对话与向量供应商，Key 经 AES-256-GCM 加密后入库，页面永不回显明文"
        actions={
          <>
            {envCount > 0 && (
              <button className="btn-secondary" onClick={importEnv}>
                从环境变量导入（{envCount}）
              </button>
            )}
            <a className="btn-secondary" href="/">返回首页</a>
          </>
        }
      />

      {!encryptionReady && (
        <div className="card mb-6 border-red-300 bg-red-50 p-4 text-sm text-red-700">
          未检测到有效的 <code className="font-mono">APP_ENCRYPTION_KEY</code>（64 位 hex）。
          新增 / 更新供应商会被拒绝。请在 Vercel 环境变量中配置后重新部署，
          生成命令：<code className="font-mono">openssl rand -hex 32</code>
        </div>
      )}

      {notice && (
        <div className="card mb-6 border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {notice} <button className="ml-2 underline" onClick={() => setNotice("")}>关闭</button>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">加载中…</p>
      ) : (
        <>
          {renderGroup("chat", "对话供应商", "按优先级从上到下依次试错，全部失败才报错")}
          {renderGroup("embedding", "向量供应商（RAG）", "仅优先级最高的启用项生效；维度须与 documents 表的向量维度一致（默认 1536）")}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "编辑供应商" : "添加供应商"}>
        {formError && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">名称</span>
              <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 deepseek" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">类型</span>
              <select className="input w-full" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "chat" | "embedding" })} disabled={Boolean(form.id)}>
                <option value="chat">对话（chat）</option>
                <option value="embedding">向量（embedding）</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Base URL</span>
            <input className="input w-full font-mono" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.deepseek.com/v1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">API Key {form.id && <span className="text-slate-400">（留空则不修改）</span>}</span>
            <input className="input w-full font-mono" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={form.id ? "••••" : "sk-..."} />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">模型</span>
              <input className="input w-full font-mono" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="deepseek-chat" />
            </label>
            {form.kind === "embedding" && (
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">维度</span>
                <input className="input w-full" value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="1536" />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">优先级（越小越先）</span>
              <input className="input w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} placeholder="0" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            启用
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>取消</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "保存中…" : "保存"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
