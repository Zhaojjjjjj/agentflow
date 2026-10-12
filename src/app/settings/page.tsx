"use client";

import { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";
import Modal from "@/components/Modal";
import {
  PageHeader,
  Button,
  Badge,
  Field,
  Input,
  Select,
  EmptyState,
  Skeleton,
  ConfirmDialog,
} from "@/components/ui";
import { toast } from "@/components/toast";

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
  dimensions: "1024",
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/settings/providers").then((r) => r.json());
      if (j.providers) setProviders(j.providers);
      setEncryptionReady(j.encryptionReady !== false);
      setEnvCount(j.envProviderCount || 0);
      if (j.error) toast.error(j.error);
    } catch (e) {
      toast.error(`加载失败：${e instanceof Error ? e.message : String(e)}`);
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
    setFormErrors({});
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
      dimensions: String(p.dimensions ?? 1024),
      priority: String(p.priority),
      enabled: p.enabled,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const isEdit = Boolean(form.id);
    if (!form.name.trim()) errs.name = "名称不能为空";
    if (!form.baseUrl.trim()) errs.baseUrl = "Base URL 不能为空";
    if (!form.model.trim()) errs.model = "模型不能为空";
    if (!isEdit && !form.apiKey.trim()) errs.apiKey = "API Key 不能为空";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = Boolean(form.id);
      const body = {
        id: form.id,
        name: form.name.trim(),
        kind: form.kind,
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey,
        model: form.model.trim(),
        dimensions: form.kind === "embedding" ? Number(form.dimensions) || 1024 : null,
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
        toast.error(j.error || "保存失败");
        return;
      }
      setModalOpen(false);
      toast.success(isEdit ? "已更新" : "已添加");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Provider) => {
    try {
      const res = await fetch(`/api/settings/providers/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("已删除");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
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
    const res = await fetch("/api/settings/providers/import", { method: "POST" });
    const j = await res.json();
    if (!res.ok) {
      toast.error(`导入失败：${j.error}`);
      return;
    }
    toast.success(`导入完成：新增 ${j.imported.length} 个，跳过 ${j.skipped.length} 个`);
    await load();
  };

  const group = (kind: "chat" | "embedding") => providers.filter((p) => p.kind === kind);

  const renderGroup = (kind: "chat" | "embedding", title: string, desc: string) => {
    const rows = group(kind);
    return (
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => openCreate(kind)}>
            添加
          </Button>
        </div>
        <div className="card overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              title={`暂无${kind === "chat" ? "对话" : "向量"}供应商`}
              description={kind === "chat" ? "添加后将优先于环境变量配置" : undefined}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((p) => (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${p.enabled ? "" : "opacity-50"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{p.name}</span>
                      <Badge tone="gray">{p.model}</Badge>
                      <Badge tone={p.enabled ? "green" : "gray"}>{p.enabled ? "启用" : "禁用"}</Badge>
                      {testResults[p.id] && (
                        <Badge tone={testResults[p.id].ok ? "green" : "red"}>
                          {testResults[p.id].msg}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-400">
                      {p.base_url} · Key {p.key_mask} · 优先级 {p.priority}
                      {p.kind === "embedding" && ` · 维度 ${p.dimensions ?? 1024}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="secondary" disabled={testing === p.id} onClick={() => test(p)}>
                      {testing === p.id ? "测试中…" : "测试连接"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => move(p, "up")} title="上移（优先级更高）">
                      ↑
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => move(p, "down")} title="下移">
                      ↓
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => toggleEnabled(p)}>
                      {p.enabled ? "禁用" : "启用"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <>
      <TopNav />
      <div className="mx-auto max-w-4xl px-6 py-8">
        <PageHeader
          title="LLM 供应商"
          desc="在后台管理对话与向量供应商，Key 经 AES-256-GCM 加密后入库，页面永不回显明文"
          actions={
            envCount > 0 ? (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                从环境变量导入（{envCount}）
              </Button>
            ) : undefined
          }
        />

        {!encryptionReady && (
          <div className="card mb-6 border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            未检测到有效的 <code className="font-mono">APP_ENCRYPTION_KEY</code>（64 位 hex）。
            新增 / 更新供应商会被拒绝。请在 Vercel 环境变量中配置后重新部署，
            生成命令：<code className="font-mono">openssl rand -hex 32</code>
          </div>
        )}

        {loading ? (
          <div className="card">
            <Skeleton rows={5} />
          </div>
        ) : (
          <>
            {renderGroup("chat", "对话供应商", "按优先级从上到下依次试错，全部失败才报错")}
            {renderGroup("embedding", "向量供应商（RAG）", "把知识库文档切块转成向量存入 pgvector，供 rag-retrieve 节点做相似检索；仅优先级最高的启用项生效")}
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "编辑供应商" : "添加供应商"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="名称" required error={formErrors.name}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如 deepseek"
            />
          </Field>
          <Field label="类型">
            <Select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as "chat" | "embedding" })}
              disabled={Boolean(form.id)}
            >
              <option value="chat">对话（chat）</option>
              <option value="embedding">向量（embedding）</option>
            </Select>
          </Field>
        </div>
        <Field label="Base URL" required error={formErrors.baseUrl}>
          <Input
            className="font-mono"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://api.deepseek.com/v1"
          />
        </Field>
        <Field
          label={`API Key${form.id ? "（留空则不修改）" : ""}`}
          required={!form.id}
          error={formErrors.apiKey}
        >
          <Input
            type="password"
            className="font-mono"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={form.id ? "••••" : "sk-..."}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="模型" required error={formErrors.model}>
            <Input
              className="font-mono"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="deepseek-chat"
            />
          </Field>
          {form.kind === "embedding" && (
            <>
              <Field label="维度">
                <Input
                  value={form.dimensions}
                  onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                  placeholder="1024"
                />
              </Field>
              <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-6 text-amber-800">
                <p className="font-medium">关于维度：必须填 1024</p>
                <p className="mt-1">
                  数据库 <span className="font-mono">documents.embedding</span> 列是{" "}
                  <span className="font-mono">vector(1024)</span>（见{" "}
                  <span className="font-mono">supabase/schema.sql</span>，建表时写死），
                  此处填其他值会导致向量写入失败。推荐{" "}
                  <span className="font-mono">BAAI/bge-large-zh-v1.5</span>（1024
                  维，中文效果好）或任意 OpenAI 兼容的 embeddings 接口。
                </p>
              </div>
            </>
          )}
          <Field label="优先级（越小越先）">
            <Input
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              placeholder="0"
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 accent-brand-600"
          />
          启用
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除供应商"
        description={`确定删除「${deleteTarget?.name || ""}」吗？相关工作流将回退到其他供应商或环境变量配置。`}
        confirmLabel="删除"
        danger
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={importOpen}
        title="从环境变量导入"
        description={`将环境变量中的 ${envCount} 个供应商导入数据库？（同名会跳过）`}
        confirmLabel="导入"
        onConfirm={() => void importEnv()}
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}
