-- ============================================================
-- 示例：RAG 智能问答流水线（复杂示例，含知识检索）
-- 用法：把整个文件粘贴到 Supabase SQL Editor 执行，
--       然后在控制台打开「RAG 智能问答流水线（示例）」运行，
--       输入参数示例：{"question": "你们的退换货政策是什么？"}
-- ------------------------------------------------------------
-- 流程：手动触发 → 查询改写 → 知识检索 → 命中判断 → RAG回答/兜底
--       → 质量评分 → 循环整理引用 → 低分检查 → 人工审核 → 日志上报 → 输出汇总
-- 用到 8 种节点：trigger-manual / llm / rag-retrieve /
--               condition / loop / human-approval / http-request / output
-- ============================================================

insert into workflows (name, description, definition)
values (
  'RAG 智能问答流水线（示例）',
  '复杂 RAG 示例：查询改写→向量检索→条件分支→RAG回答→LLM打分→循环整理引用→低分人工审核→HTTP日志上报。运行输入示例：{"question": "你们的退换货政策是什么？"}',
  '{"nodes": [{"id": "trigger-1", "type": "trigger-manual", "position": {"x": 60, "y": 320}, "data": {"label": "手动触发", "config": {"inputSchema": {"question": "用户问题，例如：你们的退换货政策是什么？"}}}}, {"id": "rewrite-1", "type": "llm", "position": {"x": 260, "y": 320}, "data": {"label": "查询改写", "config": {"systemPrompt": "你是检索查询改写专家。把用户的口语化问题改写成适合向量检索的简洁查询：保留核心关键词，去掉语气词和无关修饰。只输出改写后的查询文本，不要任何解释。", "prompt": "用户问题：{{trigger-1.question}}\n\n改写后的检索查询：", "temperature": 0.3, "maxTokens": 200}}}, {"id": "retrieve-1", "type": "rag-retrieve", "position": {"x": 460, "y": 320}, "data": {"label": "知识检索", "config": {"query": "{{rewrite-1.text}}", "topK": 5, "minScore": 0.25}}}, {"id": "has-docs", "type": "condition", "position": {"x": 660, "y": 320}, "data": {"label": "命中判断", "config": {"expression": "{{retrieve-1.count}} > 0"}}}, {"id": "answer-1", "type": "llm", "position": {"x": 860, "y": 170}, "data": {"label": "RAG 回答", "config": {"systemPrompt": "你是企业知识库智能客服。严格遵守：1）只能依据【参考资料】回答问题；2）资料不足时明确说\"根据现有资料无法确定\"，绝不编造；3）回答末尾用【来源i】标注引用了哪条资料；4）语气专业简洁。", "prompt": "用户问题：{{trigger-1.question}}\n\n【参考资料】\n{{retrieve-1.chunks}}\n\n请回答：", "temperature": 0.5, "maxTokens": 1500}}}, {"id": "fallback-1", "type": "llm", "position": {"x": 860, "y": 470}, "data": {"label": "兜底回复", "config": {"systemPrompt": "你是企业知识库智能客服，语气亲切专业。", "prompt": "用户问题：{{trigger-1.question}}\n\n知识库中没有检索到相关内容。请礼貌地告诉用户暂未找到相关资料，建议换一种问法或转人工客服。不要编造答案：", "temperature": 0.5, "maxTokens": 500}}}, {"id": "quality-1", "type": "llm", "position": {"x": 1060, "y": 320}, "data": {"label": "质量评分", "config": {"systemPrompt": "你是问答质量评审员。只输出 1-10 的整数分数，不要任何其他文字。", "prompt": "用户问题：{{trigger-1.question}}\n\nAI 回答：{{answer-1.text}}{{fallback-1.text}}\n\n评分标准：10=准确完整有依据；7=基本可用；4=部分相关；1=答非所问或编造。\n分数：", "temperature": 0.2, "maxTokens": 50}}}, {"id": "citations-1", "type": "loop", "position": {"x": 1260, "y": 320}, "data": {"label": "整理引用", "config": {"items": "{{retrieve-1.chunks}}", "itemVar": "chunk", "maxIterations": 5, "nodes": [{"id": "fmt-1", "type": "llm", "position": {"x": 60, "y": 100}, "data": {"label": "格式化引用", "config": {"systemPrompt": "只输出一行引用文本，不要解释。", "prompt": "把这条检索结果整理成一行引用，格式：【引用】一句话摘要（相似度 {{chunk.similarity}}）：\n\n内容：{{chunk.content}}", "temperature": 0.3, "maxTokens": 200}}}, {"id": "sub-out-1", "type": "output", "position": {"x": 340, "y": 100}, "data": {"label": "收集", "config": {"fields": {"line": "{{fmt-1.text}}"}}}}], "edges": [{"id": "se1", "source": "fmt-1", "target": "sub-out-1"}]}}}, {"id": "need-review", "type": "condition", "position": {"x": 1460, "y": 320}, "data": {"label": "低分检查", "config": {"expression": "{{quality-1.text}} < 7"}}}, {"id": "approval-1", "type": "human-approval", "position": {"x": 1660, "y": 170}, "data": {"label": "人工审核", "config": {"title": "审核低分回答", "message": "这条 AI 回答评分较低，需要人工审核。\n\n用户问题：{{trigger-1.question}}\n\nAI 回答：{{answer-1.text}}{{fallback-1.text}}\n\n质量评分：{{quality-1.text}} / 10\n\n引用来源：{{citations-1.results}}"}}}, {"id": "notify-1", "type": "http-request", "position": {"x": 1660, "y": 470}, "data": {"label": "日志上报", "config": {"method": "POST", "url": "https://httpbin.org/post", "headers": {"Content-Type": "application/json"}, "body": "{\"event\": \"qa_run\", \"question\": \"{{trigger-1.question}}\", \"score\": \"{{quality-1.text}}\", \"retrieved\": \"{{retrieve-1.count}}\"}", "timeoutMs": 15000}}}, {"id": "output-1", "type": "output", "position": {"x": 1880, "y": 320}, "data": {"label": "输出汇总", "config": {"fields": {"question": "{{trigger-1.question}}", "answer": "{{answer-1.text}}{{fallback-1.text}}", "score": "{{quality-1.text}}", "citations": "{{citations-1.results}}", "retrieved_count": "{{retrieve-1.count}}", "log_status": "{{notify-1.status}}"}}}}], "edges": [{"id": "e1", "source": "trigger-1", "target": "rewrite-1"}, {"id": "e2", "source": "rewrite-1", "target": "retrieve-1"}, {"id": "e3", "source": "retrieve-1", "target": "has-docs"}, {"id": "e4", "source": "has-docs", "target": "answer-1", "sourceHandle": "true"}, {"id": "e5", "source": "has-docs", "target": "fallback-1", "sourceHandle": "false"}, {"id": "e6", "source": "answer-1", "target": "quality-1"}, {"id": "e7", "source": "fallback-1", "target": "quality-1"}, {"id": "e8", "source": "quality-1", "target": "citations-1"}, {"id": "e9", "source": "citations-1", "target": "need-review"}, {"id": "e10", "source": "need-review", "target": "approval-1", "sourceHandle": "true"}, {"id": "e11", "source": "need-review", "target": "notify-1", "sourceHandle": "false"}, {"id": "e12", "source": "approval-1", "target": "notify-1"}, {"id": "e13", "source": "notify-1", "target": "output-1"}]}'::jsonb
);

