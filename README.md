# agentflow · 可视化 AI Agent 工作流编排与执行平台

拖拽编排 AI Agent 工作流：LLM 调用、HTTP 工具、条件分支、循环、RAG 检索、人工审批，一键运行并可发布为 HTTP API。

全免费架构：**Next.js 15 全栈**（Vercel 部署）+ **Supabase Postgres/pgvector**（数据库）+ **Upstash Redis**（可选）+ **Inngest**（durable 执行引擎）。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 15 (Vercel)                      │
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │  React Flow  │  │            Route Handlers            │  │
│  │  画布编辑器   │  │  /api/workflows  /api/runs          │  │
│  │  zustand 状态 │  │  /api/runs/[id]/stream (SSE)        │  │
│  └──────────────┘  │  /api/public/.../run (API Key 鉴权)   │  │
│                    │  /api/inngest (Inngest serve)        │  │
│                    └──────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌──────────────────┐    ┌────────────────┐
│   Supabase    │    │     Inngest      │    │ Upstash Redis  │
│ Postgres +    │    │ durable function │    │ 运行锁 / 限流  │
│ pgvector      │    │ step.run 逐节点  │    │ 未配置时降级   │
│ workflows     │    │ waitForEvent     │    └────────────────┘
│ workflow_runs │    │ 人工审批暂停     │
│ run_steps     │    │ cron 定时触发    │
│ documents     │    └──────────────────┘
└───────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│ LLM 层 (OpenAI 兼容协议，多 Provider fallback)  │
│ chat completions → token 统计 → 成本估算       │
│ embeddings → pgvector 相似检索 (RAG)           │
└───────────────────────────────────────────────┘
```

执行流程：控制台/定时/API 触发 → 创建 `workflow_runs` → Inngest `executeWorkflow`
按 DAG 拓扑逐节点 `step.run` 执行 → 每节点写 `run_steps` trace → SSE 推送进度 →
人工审批节点 `waitForEvent` 暂停 → 批准/拒绝后继续。

## 从零搭建（全部免费）

### 1. 注册免费服务

| 服务 | 用途 | 免费额度 |
|---|---|---|
| [Supabase](https://supabase.com) | Postgres + pgvector | 500MB 数据库 |
| [Upstash](https://upstash.com) | Redis（可选） | 10k 命令/天 |
| [Inngest](https://inngest.com) | durable 执行 | 每月一定量 steps |

### 2. 建表

在 Supabase Dashboard → SQL Editor 中执行 `supabase/schema.sql`（含 pgvector 扩展、表、向量索引、`match_documents` 函数），
然后执行 `supabase/migrations/001_llm_providers.sql`（LLM 供应商注册表）。

### 3. 配置环境变量

```bash
cp .env.example .env.local
# 生成 API Key 加密密钥（后台管理 LLM 供应商必需）：
openssl rand -hex 32
```

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 项目设置 → API |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 可选，未配置时自动降级 |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest → Keys；异步执行/定时/审批必需 |
| `APP_ENCRYPTION_KEY` | `openssl rand -hex 32` 生成的 64 位 hex；后台增删 LLM 供应商必需（缺失时写操作直接报错） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 控制台登录账号；用户名默认 `admin01`，密码必填 |
| `AUTH_SECRET` | 会话签名密钥；不填则回退到 `APP_ENCRYPTION_KEY` |
| `LLM_PROVIDER_1_*` | 主 LLM（OpenAI 兼容：baseURL/key/model），可配多个按顺序降级；也可在后台配置后留空 |
| `LLM_EMBEDDING_*` | RAG 向量化（baseURL/key/model/dimensions，需与表结构一致，默认 1536）；也可在后台配置后留空 |
| `NEXT_PUBLIC_APP_URL` | 部署后的公网地址 |

### 3.5 后台配置 LLM（推荐，不用改环境变量）

打开 **LLM 设置** 页面（首页右上角），可视化管理供应商：

- **供应商列表**：对话 / 向量分组展示，显示模型、Base URL、Key 掩码（`****abcd`，明文永不回显）、启用状态、优先级
- **新增 / 编辑 / 删除**：Key 经 AES-256-GCM 加密后入库，密钥来自 `APP_ENCRYPTION_KEY`；编辑时 Key 留空即不修改
- **启用 / 禁用**：一键开关；**↑ ↓** 调整优先级（对话供应商按优先级从上到下依次试错）
- **测试连接**：服务端先调 `GET /models`，不通则发一次最小 chat 调用，返回成功/失败 + 耗时
- **从环境变量导入**：一键把 `LLM_PROVIDER_{i}_*` 写入数据库（按名称幂等，已存在则跳过）

解析顺序：**数据库优先**（`enabled=true`，按 `priority` 排序），数据库为空或迁移未执行时自动回退到环境变量——执行器无感切换。

> 注意：向量供应商的 `dimensions` 须与 `documents.embedding` 的向量维度一致（默认 1536），否则入库会失败。

### 3.6 控制台登录（单管理员账号）

整个控制台（所有页面 + 内部数据 API）都需要登录后访问，未登录访问页面会自动跳转到 `/login`，调内部 API 返回 401。

配置（见 `.env.example`）：

| 变量 | 说明 |
|---|---|
| `ADMIN_USERNAME` | 管理员用户名，不填则默认为 `admin01` |
| `ADMIN_PASSWORD` | 管理员密码，**必填**；未配置时登录接口返回 503 |
| `AUTH_SECRET` | 会话 JWT 签名密钥（任意随机字符串，`openssl rand -hex 32`）；不填则回退到 `APP_ENCRYPTION_KEY`，两者都没有时无法登录 |

实现细节：
- 会话为 HS256 JWT，存于 `httpOnly` + `SameSite=Lax` cookie（`agentflow_session`，生产环境自动加 `Secure`），有效期 7 天
- 登录接口对用户名和密码分别做 timing-safe 比较，失败统一返回「用户名或密码错误」，不泄露哪一项错误
- `middleware.ts` 统一拦截；**公开端点**：`/login`、`/api/auth/*`、`/api/health`、`/api/inngest`（Inngest 云回调靠 `INNGEST_SIGNING_KEY` 自有验签）、`/api/public/*`（走 API Key 自有鉴权）
- 各页面右上角有「退出登录」按钮，调用 `POST /api/auth/logout` 清除会话

### 4. 本地运行

```bash
npm install
npx tsc --noEmit
npm run dev
# 另开终端启动 Inngest 本地服务（异步执行/定时/审批需要）：
npx inngest-cli@latest dev
```

打开 http://localhost:3000。Inngest 本地 dev 会自动发现 `http://localhost:3000/api/inngest`。

### 5. 部署到 Vercel

1. `git init && git add -A && git commit` 后推送到 GitHub（本仓库已初始化 main 分支，未 push）。
2. Vercel → New Project → 导入仓库，填入上述环境变量。
3. 在 [Inngest Dashboard](https://app.inngest.com) → Apps → 添加 `https://你的域名/api/inngest`（生产环境用 Signing Key 验证）。
4. 定时触发依赖 Inngest 的 cron（`schedule-tick` 每分钟检查），本地 dev 同理。

## 节点目录

| 节点 | 说明 |
|---|---|
| 手动触发 | 控制台/API 手动启动，`{{input.xxx}}` 引用输入 |
| 定时触发 | cron（UTC）定时自动运行 |
| 大模型 | OpenAI 兼容调用，模板变量，多 Provider 降级，token/成本统计 |
| HTTP 请求 | GET/POST/PUT/PATCH/DELETE，超时与失败策略可配 |
| 条件分支 | 表达式（如 `{{score}} > 0.8`）走 true/false 分支 |
| 循环 | 遍历数组执行内部子流程，最大迭代保护，防嵌套过深 |
| 知识检索 | pgvector 相似检索，输出 `{{nodeId.chunks}}` |
| 人工审批 | `waitForEvent` 暂停，控制台批准/拒绝后继续（仅异步模式） |
| 输出汇总 | 合并字段模板为最终结果 |

模板变量：`{{nodeId.field}}`（如 `{{llm-1.text}}`）、`{{input.xxx}}`；循环内可用 `{{item}}` / `{{itemIndex}}`。

## 发布为 API

工作流开启「发布」后：

```bash
curl -X POST https://你的域名/api/public/workflows/<id>/run \
  -H "x-api-key: af_xxx" \
  -H "Content-Type: application/json" \
  -d '{"input": {"topic": "AI"}, "mode": "async"}'
# sync 模式直接返回 output；async 返回 runId，通过 /api/runs/[id] 查询
```

## 后续路线图

- [ ] 节点重试策略可视化配置（次数/退避）
- [ ] 工作流模板市场（一键导入示例）
- [ ] 执行对比评测（同一输入跑多版本，token/质量对比）
- [ ] 子工作流节点（复用已发布工作流）
- [ ] Webhook 触发器节点
- [ ] 多租户与团队协作（Supabase Auth + RLS）
