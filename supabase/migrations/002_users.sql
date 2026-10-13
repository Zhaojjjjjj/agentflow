-- 002: multi-user accounts
-- - users table (admin seeded from ADMIN_USERNAME/ADMIN_PASSWORD on first login)
-- - workflows.owner_id for per-user isolation
-- - public avatars bucket

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  avatar_url text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

alter table workflows
  add column if not exists owner_id uuid references users(id) on delete set null;
create index if not exists idx_workflows_owner on workflows(owner_id);

-- avatars bucket (public read; uploads go through the server with the service key)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'avatars public read') then
    create policy "avatars public read" on storage.objects
      for select using (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'avatars service write') then
    create policy "avatars service write" on storage.objects
      for all using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
  end if;
end $$;
