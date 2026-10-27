-- 009_image_studio.sql
-- 生图模块：风格模板 + 生图任务 + 图片存储桶。
-- 模板由管理员在后台维护；用户选模板生图，或上传图片按模板编辑。

create table if not exists image_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  prompt text not null,
  mode text not null default 'generate' check (mode in ('generate', 'edit', 'both')),
  size text not null default '1024x1024',
  cover_url text not null default '',
  enabled boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists image_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  template_id uuid references image_templates(id) on delete set null,
  template_name text not null default '',
  mode text not null check (mode in ('generate', 'edit')),
  prompt text not null,
  user_prompt text not null default '',
  source_url text not null default '',
  size text not null default '1024x1024',
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  progress text not null default '已加入队列',
  result_url text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_image_jobs_user on image_jobs(user_id, created_at desc);

-- images bucket (public read; writes go through the server with the service key)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'images public read') then
    create policy "images public read" on storage.objects
      for select using (bucket_id = 'images');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'images service write') then
    create policy "images service write" on storage.objects
      for all using (bucket_id = 'images') with check (bucket_id = 'images');
  end if;
end $$;

-- 种子模板：旅行纪念票卡海报（上传照片 → 设计海报，编辑模式）
insert into image_templates (name, description, prompt, mode, size, sort)
select
  '旅行纪念票卡海报',
  '把旅行照片做成上下对照的高级设计海报：上方真实照片，下方同场景纪念票卡。',
  $tpl$请将我上传的每一张旅行照片分别制作成一张独立的高级设计海报，不进行多图拼接，每张照片单独输出。

整体采用3:4竖版构图，画面分为上下两个清晰的对照区域，比例约为1:1。上下之间使用笔直、清楚、克制的水平边界，不渐变、不羽化、不撕纸、不互相覆盖。

上半部分完整展开原始旅行照片。忠实保持地点、主体身份与数量、地平线、地形方向、建筑、人物、车辆或船只、观察角度、相对位置、真实材质、自然光影和原有色彩。只进行轻微的旅行杂志与艺术出版物调色，并加入极薄胶片颗粒。上半必须明显是一张真实的全彩摄影作品，不得插画化、单色化，也不要出现票卡、文字、边框或旅游图标。为适配画幅可自然扩展天空、地面或环境，但不得拉伸、镜像、复制、移动或改变主体。

下半部分使用从原照片暗部提取的一种中深色作为哑光纸面背景，并保留大面积纯色空场。在中央放置唯一一枚横向全彩旅行纪念票卡，票卡宽度约占下半区域的80%–88%，保持水平、正面、不旋转。

票卡使用柔和圆角、轻微厚纸边缘和极浅接触阴影。票卡上边中央、下边中央与右边中央分别具有一个真正切入外轮廓的半圆票口缺口。票卡左侧约74%–79%是与上方完全相同场景的高保真全彩宽幅摄影；右侧约21%–26%是暖象牙色信息票联，以清晰的竖向细点划穿孔线分隔。

从可靠地点信息中提取1–3个英文单词作为主标题，并只加入极少量系列编号与2–4个英文单词的短句。主标题使用优雅、窄长的衬线字体，辅助文字使用细小中性无衬线字体。票联底部可以加入少量不可扫描的登记条纹，但不得生成真实条码或二维码。无法确认日期时不要编造日期。

整体应像国际旅行杂志或设计机构制作的收藏票卡对照页：上方让人看见真实现场，下方让人看见同一现场如何被收藏为一枚票卡。安静、克制、现代、具有收藏感。

强制避免：缺失上方照片、上下两个不同场景、插画化照片、单色上方照片、多张票卡、登机牌模板、航空或铁路品牌、护照元素、地图图钉、旅游图标、二维码、可扫描条码、虚构地点与日期、Logo、作者名、摄影师名、账号、签名、水印、塑料3D、金属箔、桌面或手持Mockup。$tpl$,
  'edit',
  '1024x1536',
  1
where not exists (select 1 from image_templates where name = '旅行纪念票卡海报');
