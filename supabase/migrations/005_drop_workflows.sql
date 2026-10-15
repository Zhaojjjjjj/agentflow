-- ============================================================
-- AgentFlow 转向：删除旧工作流域的表
-- !!! 必须在包含 Studio 重构的新代码部署上线 AFTER 再执行 !!!
-- 否则旧版线上代码会因缺表报错。
-- 执行前建议先在 Supabase 后台做一次数据库备份。
-- ============================================================

-- 先删函数（依赖 documents 表）
drop function if exists match_documents(vector, int, uuid, float);

-- 有外键依赖的先删
drop table if exists run_steps cascade;
drop table if exists workflow_runs cascade;
drop table if exists workflow_versions cascade;
drop table if exists documents cascade;
drop table if exists api_keys cascade;
drop table if exists workflows cascade;

-- 验证：下面查询应返回 0 行
-- select tablename from pg_tables
-- where schemaname = 'public'
--   and tablename in ('workflows','workflow_versions','workflow_runs',
--                     'run_steps','documents','api_keys');
