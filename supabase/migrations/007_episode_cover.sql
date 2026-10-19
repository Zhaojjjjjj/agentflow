-- 007: 每集封面（AI 生成提示词 + 手动上传）
alter table episodes
  add column if not exists cover_prompt text not null default '',
  add column if not exists cover_url text not null default '';

-- covers bucket (public read; uploads go through the server with the service key)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'covers public read') then
    create policy "covers public read" on storage.objects
      for select using (bucket_id = 'covers');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'covers service write') then
    create policy "covers service write" on storage.objects
      for all using (bucket_id = 'covers') with check (bucket_id = 'covers');
  end if;
end $$;
