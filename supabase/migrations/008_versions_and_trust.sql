-- 008_versions_and_trust.sql
-- 1) 单集版本历史：正文/大纲被覆盖（重写、编辑、流水线产出）前先存档，可恢复。
-- 2) 信任模式：作品级开关，大纲生成后自动通过、跳过人工审稿。

create table if not exists episode_versions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  outline text not null default '',
  content text not null default '',
  summary text not null default '',
  word_count int not null default 0,
  source text not null default 'pipeline'
    check (source in ('pipeline', 'edit', 'retry', 'restore', 'redraft')),
  created_at timestamptz not null default now()
);
create index if not exists idx_episode_versions_episode
  on episode_versions(episode_id, created_at desc);

alter table story_projects
  add column if not exists auto_approve_outline boolean not null default false;