-- ------------------------------------------------------------
-- 种子知识库文档（示例内容）
-- 注意：embedding 为空。要让检索真正跑起来，需要：
--   1）在「管理后台 / LLM 配置」里配好向量供应商（embedding 模型）；
--   2）删掉下面这几行，在控制台该工作流的「知识库」里重新导入文档
--      （UI 导入会自动切块 + embedding）。
-- ------------------------------------------------------------
insert into documents (workflow_id, content, metadata)
select w.id, '退换货政策：商品签收后 7 天内未拆封可无理由退货；质量问题 30 天内免费换新，来回运费由我们承担。', '{"source": "售后政策"}'::jsonb
from workflows w where w.name = 'RAG 智能问答流水线（示例）';
insert into documents (workflow_id, content, metadata)
select w.id, '退款时效：审核通过后 1-3 个工作日原路退回，节假日顺延。', '{"source": "售后政策"}'::jsonb
from workflows w where w.name = 'RAG 智能问答流水线（示例）';
insert into documents (workflow_id, content, metadata)
select w.id, '会员等级：普通会员、银卡（年消费满 2000）、金卡（年消费满 8000）；金卡享专属客服与优先发货。', '{"source": "会员体系"}'::jsonb
from workflows w where w.name = 'RAG 智能问答流水线（示例）';
insert into documents (workflow_id, content, metadata)
select w.id, '发货说明：工作日 16 点前下单当天发出，默认顺丰包邮，偏远地区 2-4 天送达。', '{"source": "物流说明"}'::jsonb
from workflows w where w.name = 'RAG 智能问答流水线（示例）';
insert into documents (workflow_id, content, metadata)
select w.id, '发票：支持电子普通发票与增值税专用发票，下单时备注开票信息即可。', '{"source": "财务开票"}'::jsonb
from workflows w where w.name = 'RAG 智能问答流水线（示例）';
