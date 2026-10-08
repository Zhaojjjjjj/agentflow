-- ============================================================
-- agentflow schema — run this in the Supabase SQL editor
-- Requires the pgvector extension (available on Supabase free tier)
-- ============================================================

create extension if not exists "vector";
create extension if not exists "pgcrypto";

-- Workflows: visual definitions stored as JSON (nodes/edges)
create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  definition jsonb not null default '{"nodes":[],"edges":[]}',
  version int not null default 1,
  is_published boolean not null default false,
  schedule_cron text,
  schedule_enabled boolean not null default false,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable version snapshots
create table if not exists workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  version int not null,
  definition jsonb not null,
  note text default '',
  created_at timestamptz not null default now(),
  unique (workflow_id, version)
);

-- Execution records
create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  trigger text not null default 'manual', -- manual | schedule | api | webhook
  status text not null default 'queued',   -- queued | running | waiting_approval | succeeded | failed | rejected | cancelled
  input jsonb not null default '{}',
  output jsonb,
  total_tokens int not null default 0,
  estimated_cost_usd numeric not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_runs_workflow on workflow_runs (workflow_id, created_at desc);
create index if not exists idx_runs_status on workflow_runs (status);

-- Per-node execution trace
create table if not exists run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references workflow_runs(id) on delete cascade,
  node_id text not null,               -- loop sub-nodes are stored as "loopId/subNodeId"
  node_type text not null,
  node_name text default '',
  attempt int not null default 0,
  status text not null default 'pending', -- pending | running | succeeded | failed | skipped | waiting_approval
  input jsonb,
  output jsonb,
  tokens int not null default 0,
  cost_usd numeric not null default 0,
  duration_ms int,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_steps_run on run_steps (run_id, created_at);

-- API keys for the public run endpoint (only hashes are stored)
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  workflow_id uuid references workflows(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- RAG document chunks with embeddings
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references workflows(id) on delete cascade,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists idx_documents_workflow on documents (workflow_id);
-- NOTE: if you use an embedding model with dimensions != 1536,
-- change the vector size above and recreate this index.
create index if not exists idx_documents_embedding
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Cosine-similarity search over a workflow's documents
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int,
  filter_workflow_id uuid,
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
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.workflow_id = filter_workflow_id
    and documents.embedding is not null
    and 1 - (documents.embedding <=> query_embedding) >= min_similarity
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
