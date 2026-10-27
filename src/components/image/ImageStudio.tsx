"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Textarea } from "@/components/ui";
import { toast } from "@/components/toast";
import { useEscapeClose } from "@/components/ui";

interface Template {
  id: string;
  name: string;
  description: string;
  mode: "generate" | "edit" | "both";
  size: string;
}

interface Job {
  id: string;
  template_name: string;
  mode: "generate" | "edit";
  user_prompt: string;
  source_url: string;
  size: string;
  status: "running" | "succeeded" | "failed";
  progress: string;
  result_url: string;
  error: string;
  created_at: string;
}

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "方形" },
  { value: "1024x1536", label: "竖版" },
  { value: "1536x1024", label: "横版" },
];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ImageStudio() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplError, setTplError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null); // null = 自由创作
  const [freeMode, setFreeMode] = useState<"generate" | "edit">("generate");
  const [freeSize, setFreeSize] = useState("1024x1024");
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState<{ url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lightbox, setLightbox] = useState<Job | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEscapeClose(!!lightbox, () => setLightbox(null));

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const effectiveMode: "generate" | "edit" = selected
    ? selected.mode === "both"
      ? source
        ? "edit"
        : "generate"
      : selected.mode
    : freeMode;
  const needsUpload = selected ? selected.mode !== "generate" : freeMode === "edit";
  const canUpload = selected ? selected.mode !== "generate" : true;

  const loadJobs = useCallback(async () => {
    try {
      const j = await fetch("/api/image/jobs").then((r) => r.json());
      if (Array.isArray(j.jobs)) setJobs(j.jobs);
    } catch {
      /* 轮询失败静默 */
    }
  }, []);

  useEffect(() => {
    fetch("/api/image/templates")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setTplError(j.error);
        else {
          setTemplates(j.templates ?? []);
          if ((j.templates ?? []).length > 0) setSelectedId(j.templates[0].id);
        }
      })
      .catch(() => setTplError("模板加载失败"));
    loadJobs();
  }, [loadJobs]);

  // 有运行中任务时轮询
  useEffect(() => {
    if (!jobs.some((j) => j.status === "running")) return;
    const t = setInterval(loadJobs, 3500);
    return () => clearInterval(t);
  }, [jobs, loadJobs]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/image/upload", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "上传失败");
      setSource({ url: j.url });
      if (!selected && freeMode === "generate") setFreeMode("edit");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (needsUpload && effectiveMode === "edit" && !source) {
      return toast.error("先上传一张图片");
    }
    if (!selected && !prompt.trim()) {
      return toast.error("写下你想生成的画面");
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/image/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected?.id,
          mode: effectiveMode,
          prompt: selected ? undefined : prompt.trim(),
          userPrompt: selected ? prompt.trim() : undefined,
          sourceUrl: effectiveMode === "edit" ? source?.url : undefined,
          size: selected ? undefined : freeSize,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "创建失败");
      toast.success("已开始生成，完成后会出现在下方作品里");
      setPrompt("");
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const removeJob = async (job: Job) => {
    const res = await fetch(`/api/image/jobs/${job.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("删除失败");
    setJobs((js) => js.filter((x) => x.id !== job.id));
    if (lightbox?.id === job.id) setLightbox(null);
  };

  const download = async (job: Job) => {
    try {
      const r = await fetch(job.result_url);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `agentflow-${job.id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(job.result_url, "_blank");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">生图</h1>
      <p className="mt-1 text-sm text-slate-500">选一个风格模板，写下画面就能生成；也可以上传照片，按模板把它编辑成设计作品。</p>

      {/* 模板库 */}
      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">风格模板</p>
        {tplError ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{tplError}</p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedId(null)}
              className={`w-44 shrink-0 rounded-2xl border p-4 text-left transition ${
                selectedId === null ? "border-[#7C3AED] bg-[#7C3AED]/[0.04] ring-1 ring-[#7C3AED]" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">自由创作</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">不用模板，自己写提示词生成或编辑。</p>
              <span className="mt-2.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">文生图 / 图生图</span>
            </button>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-52 shrink-0 rounded-2xl border p-4 text-left transition ${
                  selectedId === t.id ? "border-[#7C3AED] bg-[#7C3AED]/[0.04] ring-1 ring-[#7C3AED]" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">{t.description || "—"}</p>
                <span className="mt-2.5 inline-block rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[11px] font-medium text-[#7C3AED]">
                  {t.mode === "generate" ? "文生图" : t.mode === "edit" ? "上传照片编辑" : "文生图 / 图生图"}
                  {" · "}
                  {t.size === "1024x1024" ? "方形" : t.size === "1024x1536" ? "竖版" : "横版"}
                </span>
              </button>
            ))}
            {templates.length === 0 && (
              <p className="self-center text-sm text-slate-400">管理员还没有添加模板，可以先用自由创作。</p>
            )}
          </div>
        )}
      </div>

      {/* 创作区 */}
      <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row">
          {/* 上传区（需要时显示） */}
          {canUpload && (
            <div className="md:w-56 md:shrink-0">
              {source ? (
                <div className="group relative overflow-hidden rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={source.url} alt="原图" className="h-40 w-full object-cover md:h-full md:min-h-44" />
                  <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/55 to-transparent p-2.5 pt-8">
                    <button onClick={() => fileRef.current?.click()} className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white">
                      换一张
                    </button>
                    <button onClick={() => setSource(null)} className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white">
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onFile(e.dataTransfer.files?.[0]);
                  }}
                  className="flex h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 text-center transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/[0.03] md:h-full md:min-h-44"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-slate-400">
                    <path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  <span className="mt-2 text-sm font-medium text-slate-600">{uploading ? "上传中…" : "上传照片"}</span>
                  <span className="mt-0.5 text-xs text-slate-400">点击或拖进来，PNG / JPG，≤10MB</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              {selected?.mode === "both" && (
                <p className="mt-2 text-center text-[11px] text-slate-400">{source ? "已上传原图：将按模板编辑这张图" : "未上传原图：将按描述从零生成"}</p>
              )}
            </div>
          )}

          {/* 输入区 */}
          <div className="min-w-0 flex-1">
            {!selected && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 p-0.5">
                  {(["generate", "edit"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setFreeMode(m)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${freeMode === m ? "bg-[#7C3AED] text-white" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {m === "generate" ? "文生图" : "图生图"}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg border border-slate-200 p-0.5">
                  {SIZE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setFreeSize(o.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${freeSize === o.value ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selected && (
              <p className="mb-2.5 text-sm text-slate-600">
                模板：<span className="font-medium text-slate-900">{selected.name}</span>
                <span className="ml-2 text-xs text-slate-400">提示词已内置，不用自己写风格描述</span>
              </p>
            )}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={selected ? 3 : 4}
              placeholder={
                selected
                  ? effectiveMode === "edit"
                    ? "补充要求（可选）：比如地点名称、海报上想出现的英文标题…"
                    : "补充要求（可选）：想生成的具体画面内容…"
                  : freeMode === "edit"
                    ? "想怎么改这张图？比如：换成黄昏光线、改成水彩风格…"
                    : "描述你想要的画面，越具体越好…"
              }
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {effectiveMode === "edit" ? "将把你的照片交给生图模型按模板编辑" : "将按描述从零生成一张图"}
                {" · "}
                {selected ? (selected.size === "1024x1024" ? "方形" : selected.size === "1024x1536" ? "竖版" : "横版") : SIZE_OPTIONS.find((o) => o.value === freeSize)?.label}
              </p>
              <Button variant="primary" onClick={submit} disabled={submitting || uploading}>
                {submitting ? "提交中…" : "开始生成"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 作品 */}
      <div className="mt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">我的作品</p>
        {jobs.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
            还没有生成过图片，从上面选个模板开始吧。
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {jobs.map((job) => (
              <motion.div key={job.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className={`relative ${job.size === "1024x1536" ? "aspect-[2/3]" : job.size === "1536x1024" ? "aspect-[3/2]" : "aspect-square"} bg-slate-50`}>
                  {job.status === "succeeded" && job.result_url ? (
                    <button onClick={() => setLightbox(job)} className="block h-full w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={job.result_url} alt={job.template_name || "生成图"} className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ) : job.status === "running" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                      {job.source_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={job.source_url} alt="原图" className="absolute inset-0 h-full w-full object-cover opacity-25" />
                      )}
                      <span className="relative flex h-9 w-9 items-center justify-center">
                        <span className="absolute h-full w-full animate-spin rounded-full border-2 border-[#7C3AED]/20 border-t-[#7C3AED]" />
                        <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
                      </span>
                      <p className="relative text-xs text-slate-500">{job.progress}</p>
                      <p className="relative text-[11px] text-slate-300">生图通常需要 30 秒到 2 分钟</p>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                      <p className="text-sm font-medium text-red-500">生成失败</p>
                      <p className="line-clamp-4 text-[11px] leading-4 text-slate-400">{job.error}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{job.template_name || (job.mode === "edit" ? "图生图" : "自由创作")}</p>
                    <p className="text-[11px] text-slate-300">{fmtTime(job.created_at)}</p>
                  </div>
                  {job.status === "succeeded" && (
                    <button onClick={() => download(job)} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                      下载
                    </button>
                  )}
                  <button onClick={() => removeJob(job)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500">
                    删除
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 大图 */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.result_url} alt="生成图" className="max-h-[70vh] w-full rounded-lg object-contain" />
              <div className="mt-4 flex items-center justify-between gap-3 px-1 pb-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{lightbox.template_name || "自由创作"}</p>
                  {lightbox.user_prompt && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{lightbox.user_prompt}</p>}
                </div>
                <Button variant="primary" onClick={() => download(lightbox)} className="shrink-0">
                  下载原图
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
