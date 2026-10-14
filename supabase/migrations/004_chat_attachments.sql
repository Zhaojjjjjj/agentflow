-- 004: chat attachments (files produced by Luna skills)
create table if not exists chat_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  message_id uuid references chat_messages(id) on delete cascade,
  filename text not null,
  mime_type text not null default 'application/octet-stream',
  content_text text not null,
  preview_svg text,
  size_bytes int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_att_conv on chat_attachments(conversation_id);
create index if not exists idx_chat_att_msg on chat_attachments(message_id);
