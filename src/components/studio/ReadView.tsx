"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { Input, Skeleton, EmptyState, Markdown } from "@/components/ui";

interface ReadEpisode {
  id: string;
  number: number;
  title: string;
  content: string;
  word_count: number;
  status: string;
}

export default function ReadView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<{ title: string; kind: string; genre: string } | null>(null);
  const [episodes, setEpisodes] = useState<ReadEpisode[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/studio/projects/${projectId}/read`);
      if (res.ok) {
        const j = await res.json();
        setProject(j.project);
        setEpisodes(j.episodes ?? []);
        setTotalWords(j.totalWords ?? 0);
      }
      setLoading(false);
    })();
  }, [projectId]);

  // 全文搜索：统计每集命中次数
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits(null);
      return;
    }
    const t = setTimeout(() => {
      const map: Record<string, number> = {};
      for (const ep of episodes) {
        const count = ep.content.split(q).length - 1 + (ep.title.includes(q) ? 1 : 0);
        if (count > 0) map[ep.id] = count;
      }
      setHits(map);
    }, 250);
    return () => clearTimeout(t);
  }, [query, episodes]);

  const visible = useMemo(
    () => (hits ? episodes.filter((e) => hits[e.id]) : episodes),
    [hits, episodes]
  );
  const totalHits = hits ? Object.values(hits).reduce((a, b) => a + b, 0) : 0;

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-3xl px-6 py-8"><Skeleton rows={8} /></main>
      </>
    );
  }
  if (!project) return null;

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-2">
          <Link href={`/studio/${projectId}`} className="text-sm text-slate-400 hover:text-slate-600">← 返回作品</Link>
        </div>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {project.kind === "drama" ? "网剧剧本" : "长篇小说"} · 共 {episodes.length} 集 · 全文 {totalWords.toLocaleString()} 字
            </p>
          </div>
          <div className="w-56">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="全文搜索（如人名、地名）" />
            {hits && <p className="mt-1 text-xs text-slate-400">命中 {totalHits} 处，分布在 {visible.length} 集</p>}
          </div>
        </div>

        {episodes.length === 0 ? (
          <EmptyState title="还没有可读的剧集" description="先写完一集，这里就能从头连读。" />
        ) : visible.length === 0 ? (
          <EmptyState title="没有命中" description="换个关键词试试。" />
        ) : (
          <div className="space-y-14">
            {visible.map((ep) => (
              <section key={ep.id} id={`ep-${ep.number}`}>
                <div className="mb-4 flex items-baseline gap-3 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {ep.title ? `第 ${ep.number} 集 ${ep.title}` : `第 ${ep.number} 集`}
                  </h2>
                  <span className="text-xs text-slate-400">{ep.word_count} 字</span>
                  {hits && <span className="text-xs text-brand-600">命中 {hits[ep.id]} 处</span>}
                  <Link href={`/studio/${projectId}/episodes/${ep.id}`} className="ml-auto text-xs text-slate-400 hover:text-slate-600">
                    打开本集 →
                  </Link>
                </div>
                <Markdown text={ep.content} />
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
