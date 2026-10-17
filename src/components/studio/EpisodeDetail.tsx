"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { Button, Badge, PageHeader, Skeleton, EmptyState } from "@/components/ui";
import { toast } from "@/components/toast";

interface Episode {
  id: string;
  number: number;
  title: string;
  outline: string;
  content: string;
  summary: string;
  word_count: number;
  status: string;
}

interface Job {
  id: string;
  stage: string;
  stageLabel: string;
  status: string;
  progress: string;
  error: string;
}

const STAGE_ORDER = ["queued", "context", "outline", "outline_review", "drafting", "review", "memorize", "done"];

export default function EpisodeDetail({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [outlineDraft, setOutlineDraft] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const [er, jr] = await Promise.all([
      fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}`),
      fetch(`/api/studio/projects/${projectId}/episodes/${episodeId}/job`),
    ]);
    if (er.ok) {
      const j = await er.json();
      setEpisode(j.episode);
      setOutlineDraft((prev) => (editing ? prev : j.episode.outline || ""));
    }
    if (jr.ok) {
      const j = await jr.json();
      setJob(j.job);
    }
    setLoading(false);
  }, [projectId, episodeId, editing]);

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
    if (!confirm("确定取消这次写作任务吗？")) return;
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

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-2">
          <Link href={`/studio/${projectId}`} className="text-sm text-slate-400 hover:text-slate-600">← 返回作品</Link>
        </div>
        <PageHeader
          title={episode.title || `第 ${episode.number} 集`}
          desc={episode.word_count > 0 ? `共 ${episode.word_count} 字` : "写作中"}
          actions={
            <div className="flex gap-2">
              {jobRunning && (
                <Button variant="secondary" size="sm" disabled={acting} onClick={cancelJob}>取消任务</Button>
              )}
              {job?.status === "succeeded" && episode.status !== "published" && episode.content && (
                <Button variant="primary" size="sm" disabled={acting} onClick={publish}>发布本集</Button>
              )}
              {episode.status === "published" && <Badge tone="green">已发布</Badge>}
            </div>
          }
        />

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
              <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                {episode.outline || "大纲生成中…"}
              </pre>
            )}
          </div>
        )}

        {/* 大纲（非审稿态也展示） */}
        {!needReview && episode.outline && (
          <details className="card mb-6 p-5">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">本集大纲</summary>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{episode.outline}</pre>
          </details>
        )}

        {/* 正文 */}
        <div className="card p-6 md:p-8">
          <h3 className="mb-4 font-semibold text-slate-900">正文</h3>
          {episode.content ? (
            <article className="prose-studio whitespace-pre-wrap text-[15px] leading-8 text-slate-800">
              {episode.content}
            </article>
          ) : (
            <p className="text-sm text-slate-400">
              {jobRunning ? "正文还在写，稍后再来。" : "还没有正文。"}
            </p>
          )}
        </div>

        {episode.summary && (
          <div className="card mt-6 p-5">
            <h3 className="mb-2 text-sm font-medium text-slate-700">剧情摘要（记忆用）</h3>
            <p className="text-sm leading-7 text-slate-500">{episode.summary}</p>
          </div>
        )}
      </main>
    </>
  );
}
