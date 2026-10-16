# AgentFlow · AI 连载创作平台

小说与网剧剧本的连载工作室：定下世界观，AI 帮你一集一集写下去——每一集剧情完整，每一集都记得之前发生过什么。

- **大纲先行**：全书 → 分卷 → 单集三级大纲，每集起承转合完整
- **前情记忆**：每集自动生成剧情摘要，向量召回相关的前情与伏笔
- **人物卡**：人物小传、性格、关系、当前状态，AI 随剧情持续维护
- **伏笔追踪**：埋了哪些钩子、在哪集回收，一目了然
- **人工审稿**：大纲和正文都可审可改，确认之后才往下写
- **双形态**：长篇小说 / 网剧剧本

Serverless 架构：**Next.js 15 全栈**（Vercel 部署）+ **Supabase Postgres/pgvector**（故事库）+ **Inngest**（写集流水线异步执行）。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 15 (Vercel)                      │
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │ 创作工作室    │  │            Route Handlers            │  │
│  │ 作品/连载流   │  │  /api/studio/projects                │  │
│  │ 人物/伏笔面板 │  │  /api/studio/projects/[id]/episodes  │  │
│  └──────────────┘  │  /api/inngest (Inngest serve)        │  │
│                    └──────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌──────────────────┐    ┌────────────────┐
│   Supabase    │    │     Inngest      │    │   LLM 层       │
│ Postgres +    │    │ 写集流水线        │    │ OpenAI 兼容协议 │
│ pgvector      │    │ 大纲→审稿→扩写   │    │ 多 Provider    │
│ story_projects│    │ →记忆入库        │    │ fallback       │
│ episodes      │    │                  │    │ embeddings →   │
│ story_documents│   │                  │    │ pgvector 召回  │
└───────────────┘    └──────────────────┘    └────────────────┘
```

写一集流程：前情检索（摘要 + 人物 + 伏笔 + 向量召回）→ 生成本集大纲 → 人工审稿确认 → 分节扩写正文 → 一致性自检 → 记忆入库（摘要/人物变化/伏笔更新）。

## 数据模型

| 表 | 说明 |
|---|---|
| `story_projects` | 作品：类型（小说/网剧）、题材、梗概、世界观、风格、单集字数 |
| `story_characters` | 人物卡：小传、性格、外貌、关系、当前状态 |
| `episodes` | 集：集号、大纲、正文、字数、状态（草稿/审稿中/已发布） |
| `plot_threads` | 伏笔：描述、埋下集号、回收集号、状态 |
| `story_documents` | 记忆库：剧情摘要/设定片段 + 1024 维向量 |
| `episode_jobs` | 写集任务：进度、状态、错误信息 |

## 从零搭建

### 1. 注册所需服务

| 服务 | 用途 | 备注 |
|---|---|---|
| [Supabase](https://supabase.com) | Postgres + pgvector | 故事库与向量检索 |
| [Inngest](https://inngest.com) | 异步执行 | 写集流水线必需 |

### 2. 建表

在 Supabase Dashboard → SQL Editor 中按顺序执行：

```
supabase/migrations/001_llm_providers.sql
supabase/migrations/002_users.sql
supabase/migrations/003_chat.sql
supabase/migrations/004_chat_attachments.sql
supabase/migrations/006_studio.sql
```

> `005_drop_workflows.sql` 仅用于从旧版本升级（删除已废弃的工作流表），全新部署跳过。

### 3. 配置环境变量

```bash
cp .env.example .env.local
# 生成 API Key 加密密钥（后台管理 LLM 供应商必需）：
openssl rand -hex 32
```

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 项目设置 → API |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest → Keys；写集流水线必需 |
| `APP_ENCRYPTION_KEY` | `openssl rand -hex 32` 生成的 64 位 hex；后台增删 LLM 供应商必需 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 控制台登录账号；用户名默认 `admin01`，密码必填 |
| `AUTH_SECRET` | 会话签名密钥；不填则回退到 `APP_ENCRYPTION_KEY` |
| `LLM_PROVIDER_1_*` | 主 LLM（OpenAI 兼容：baseURL/key/model），可配多个按顺序降级；也可在后台配置后留空 |
| `LLM_EMBEDDING_*` | 前情记忆向量化（baseURL/key/model/dimensions，需与表结构一致，默认 1024）；也可在后台配置后留空 |
| `NEXT_PUBLIC_APP_URL` | 部署后的公网地址 |

### 4. 本地运行

```bash
npm install
npx tsc --noEmit
npm run dev
# 另开终端启动 Inngest 本地服务（写集流水线需要）：
npx inngest-cli@latest dev
```

打开 http://localhost:3000。Inngest 本地 dev 会自动发现 `http://localhost:3000/api/inngest`。

### 5. 部署到 Vercel

1. 推送到 GitHub。
2. Vercel → New Project → 导入仓库，填入上述环境变量。
3. 在 [Inngest Dashboard](https://app.inngest.com) → Apps → 添加 `https://你的域名/api/inngest`（生产环境用 Signing Key 验证）。

## 后台配置 LLM（推荐，不用改环境变量）

打开管理后台的 **LLM 配置**页面，可视化管理供应商：

- **供应商列表**：对话 / 向量分组展示，显示模型、Base URL、Key 掩码（`****abcd`，明文永不回显）、启用状态、优先级
- **新增 / 编辑 / 删除**：Key 经 AES-256-GCM 加密后入库，密钥来自 `APP_ENCRYPTION_KEY`；编辑时 Key 留空即不修改
- **启用 / 禁用**：一键开关；**↑ ↓** 调整优先级（对话供应商按优先级从上到下依次试错）
- **测试连接**：服务端先调 `GET /models`，不通则发一次最小 chat 调用，返回成功/失败 + 耗时
- **从环境变量导入**：一键把 `LLM_PROVIDER_{i}_*` 写入数据库（按名称幂等，已存在则跳过）

解析顺序：**数据库优先**（`enabled=true`，按 `priority` 排序），数据库为空或迁移未执行时自动回退到环境变量。

> 注意：向量供应商的 `dimensions` 须与 `story_documents.embedding` 的向量维度一致（默认 1024），否则入库会失败。

## Luna 对话助手

控制台内置 AI 助手 Luna（`/chat`）：SSE 流式问答、8 个文件/图表技能（思维导图、文档、代码、表格、HTML 页面等）、对话附件预览。每日自动生成推荐题目，管理员可在后台一键刷新。

## 后续路线图

- [ ] 写一集流水线：前情检索 → 大纲生成 → 人工审稿 → 分节扩写 → 一致性自检 → 记忆入库
- [ ] 向量记忆召回（BAAI/bge 系列 embedding，经后台 LLM 配置接入）
- [ ] 网剧剧本格式：场次/地点/人物/动作/对白结构化编辑与导出
- [ ] 长篇连载的卷级结构管理与全书总纲视图
- [ ] 作品导出（Markdown / TXT / 剧本格式）
- [ ] 多人协作：合著、审稿人角色
