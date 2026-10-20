"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { Button, EmptyState, Field, Input, Textarea, Select, Badge, PageHeader, Skeleton, ConfirmDialog, useEscapeClose } from "@/components/ui";
import { toast } from "@/components/toast";
import { confirmDialog } from "@/components/confirm";

interface Project {
  id: string;
  title: string;
  kind: "novel" | "drama";
  genre: string;
  premise: string;
  worldview: string;
  style_notes: string;
  episode_target_words: number;
  status: string;
  updated_at: string;
}
interface Episode {
  id: string;
  number: number;
  title: string;
  word_count: number;
  status: string;
}
interface Character {
  id: string;
  name: string;
  role: string;
  profile: string;
  personality: string;
  relationships: string;
  current_state: string;
}
interface Thread {
  id: string;
  description: string;
  planted_episode: number | null;
  resolved_episode: number | null;
  status: string;
}

const TABS = [
  { id: "episodes", label: "连载" },
  { id: "characters", label: "人物" },
  { id: "threads", label: "伏笔" },
  { id: "settings", label: "设定" },
] as const;

const EP_STATUS: Record<string, [string, "gray" | "amber" | "green"]> = {
  draft: ["草稿", "gray"],
  reviewing: ["待审", "amber"],
  published: ["已发布", "green"],
};

