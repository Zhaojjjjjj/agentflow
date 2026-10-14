-- 003: chat + nicknames + app settings
-- - users.nickname (user-editable display name)
-- - app_settings key-value store (chat model config, system prompt, ...)
-- - chat_conversations / chat_messages per user

alter table users
  add column if not exists nickname text;

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default '新的对话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_chat_conv_user on chat_conversations(user_id, updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_msg_conv on chat_messages(conversation_id, created_at);

-- 每日 AI 生成的推荐问题池（每天一批）
create table if not exists chat_suggestions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  day date not null default CURRENT_DATE,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_sugg_day on chat_suggestions(day);
