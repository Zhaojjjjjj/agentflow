"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Field, Input, Select, Textarea, EmptyState } from "@/components/ui";
import { toast } from "@/components/toast";

interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
  mode: "generate" | "edit" | "both";
  size: string;
  cover_url: string;
  enabled: boolean;
  sort: number;
}

interface ProviderOption {
  id: string;
  name: string;
}

const MODE_LABEL: Record<string, string> = {
  generate: "文生图",
  edit: "图生图（需上传）",
  both: "两者皆可",
};
const SIZE_OPTIONS = [
  { value: "1024x1024", label: "方形 1024×1024" },
  { value: "1024x1536", label: "竖版 1024×1536（3:4 近似）" },
  { value: "1536x1024", label: "横版 1536×1024" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#7C3AED]" : "bg-slate-200"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

const emptyForm = (): Omit<Template, "id"> => ({
  name: "",
  description: "",
  prompt: "",
  mode: "generate",
  size: "1024x1024",
  cover_url: "",
  enabled: true,
  sort: 0,
});

export default function AdminImagesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<Template, "id">>(emptyForm());
  const [saving, setSaving] = useState(false);

  // 生图模型配置
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [imgCfg, setImgCfg] = useState({ image_provider: "", image_model: "" });
  const [chatCfgRaw, setChatCfgRaw] = useState({ provider: "", model: "", system_prompt: "" });
  const [cfgSaving, setCfgSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const j = await fetch("/api/admin/image-templates").then((r) => r.json());
      if (j.error) setLoadError(j.error);
      else setTemplates(j.templates ?? []);
    } catch {
      setLoadError("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((j) => {
        if (!j.error) {
          setImgCfg({ image_provider: j.image_provider || "", image_model: j.image_model || "" });
          setChatCfgRaw({ provider: j.provider || "", model: j.model || "", system_prompt: j.system_prompt || "" });
        }
      })
      .catch(() => {});
    fetch("/api/settings/providers")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.providers)) setProviders(j.providers.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
  }, [loadTemplates]);

  const saveCfg = async () => {
    setCfgSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chatCfgRaw, ...imgCfg }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "保存失败");
      toast.success("生图模型配置已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setCfgSaving(false);
    }
  };

  const startCreate = () => {
    setForm(emptyForm());
    setCreating(true);
    setEditingId(null);
  };
  const startEdit = (t: Template) => {
    const { id, ...rest } = t;
    void id;
    setForm(rest);
    setEditingId(t.id);
    setCreating(false);
  };
  const cancelForm = () => {
    setCreating(false);
    setEditingId(null);
  };

  const saveForm = async () => {
    if (!form.name.trim()) return toast.error("请填写模板名称");
    if (!form.prompt.trim()) return toast.error("请填写提示词");
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/image-templates/${editingId}` : "/api/admin/image-templates";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "保存失败");
      toast.success(editingId ? "模板已更新" : "模板已创建");
      cancelForm();
      await loadTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Template) => {
    if (!confirm(`删除模板「${t.name}」？历史生图记录不受影响。`)) return;
    const res = await fetch(`/api/admin/image-templates/${t.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error || "删除失败");
    toast.success("已删除");
    if (editingId === t.id) cancelForm();
    await loadTemplates();
  };

  const toggleEnabled = async (t: Template) => {
    const res = await fetch(`/api/admin/image-templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !t.enabled }),
    });
    if (!res.ok) return toast.error("操作失败");
    await loadTemplates();
  };

  const showForm = creating || editingId !== null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">生图模板</h1>
      <p className="mt-1 text-sm text-slate-500">维护生图工作台的风格模板提示词；用户选模板即可生图，或上传图片按模板编辑。</p>

      {/* 生图模型配置 */}
      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">生图模型</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          走供应商的 OpenAI 兼容图片接口（/images/generations 与 /images/edits）。留空则按供应商优先级自动选第一个；模型名填该供应商支持的图片模型，如 gpt-image-1。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="供应商">
            <Select
              value={imgCfg.image_provider}
              onChange={(e) => setImgCfg((c) => ({ ...c, image_provider: e.target.value }))}
            >
              <option value="">自动（按优先级）</option>
              {providers.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="图片模型名">
            <Input
              value={imgCfg.image_model}
              onChange={(e) => setImgCfg((c) => ({ ...c, image_model: e.target.value }))}
              placeholder="如 gpt-image-1"
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={saveCfg} disabled={cfgSaving}>
            {cfgSaving ? "保存中…" : "保存配置"}
          </Button>
        </div>
      </section>

      {/* 模板列表 */}
      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">模板列表（{templates.length}）</h2>
          {!showForm && (
            <Button size="sm" variant="primary" onClick={startCreate}>
              新建模板
            </Button>
          )}
        </div>

        {loadError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</p>
        ) : loading ? (
          <p className="mt-4 text-sm text-slate-400">加载中…</p>
        ) : templates.length === 0 && !showForm ? (
          <EmptyState title="还没有模板" description="新建第一个风格模板，用户就能在生图工作台里选用。" />
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {t.name}
                    {!t.enabled && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-400">已停用</span>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {MODE_LABEL[t.mode]} · {t.size}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                <Toggle checked={t.enabled} onChange={() => toggleEnabled(t)} />
                <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                  编辑
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(t)}>
                  删除
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* 编辑表单 */}
        {showForm && (
          <div className="mt-5 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/[0.02] p-4">
            <h3 className="text-sm font-semibold text-slate-900">{editingId ? "编辑模板" : "新建模板"}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="名称">
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：旅行纪念票卡海报" />
              </Field>
              <Field label="排序（小的靠前）">
                <Input
                  type="number"
                  value={form.sort}
                  onChange={(e) => setForm((f) => ({ ...f, sort: Number(e.target.value) || 0 }))}
                />
              </Field>
              <Field label="模式">
                <Select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as Template["mode"] }))}>
                  <option value="generate">文生图（输入描述生成）</option>
                  <option value="edit">图生图（必须上传图片）</option>
                  <option value="both">两者皆可</option>
                </Select>
              </Field>
              <Field label="画幅">
                <Select value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}>
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="一句话说明（展示给用户）">
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="这个模板会做出什么样的图" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="提示词（模板全文，生图时作为主提示词，用户补充要求会附在末尾）">
                <Textarea
                  value={form.prompt}
                  onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                  rows={12}
                  placeholder="写下完整的风格提示词…"
                />
              </Field>
              <p className="mt-1 text-right text-[11px] text-slate-300">{form.prompt.length} / 20000 字</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Toggle checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
                启用（用户可见）
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={cancelForm}>
                  取消
                </Button>
                <Button variant="primary" onClick={saveForm} disabled={saving}>
                  {saving ? "保存中…" : editingId ? "保存修改" : "创建模板"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
