-- ============================================================
-- AgentFlow Studio：连载创作域（小说 / 网剧剧本）
-- 多用户：作品归 owner 所有
-- ============================================================

-- 作品
create table if not exists story_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('novel', 'drama')),
  genre text not null default '',
  premise text not null default '',
  worldview text not null default '',
  style_notes text not null default '',
  episode_target_words int not null default 2500,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_story_projects_owner on story_projects(owner_id);

-- 人物卡
create table if not exists story_characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references story_projects(id) on delete cascade,
  name text not null,
  role text not null default '',
  profile text not null default '',
  personality text not null default '',
  relationships text not null default '',
  current_state text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_story_characters_project on story_characters(project_id);

-- 集（小说章节 / 剧本集）
create table if not exists episodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references story_projects(id) on delete cascade,
  number int not null,
  title text not null default '',
  outline text not null default '',
  content text not null default '',
  summary text not null default '',
  structure jsonb not null default '{}',  -- 剧本用：场次/分镜结构；小说可空
  word_count int not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'reviewing', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);
create index if not exists idx_episodes_project on episodes(project_id);

-- 伏笔
create table if not exists plot_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references story_projects(id) on delete cascade,
  description text not null,
  planted_episode int,
  resolved_episode int,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists idx_plot_threads_project on plot_threads(project_id);

-- 记忆向量库：剧情摘要 / 设定（前情检索用）
create table if not exists story_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references story_projects(id) on delete cascade,
  kind text not null check (kind in ('episode_summary', 'setting', 'character')),
  ref_id uuid,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(1024),
  created_at timestamptz not null default now()
);
create index if not exists idx_story_documents_project on story_documents(project_id);
create index if not exists idx_story_documents_embedding
  on story_documents using ivfflat (embedding vector_cosine_ops);

create or replace function match_story_documents(
  query_embedding vector(1024),
  match_count int,
  filter_project_id uuid,
  min_similarity float default 0
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    story_documents.id,
    story_documents.content,
    story_documents.metadata,
    1 - (story_documents.embedding <=> query_embedding) as similarity
  from story_documents
  where story_documents.project_id = filter_project_id
    and story_documents.embedding is not null
    and 1 - (story_documents.embedding <=> query_embedding) >= min_similarity
  order by story_documents.embedding <=> query_embedding
  limit match_count;
$$;

-- 生成任务（长任务跟踪：写一集的异步进度）
create table if not exists episode_jobs (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  stage text not null default 'queued',
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  progress text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_episode_jobs_episode on episode_jobs(episode_id);
