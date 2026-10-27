-- 010_provider_kind_image.sql
-- 供应商类型新增「生图」(image)：与对话/向量并列，专供生图模块调用图片接口。

alter table llm_providers drop constraint if exists llm_providers_kind_check;
alter table llm_providers
  add constraint llm_providers_kind_check check (kind in ('chat', 'embedding', 'image'));
