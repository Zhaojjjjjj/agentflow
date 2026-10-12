-- ============================================================
-- 001_llm_providers.sql — LLM 供应商注册表
-- 在 Supabase SQL Editor 中执行（必须在 schema.sql 之后，
-- 本文件依赖 schema.sql 已创建的 pgcrypto 扩展）
-- ============================================================

-- LLM providers: chat + embedding vendors, API keys AES-256-GCM encrypted.
-- 明文 key 永不落库，加密密钥来自服务端环境变量 APP_ENCRYPTION_KEY。
create table if not exists llm_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('chat', 'embedding')),
  base_url text not null,
  api_key_encrypted text not null,
  model text not null,
  dimensions int,                       -- 仅 embedding 用（须与 documents.embedding 的向量维度一致，默认 1536）
  priority int not null default 0,      -- 同 kind 内按 priority 升序试错
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_llm_providers_kind on llm_providers (kind, priority);
