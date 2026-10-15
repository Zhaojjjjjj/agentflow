"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { Button, EmptyState, Field, Input, Textarea, Select, Badge, PageHeader, Skeleton } from "@/components/ui";
import { toast } from "@/components/toast";

interface Project {
  id: string;
  title: string;
  kind: "novel" | "drama";
  genre: string;
  status: string;
  episode_target_words: number;
  episode_count: number;
  updated_at: string;
}

const GENRES = ["玄幻", "都市", "悬疑", "科幻", "言情", "历史", "奇幻", "现实题材", "其他"];

function NewProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"novel" | "drama">("novel");
  const [genre, setGenre] = useState(GENRES[1]);
  const [premise, setPremise] = useState("");
  const [worldview, setWorldview] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [words, setWords] = useState(2500);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("请填写作品标题");
    setBusy(true);
    try {
      const res = await fetch("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          kind,
          genre,
          premise,
          worldview,
          style_notes: styleNotes,
          episode_target_words: words,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "创建失败");
      onCreated(j.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">新建作品</h3>
        <p className="mt-1 text-sm text-slate-500">先定下世界观和风格，之后每一集都会沿着它往下写。</p>
        <div className="mt-5 space-y-4">
          <Field label="作品标题">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="比如：雾港夜行" maxLength={60} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="类型">
              <div className="flex gap-2">
                {(["novel", "drama"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      kind === k ? "border-brand-500 bg-brand-50 text-brand-700 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {k === "novel" ? "长篇小说" : "网剧剧本"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="题材">
              <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="故事梗概" hint="一句话或一段话：这个故事讲什么">
            <Textarea rows={3} value={premise} onChange={(e) => setPremise(e.target.value)} placeholder="比如：雨夜的雾港，一个失忆的调酒师发现每杯酒都藏着客人的记忆……" />
          </Field>
          <Field label="世界观设定" hint="时代、地点、规则，越具体连载越稳">
            <Textarea rows={3} value={worldview} onChange={(e) => setWorldview(e.target.value)} placeholder="比如：近未来的港口城市，记忆可以被提取、交易，黑市流通……" />
          </Field>
          <Field label="风格要求" hint="可选：语言风格、节奏、视角">
            <Textarea rows={2} value={styleNotes} onChange={(e) => setStyleNotes(e.target.value)} placeholder="比如：冷峻克制，多用短句，第一人称，悬疑感拉满" />
          </Field>
          <Field label={`单集目标字数：${words} 字`}>
            <input
              type="range" min={800} max={8000} step={100} value={words}
              onChange={(e) => setWords(Number(e.target.value))}
              className="w-full accent-[#7C3AED]"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={busy} onClick={submit}>{busy ? "创建中…" : "开始创作"}</Button>
        </div>
      </div>
    </div>
  );
}

export default function StudioHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/projects");
      const j = await res.json();
      if (res.ok) setProjects(j.projects ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const open = () => setModalOpen(true);
    window.addEventListener("agentflow:create-project", open);
    return () => window.removeEventListener("agentflow:create-project", open);
  }, [load]);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader
          title="创作工作室"
          desc="小说与网剧剧本，一集一集往下写"
          actions={
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              新建作品
            </Button>
          }
        />
        {loading ? (
          <Skeleton rows={4} />
        ) : projects.length === 0 ? (
          <EmptyState
            title="还没有作品"
            description="创建第一部作品，定下世界观，然后一集一集写下去。"
            action={<Button variant="primary" onClick={() => setModalOpen(true)}>新建作品</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/studio/${p.id}`}
                className="card group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <Badge tone={p.kind === "drama" ? "purple" : "gray"}>{p.kind === "drama" ? "网剧剧本" : "长篇小说"}</Badge>
                  {p.genre && <span className="text-xs text-slate-400">{p.genre}</span>}
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-900 group-hover:text-brand-700">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  已写 {p.episode_count} 集 · 单集约 {p.episode_target_words} 字
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => {
          void load();
          window.location.href = `/studio/${id}`;
        }}
      />
    </>
  );
}
