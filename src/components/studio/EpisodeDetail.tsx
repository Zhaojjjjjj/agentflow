"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { Button, Badge, PageHeader, Skeleton, EmptyState, Markdown } from "@/components/ui";
import { toast } from "@/components/toast";
import { confirmDialog } from "@/components/confirm";

interface Episode {
  id: string;
  number: number;
  title: string;
  outline: string;
  content: string;
  summary: string;
  word_count: number;
  status: string;
  cover_prompt: string;
  cover_url: string;
}

interface Job {
  id: string;
  stage: string;
  stageLabel: string;
  status: string;
  progress: string;
  error: string;
}

const STAGE_ORDER = ["queued", "context", "outline", "outline_review", "drafting", "review", "memorize", "cover", "done"];

/** 写作中的加载动画：实时阶段文案 + 打字机光标 + 墨水书写骨架线 */
function WritingLoader({ progress, stageLabel }: { progress?: string; stageLabel?: string }) {
  const lines = [100, 96, 98, 90, 94, 62];
  return (
    <div className="py-14">
      <p className="text-center text-sm font-medium text-slate-800">
        {progress || "AI 正在写作"}
        <span
          className="ml-1 inline-block h-[14px] w-[2px] bg-brand-600 align-[-2px]"
          style={{ animation: "cursor-blink 1.1s step-end infinite" }}
        />
      </p>
      {stageLabel && <p className="mt-1.5 text-center text-xs text-slate-400">{stageLabel}</p>}
      <div className="mx-auto mt-10 max-w-lg space-y-3.5 px-2">
        {lines.map((w, i) => (
          <div key={i} className="h-2.5 overflow-hidden rounded-full bg-slate-100" style={{ width: `${w}%` }}>
            <div
              className="h-full w-full origin-left rounded-full bg-slate-300/80"
              style={{ animation: `ink-fill 2.4s ease-in-out ${i * 0.32}s infinite` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EpisodeDetail({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [outlineDraft, setOutlineDraft] = useState("");
  const [acting, setActing] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState("");

  const load = useCallback(async () => {
    const [er, jr] = await Promise.all([
      fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}`),
      fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/job`),
    ]);
    if (er.ok) {
      const j = await er.json();
      setEpisode(j.episode);
      setOutlineDraft((prev) => (editing ? prev : j.episode.outline || ""));
      setContentDraft((prev) => (editingContent ? prev : j.episode.content || ""));
    }
    if (jr.ok) {
      const j = await jr.json();
      setJob(j.job);
    }
    setLoading(false);
  }, [projectId, episodeId, editing, editingContent]);

  useEffect(() => {
    void load();
  }, [load]);

  // 任务运行时轮询
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [job?.status, load]);

  const saveOutline = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline: outlineDraft }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "保存失败");
      toast.success("大纲已保存");
      setEditing(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setActing(false);
    }
  };

  const approveOutline = async () => {
    const outline = editing ? outlineDraft : episode?.outline || "";
    if (!outline.trim()) {
      toast.error("大纲为空");
      return;
    }
    setActing(true);
    try {
      if (editing) {
        const sr = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/outline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outline }),
        });
        if (!sr.ok) throw new Error("保存大纲失败");
        setEditing(false);
      }
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/outline`, {
        method: "PUT",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "审稿失败");
      toast.success("大纲已通过，开始扩写正文");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "审稿失败");
    } finally {
      setActing(false);
    }
  };

  const publish = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/publish`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "发布失败");
      toast.success("已发布");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发布失败");
    } finally {
      setActing(false);
    }
  };

  const cancelJob = async () => {
    const ok = await confirmDialog({ title: "取消这次写作任务？", confirmText: "取消任务" });
    if (!ok) return;
    setActing(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/publish`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "取消失败");
      toast.success("任务已取消");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取消失败");
    } finally {
      setActing(false);
    }
  };

  const retryEpisode = async () => {
    const ok = await confirmDialog({
      title: "重写本集？",
      message: "现有大纲和正文会被清空，重新开始写作。",
      confirmText: "重写",
      danger: true,
    });
    if (!ok) return;
    setActing(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/retry`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "重写失败");
      if (j.warning) toast.error(j.warning);
      else toast.success("已重新开始写作");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重写失败");
    } finally {
      setActing(false);
    }
  };

  const deleteEpisode = async () => {
    const ok = await confirmDialog({
      title: "删除本集？",
      message: "此操作不可恢复。",
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    setActing(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "删除失败");
      toast.success("已删除");
      window.location.href = `/studio/${projectId}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setActing(false);
    }
  };

  const uploadCover = async (file: File) => {
    setActing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/cover`, {
        method: "POST",
        body: form,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "上传失败");
      toast.success("封面已上传");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setActing(false);
    }
  };

  const deleteCover = async () => {
    const ok = await confirmDialog({ title: "移除本集封面？", confirmText: "移除", danger: true });
    if (!ok) return;
    setActing(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/cover`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "移除失败");
      toast.success("封面已移除");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "移除失败");
    } finally {
      setActing(false);
    }
  };

  const copyCoverPrompt = async () => {
    if (!episode?.cover_prompt) return;
    try {
      await navigator.clipboard.writeText(episode.cover_prompt);
      toast.success("提示词已复制，去生图吧");
    } catch {
      toast.error("复制失败，请手动选择复制");
    }
  };

  const saveContent = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentDraft }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "保存失败");
      toast.success("正文已保存，摘要已同步更新");
      setEditingContent(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-4xl px-6 py-8"><Skeleton rows={8} /></main>
      </>
    );
  }
  if (!episode) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <EmptyState title="剧集不存在" description="可能已被删除。" />
        </main>
      </>
    );
  }

  const jobRunning = job?.status === "running";
  const needReview = jobRunning && job.stage === "outline_review";
  const stageIdx = STAGE_ORDER.indexOf(job?.stage ?? "");

  const hasContent = !!episode.content;

  const progressCard = (
    <>
{/* 写作进度 */}
        {job && (
          <div className="card mb-6 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">
                {job.status === "succeeded" ? "写作完成" : job.status === "failed" ? "写作失败" : job.status === "cancelled" ? "任务已取消" : "正在写作"}
              </p>
              <span className="text-xs text-slate-400">{job.stageLabel}</span>
            </div>
            {/* 阶段条 */}
            <div className="mt-3 flex gap-1">
              {STAGE_ORDER.map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full ${
                    job.status === "failed" ? "bg-red-200"
                    : i <= stageIdx ? "bg-brand-600"
                    : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-500">{job.progress}</p>
            {job.status === "failed" && job.error && (
              <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">{job.error}</p>
            )}
          </div>
        )}
    </>
  );

  const coverCard = (
    <>
{/* 封面 */}
        <div className="card mb-6 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">封面</h3>
            <div className="flex gap-2">
              <label className={`cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 ${acting ? "pointer-events-none opacity-50" : ""}`}>
                {episode.cover_url ? "更换封面" : "上传封面"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadCover(f);
                  }}
                />
              </label>
              {episode.cover_url && (
                <Button variant="secondary" size="sm" disabled={acting} onClick={deleteCover}>
                  <span className="text-red-600">移除</span>
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4">
            {episode.cover_url ? (
              <img src={episode.cover_url} alt="本集封面" className="h-40 w-28 rounded-xl border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-40 w-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                暂无封面
              </div>
            )}
            <div className="mt-3">
              {episode.cover_prompt ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">封面图提示词</summary>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{episode.cover_prompt}</p>
                    <button onClick={copyCoverPrompt} className="shrink-0 text-sm text-brand-600 hover:text-brand-700">
                      复制
                    </button>
                  </div>
                </details>
              ) : (
                <p className="text-sm text-slate-400">正文完成后自动生成，可复制去外部生图，再回来上传。</p>
              )}
            </div>
          </div>
        </div>
    </>
  );

  const outlineSection = (
    <>
{/* 大纲审稿 */}
        {needReview && (
          <div className="card mb-6 border-brand-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">大纲审稿</h3>
              <div className="flex gap-2">
                {!editing ? (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>修改大纲</Button>
                ) : (
                  <>
                    <Button variant="secondary" size="sm" disabled={acting} onClick={() => { setEditing(false); setOutlineDraft(episode.outline || ""); }}>取消</Button>
                    <Button variant="secondary" size="sm" disabled={acting} onClick={saveOutline}>保存修改</Button>
                  </>
                )}
                <Button variant="primary" size="sm" disabled={acting} onClick={approveOutline}>
                  {acting ? "处理中…" : "通过，开始写正文"}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">确认大纲无误后再继续，你也可以直接修改。AI 会严格按通过的大纲扩写。</p>
            {editing ? (
              <textarea
                className="mt-4 min-h-[320px] w-full rounded-xl border border-slate-200 p-4 font-mono text-sm leading-7 text-slate-800 focus:border-brand-400 focus:outline-none"
                value={outlineDraft}
                onChange={(e) => setOutlineDraft(e.target.value)}
              />
            ) : (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <Markdown text={episode.outline || "大纲生成中…"} />
              </div>
            )}
          </div>
        )}

        {/* 大纲（非审稿态也展示） */}
        {!needReview && episode.outline && (
          <details className="card mb-6 p-5">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">本集大纲</summary>
            <div className="mt-3">
              <Markdown text={episode.outline} />
            </div>
          </details>
        )}
    </>
  );

  const contentCard = (
    <>
{/* 正文 */}
        <div className="card p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">正文</h3>
            {episode.content && !jobRunning && !editingContent && (
              <Button variant="secondary" size="sm" onClick={() => setEditingContent(true)}>编辑正文</Button>
            )}
            {editingContent && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={acting} onClick={() => { setEditingContent(false); setContentDraft(episode.content || ""); }}>取消</Button>
                <Button variant="primary" size="sm" disabled={acting} onClick={saveContent}>
                  {acting ? "保存中…" : "保存"}
                </Button>
              </div>
            )}
          </div>
          {editingContent ? (
            <>
              <textarea
                className="min-h-[480px] w-full rounded-xl border border-slate-200 p-4 text-[15px] leading-8 text-slate-800 focus:border-brand-400 focus:outline-none"
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
              />
              <p className="mt-2 text-xs text-slate-400">保存后会自动更新字数，并同步刷新本集的剧情摘要（供下一集前情检索用）。</p>
            </>
          ) : episode.content ? (
            <Markdown text={episode.content} />
          ) : jobRunning ? (
            <WritingLoader progress={job?.progress} stageLabel={job?.stageLabel} />
          ) : (
            <p className="text-sm text-slate-400">还没有正文。</p>
          )}
        </div>
    </>
  );

  const summaryCard = (
    <>
{episode.summary && (
          <details className="card mb-6 p-5">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">剧情摘要（记忆用）</summary>
            <p className="mt-3 text-sm leading-7 text-slate-600">{episode.summary}</p>
          </details>
        )}
    </>
  );

  return (
    <>
      <TopNav />
      <main className={`mx-auto px-6 py-8 ${hasContent ? "max-w-6xl" : "max-w-4xl"}`}>
        <div className="mb-2">
          <Link href={`/studio/${projectId}`} className="text-sm text-slate-400 hover:text-slate-600">← 返回作品</Link>
        </div>
        <PageHeader
          title={episode.title || `第 ${episode.number} 集`}
          desc={episode.word_count > 0 ? `共 ${episode.word_count} 字` : "写作中"}
          actions={
            <div className="flex gap-2">
              {!jobRunning && (
                <Button variant="secondary" size="sm" disabled={acting} onClick={retryEpisode}>重新写</Button>
              )}
              {jobRunning && (
                <Button variant="secondary" size="sm" disabled={acting} onClick={cancelJob}>取消任务</Button>
              )}
              {job?.status === "succeeded" && episode.status !== "published" && episode.content && (
                <Button variant="primary" size="sm" disabled={acting} onClick={publish}>发布本集</Button>
              )}
              {episode.status === "published" && <Badge tone="green">已发布</Badge>}
              <Button variant="secondary" size="sm" disabled={acting} onClick={deleteEpisode}>
                <span className="text-red-600">删除本集</span>
              </Button>
            </div>
          }
        />

        {hasContent ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">{contentCard}</div>
            <aside className="min-w-0">
              {progressCard}
              {coverCard}
              {outlineSection}
              {summaryCard}
            </aside>
          </div>
        ) : (
          <>
            {progressCard}
            {coverCard}
            {outlineSection}
            {contentCard}
            {summaryCard}
          </>
        )}
      </main>
    </>
  );
}