function AddCharacter({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [profile, setProfile] = useState("");
  const [busy, setBusy] = useState(false);
  useEscapeClose(open, () => setOpen(false));
  const submit = async () => {
    if (!name.trim()) return toast.error("请填写人物姓名");
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role, profile }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "创建失败");
      setOpen(false);
      setName(""); setRole(""); setProfile("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>添加人物</Button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">添加人物</h3>
            <div className="mt-4">
              <Field label="姓名"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="比如：沈夜" /></Field>
              <Field label="定位"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="比如：主角 / 反派 / 配角" /></Field>
              <Field label="小传"><Textarea rows={4} value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="背景、性格、目标……" /></Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>取消</Button>
              <Button variant="primary" size="sm" disabled={busy} onClick={submit}>添加</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AddThread({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  useEscapeClose(open, () => setOpen(false));
  const submit = async () => {
    if (!desc.trim()) return toast.error("请填写伏笔内容");
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "创建失败");
      setOpen(false); setDesc("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>登记伏笔</Button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">登记伏笔</h3>
            <div className="mt-4">
              <Field label="伏笔内容" hint="埋了什么钩子，之后在哪回收">
                <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="比如：沈夜的怀表里藏着一张撕碎的照片……" />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>取消</Button>
              <Button variant="primary" size="sm" disabled={busy} onClick={submit}>登记</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


const SETTINGS_GENRES = ["玄幻", "都市", "悬疑", "科幻", "言情", "历史", "奇幻", "现实题材", "其他"];

/** 设定 tab：受控表单，双栏（基本信息 / 创作设定），有改动才允许保存 */
function SettingsForm({ projectId, project, onSaved }: { projectId: string; project: Project; onSaved: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [genre, setGenre] = useState(project.genre || SETTINGS_GENRES[1]);
  const [words, setWords] = useState(project.episode_target_words || 2500);
  const [premise, setPremise] = useState(project.premise);
  const [worldview, setWorldview] = useState(project.worldview);
  const [style, setStyle] = useState(project.style_notes);
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== project.title ||
    genre !== (project.genre || SETTINGS_GENRES[1]) ||
    words !== (project.episode_target_words || 2500) ||
    premise !== project.premise ||
    worldview !== project.worldview ||
    style !== project.style_notes;

  const save = async () => {
    if (!title.trim()) return toast.error("作品标题不能为空");
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), genre, premise, worldview, style_notes: style, episode_target_words: words }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "保存失败");
      toast.success("已保存");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h3 className="mb-5 font-semibold text-slate-900">基本信息</h3>
        <div className="space-y-5">
          <Field label="作品标题">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </Field>
          <Field label="类型">
            <div>
              <Badge tone={project.kind === "drama" ? "purple" : "gray"}>{project.kind === "drama" ? "网剧剧本" : "长篇小说"}</Badge>
              <span className="ml-2 text-xs text-slate-400">创建后不可更改（影响生成结构）</span>
            </div>
          </Field>
          <Field label="题材">
            <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
              {SETTINGS_GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </Field>
          <Field label={`单集目标字数：${words} 字`} hint="下一集起生效">
            <input
              type="range" min={800} max={8000} step={100} value={words}
              onChange={(e) => setWords(Number(e.target.value))}
              className="w-full accent-[#7C3AED]"
            />
          </Field>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="mb-5 font-semibold text-slate-900">创作设定</h3>
        <div className="space-y-5">
          <Field label="故事梗概" hint="一句话或一段话：这个故事讲什么">
            <Textarea rows={4} value={premise} onChange={(e) => setPremise(e.target.value)} />
          </Field>
          <Field label="世界观设定" hint="时代、地点、规则，越具体连载越稳">
            <Textarea rows={4} value={worldview} onChange={(e) => setWorldview(e.target.value)} />
          </Field>
          <Field label="风格要求" hint="可选：语言风格、节奏、视角">
            <Textarea rows={3} value={style} onChange={(e) => setStyle(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 lg:col-span-2">
        {dirty && <span className="text-xs text-slate-400">有未保存的修改</span>}
        <Button variant="primary" disabled={!dirty || saving} onClick={save}>
          {saving ? "保存中…" : "保存设定"}
        </Button>
      </div>
    </div>
  );
}


function CharacterEditor({ projectId, character, onDone }: { projectId: string; character: Character; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(character.name);
  const [role, setRole] = useState(character.role || "");
  const [profile, setProfile] = useState(character.profile || "");
  const [state, setState] = useState(character.current_state || "");
  const [busy, setBusy] = useState(false);
  useEscapeClose(open, () => setOpen(false));
  const submit = async () => {
    if (!name.trim()) return toast.error("请填写人物姓名");
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role, profile, current_state: state }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "保存失败");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setOpen(true)}>编辑</button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">编辑人物</h3>
            <div className="mt-4">
              <Field label="姓名"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="定位"><Input value={role} onChange={(e) => setRole(e.target.value)} /></Field>
              <Field label="小传"><Textarea rows={4} value={profile} onChange={(e) => setProfile(e.target.value)} /></Field>
              <Field label="当前状态" hint="手动修正 AI 记忆的人物状态"><Input value={state} onChange={(e) => setState(e.target.value)} placeholder="比如：第 3 集后已离开雾港" /></Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>取消</Button>
              <Button variant="primary" size="sm" disabled={busy} onClick={submit}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("episodes");
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [jobs, setJobs] = useState<Record<string, { stage: string; stageLabel: string; status: string; progress: string }>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/studio/projects/${projectId}`);
    if (res.status === 404) {
      router.replace("/");
      return;
    }
    const j = await res.json();
    if (res.ok) setProject(j.project);
    const [e, c, t, jb] = await Promise.all([
      fetch(`/api/studio/projects/${projectId}/episodes`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/studio/projects/${projectId}/characters`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/studio/projects/${projectId}/threads`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/studio/projects/${projectId}/episode-jobs`).then((r) => r.json()).catch(() => ({})),
    ]);
    if (e.episodes) setEpisodes(e.episodes);
    if (c.characters) setCharacters(c.characters);
    if (t.threads) setThreads(t.threads);
    if (jb.jobs) setJobs(jb.jobs);
    setLoading(false);
  }, [projectId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasRunning = Object.values(jobs).some((j) => j.status === "running");
  useEffect(() => {
    if (!hasRunning) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/studio/projects/${projectId}/episode-jobs`).then((x) => x.json()).catch(() => ({}));
      if (r.jobs) setJobs(r.jobs);
    }, 4000);
    return () => clearInterval(t);
  }, [hasRunning, projectId]);

  const writeNext = async () => {
    setWriting(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/episodes`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "创建失败");
      if (j.warning) toast.error(j.warning);
      else toast.success(`第 ${j.number} 集已加入写作队列`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setWriting(false);
    }
  };

  const removeProject = async () => {
    const res = await fetch(`/api/studio/projects/${projectId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "删除失败");
      return;
    }
    router.replace("/");
  };

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-6xl px-6 py-8"><Skeleton rows={6} /></main>
      </>
    );
  }
  if (!project) return null;

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-2">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">← 工作室</Link>
        </div>
        <PageHeader
          title={project.title}
          desc={`${project.kind === "drama" ? "网剧剧本" : "长篇小说"}${project.genre ? ` · ${project.genre}` : ""} · 单集约 ${project.episode_target_words} 字`}
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleting(true)}>删除作品</Button>
              <Button variant="primary" disabled={writing} onClick={writeNext}>
                {writing ? "创建中…" : episodes.length === 0 ? "写第一集" : "写下一集"}
              </Button>
            </div>
          }
        />

        <div className="mb-6 flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
                tab === t.id
                  ? "border-brand-600 font-medium text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {t.id === "episodes" && episodes.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{episodes.length}</span>}
              {t.id === "characters" && characters.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{characters.length}</span>}
              {t.id === "threads" && threads.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{threads.filter((x) => x.status === "open").length}</span>}
            </button>
          ))}
        </div>

        {tab === "episodes" && (
          episodes.length === 0 ? (
            <EmptyState title="还没有任何一集" description="点右上角「写第一集」，定下大纲开始连载。" />
          ) : (
            <div className="space-y-3">
              {episodes.map((e) => {
                const [label, tone] = EP_STATUS[e.status] ?? ["草稿", "gray"];
                const job = jobs[e.id];
                const jobActive = job && job.status === "running";
                return (
                  <Link key={e.id} href={`/studio/${projectId}/episodes/${e.id}`} className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-md">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
                      {e.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{e.title || `第 ${e.number} 集`}</p>
                      {job && job.status === "failed" ? (
                        <p className="text-xs text-red-500">写作失败：{job.progress || "点进详情查看"} — 点击可重写</p>
                      ) : (
                        <p className="text-xs text-slate-400">
                          {jobActive ? `${job.stageLabel}… ${job.progress}` : e.word_count > 0 ? `${e.word_count} 字` : "未成稿"}
                        </p>
                      )}
                    </div>
                    {jobActive && job.stage === "outline_review" ? (
                      <Badge tone="amber">待审稿</Badge>
                    ) : (
                      <Badge tone={tone}>{label}</Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          )
        )}

        {tab === "characters" && (
          <>
            <div className="mb-4 flex justify-end"><AddCharacter projectId={projectId} onDone={() => void load()} /></div>
            {characters.length === 0 ? (
              <EmptyState title="还没有人物" description="先立住几个人物，连载才不会走形。" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {characters.map((c) => (
                  <div key={c.id} className="card group p-5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      {c.role && <Badge tone="gray">{c.role}</Badge>}
                      <div className="ml-auto flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <CharacterEditor projectId={projectId} character={c} onDone={() => void load()} />
                        <button
                          className="text-xs text-red-500 hover:text-red-600"
                          onClick={async () => {
                            const ok = await confirmDialog({ title: `删除人物「${c.name}」？`, message: "后续写作将不再参考这个人物。", confirmText: "删除", danger: true });
                            if (!ok) return;
                            const res = await fetch(`/api/studio/projects/${projectId}/characters/${c.id}`, { method: "DELETE" });
                            if (res.ok) { toast.success("已删除"); void load(); } else toast.error("删除失败");
                          }}
                        >删除</button>
                      </div>
                    </div>
                    {c.profile && <p className="mt-2 text-sm leading-6 text-slate-600">{c.profile}</p>}
                    {c.current_state && <p className="mt-2 text-xs text-slate-400">当前状态：{c.current_state}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "threads" && (
          <>
            <div className="mb-4 flex justify-end"><AddThread projectId={projectId} onDone={() => void load()} /></div>
            {threads.length === 0 ? (
              <EmptyState title="还没有伏笔" description="埋下的钩子都记在这里，回收时不会忘。" />
            ) : (
              <div className="space-y-3">
                {threads.map((t) => (
                  <div key={t.id} className="card flex items-start gap-3 p-4">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${t.status === "open" ? "bg-amber-400" : "bg-green-500"}`} />
                    <div className="flex-1">
                      <p className="text-sm leading-6 text-slate-800">{t.description}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {t.planted_episode ? `埋于第 ${t.planted_episode} 集` : "未指定集数"}
                        {t.status === "resolved" && t.resolved_episode ? ` · 回收于第 ${t.resolved_episode} 集` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={t.status === "open" ? "amber" : "green"}>{t.status === "open" ? "未回收" : "已回收"}</Badge>
                      <button
                        className="text-xs text-slate-500 hover:text-slate-700"
                        onClick={async () => {
                          const next = t.status === "open" ? "resolved" : "open";
                          const res = await fetch(`/api/studio/projects/${projectId}/threads/${t.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: next }),
                          });
                          if (res.ok) void load(); else toast.error("操作失败");
                        }}
                      >{t.status === "open" ? "标记回收" : "重新打开"}</button>
                      <button
                        className="text-xs text-red-500 hover:text-red-600"
                        onClick={async () => {
                          const ok = await confirmDialog({ title: "删除这条伏笔？", confirmText: "删除", danger: true });
                          if (!ok) return;
                          const res = await fetch(`/api/studio/projects/${projectId}/threads/${t.id}`, { method: "DELETE" });
                          if (res.ok) { toast.success("已删除"); void load(); } else toast.error("删除失败");
                        }}
                      >删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "settings" && (
          <SettingsForm key={project.updated_at} projectId={projectId} project={project} onSaved={() => void load()} />
        )}
      </main>
      <ConfirmDialog
        open={deleting}
        title="删除作品？"
        description={`「${project.title}」的全部集数、人物、伏笔和记忆都会被删除，无法恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => void removeProject()}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}
