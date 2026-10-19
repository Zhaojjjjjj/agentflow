// Studio 写一集流水线的全部 LLM 提示词。
//
// 设计原则：
// - 大纲是唯一的人工关卡，格式必须可解析（## 分节 / ### 分场）。
// - 扩写时只给当前节 + 已写正文（防重复），不给全量前情（省 token）。
// - 一致性检查用 JSON 输出，便于程序化处理。

export interface StoryContext {
title: string;
kind: "novel" | "drama";
genre: string | null;
synopsis: string | null;
worldview: string | null;
style: string | null;
episodeNumber: number;
targetWords: number;
recentSummaries: { number: number; title: string; summary: string}[];
characters: { name: string; role: string | null; profile: string | null; currentState: string | null}[];
openThreads: { description: string; plantedEpisode: number | null}[];
relatedMemories: string[];
}

function contextBlock(ctx: StoryContext): string {
const lines: string[] = [];
lines.push(`作品：《${ctx.title}》${ctx.genre? `（${ctx.genre}）`: ""}`);
if (ctx.synopsis) lines.push(`故事梗概：${ctx.synopsis}`);
if (ctx.worldview) lines.push(`世界观设定：${ctx.worldview}`);
if (ctx.style) lines.push(`风格要求：${ctx.style}`);
if (ctx.characters.length > 0) {
lines.push("\n");
for (const c of ctx.characters) {
const parts = [`${c.name}${c.role? `（${c.role}）`: ""}`];
if (c.profile) parts.push(`小传：${c.profile}`);
if (c.currentState) parts.push(`当前状态：${c.currentState}`);
lines.push("- " + parts.join("；"));
}
}
if (ctx.openThreads.length > 0) {
lines.push("\n");
for (const t of ctx.openThreads) {
lines.push(`- ${t.description}${t.plantedEpisode? `（第 ${t.plantedEpisode} 集埋下）`: ""}`);
}
}
if (ctx.recentSummaries.length > 0) {
lines.push("\n");
for (const s of ctx.recentSummaries) {
lines.push(`第 ${s.number} 集 ${s.title}：${s.summary}`);
}
}
if (ctx.relatedMemories.length > 0) {
lines.push("\n");
for (const m of ctx.relatedMemories) lines.push(`- ${m}`);
}
return lines.join("\n");
}

/** 小说大纲：起承转合，## 分节 */
export function novelOutlinePrompt(ctx: StoryContext): string {
return `你是长篇小说的策划编辑。现在要为连载小说写第 ${ctx.episodeNumber} 集的大纲。

${contextBlock(ctx)}

要求：
1. 本集必须有完整的起承转合：开场承接前情 → 发展推进冲突 → 高潮 → 结尾留下新的悬念或情感落点。
2. 单集目标约 ${ctx.targetWords} 字，请规划 4-6 节，每节标题具体。
3. 人物行为必须符合人物小传和当前状态，不能走形。
4. 可以呼应或推进未回收的伏笔，也可以埋下 1-2 个新伏笔（在要点中注明"新伏笔"）。
5. 不要与前情摘要矛盾。

请严格按以下格式输出，不要有多余内容：

# 第 ${ctx.episodeNumber} 集大纲

## 梗概
（一句话概括本集）

## 第一节：（节标题）
（本节 3-5 个剧情要点）

## 第二节：（节标题）
（本节 3-5 个剧情要点）

……`;
}

/** 网剧大纲：场次结构，### 分场 */
export function dramaOutlinePrompt(ctx: StoryContext): string {
return `你是网络短剧的编剧。现在要为竖屏短剧写第 ${ctx.episodeNumber} 集的剧本大纲。

${contextBlock(ctx)}

要求：
1. 本集必须有完整的起承转合，每集结尾必须有强悬念（钩子），让观众想追下一集。
2. 单集目标约 ${ctx.targetWords} 字，请规划 5-8 场，每场有明确地点和日/夜。
3. 人物行为必须符合人物小传和当前状态，台词符合人物性格。
4. 可以呼应或推进未回收的伏笔，也可以埋下 1-2 个新伏笔（在内容中注明"新伏笔"）。
5. 不要与前情摘要矛盾。

请严格按以下格式输出，不要有多余内容：

# 第 ${ctx.episodeNumber} 集大纲

## 梗概
（一句话概括本集）

### 第1场：（地点）（日/夜）
人物：（出场人物）
内容：（本场 3-5 个剧情要点）

### 第2场：（地点）（日/夜）
……`;
}

/** 小说扩写某一节 */
export function novelExpandPrompt(
ctx: StoryContext,
outline: string,
sectionTitle: string,
sectionPoints: string,
writtenSoFar: string,
targetWords: number
): string {
return `你是长篇小说作家。正在写《${ctx.title}》第 ${ctx.episodeNumber} 集。

${ctx.style? `风格要求：${ctx.style}\n`: ""}
本集大纲：
${outline}

现在写「${sectionTitle}」，要点如下：
${sectionPoints}

要求：
1. 本节约 ${targetWords} 字，直接写正文，不要写节标题，不要解释。
2. 人物语言和行为符合人物设定。${
ctx.characters.length > 0
? "人物参考：" + ctx.characters.map((c) => `${c.name}${c.currentState? `（当前：${c.currentState}）`: ""}`).join("；")
: ""
}
3. 与已写好的本集前文自然衔接，不要重复前文已经写过的内容。
${writtenSoFar? `\n已写好的本集前文：\n${writtenSoFar.slice(-3000)}`: "\n（这是本集的第一节，直接开场。）"}`;
}

/** 网剧扩写某一场 */
export function dramaExpandPrompt(
ctx: StoryContext,
outline: string,
sceneTitle: string,
scenePoints: string,
writtenSoFar: string,
targetWords: number
): string {
return `你是网络短剧编剧。正在写《${ctx.title}》第 ${ctx.episodeNumber} 集的剧本。

${ctx.style? `风格要求：${ctx.style}\n`: ""}
本集大纲：
${outline}

现在写「${sceneTitle}」，要点如下：
${scenePoints}

要求：
1. 本场约 ${targetWords} 字，按剧本格式写：场次标题行，，人物动作描述，对白用"人物：台词"格式。
2. 对白要符合人物性格，短促有力，适合竖屏短剧节奏。${
ctx.characters.length > 0
? "人物参考：" + ctx.characters.map((c) => `${c.name}${c.currentState? `（当前：${c.currentState}）`: ""}`).join("；")
: ""
}
3. 与已写好的本集前文自然衔接，不要重复。
${writtenSoFar? `\n已写好的本集前文（末尾部分）：\n${writtenSoFar.slice(-3000)}`: "\n（这是本集的第一场，直接开场。）"}`;
}

/** 一致性检查：输出 JSON */
export function consistencyPrompt(
ctx: StoryContext,
outline: string,
content: string
): string {
return `你是资深的 continuity 编辑。请检查下面这集正文是否存在问题。

作品：《${ctx.title}》第 ${ctx.episodeNumber} 集
${ctx.characters.length > 0? "人物设定：\n" + ctx.characters.map((c) => `- ${c.name}：${c.profile || ""}${c.currentState? `（当前：${c.currentState}）`: ""}`).join("\n") + "\n": ""}
前情摘要：
${ctx.recentSummaries.map((s) => `第 ${s.number} 集：${s.summary}`).join("\n") || "（第一集，无前情）"}

本集大纲：
${outline}

本集正文：
${content.slice(0, 12000)}

请检查以下四类问题：
1. character：人物走形（性格、能力、关系与设定不符）
2. conflict：与前情或大纲矛盾
3. thread：伏笔被错误回收、遗忘，或新伏笔与已有设定冲突
4. pacing：明显重复、注水、节奏拖沓的段落（指出位置）

只输出 JSON 数组，不要有其他内容。没有问题就输出 []。
格式：[{"type": "character|conflict|thread|pacing", "location": "问题位置（一句话）", "detail": "具体问题", "suggestion": "修改建议"}]`;
}

/** 根据一致性问题修订正文 */
export function revisePrompt(content: string, issues: { type: string; location: string; detail: string; suggestion: string}[]): string {
return `你是小说编辑。请根据以下审稿意见修订正文，只改有问题的部分，保持其他内容和整体风格不变，直接输出修订后的完整正文，不要解释。

审稿意见：
${issues.map((i, n) => `${n + 1}.${i.location}：${i.detail}。建议：${i.suggestion}`).join("\n")}

正文：
${content}`;
}

/** 生成本集摘要（200-300字） */
export function summaryPrompt(title: string, episodeNumber: number, content: string): string {
return `你是连载小说的责编。请为《${title}》第 ${episodeNumber} 集写一段 200-300 字的剧情摘要。

要求：交代本集主要情节转折、人物关键行动和结尾悬念，语言精炼。这是给"写下一集"时做前情回顾用的，要信息密度高。

正文：
${content.slice(0, 15000)}

只输出摘要正文，不要标题。`;
}

export interface MemoryExtraction {
characterUpdates: { name: string; newState: string}[];
newThreads: { description: string}[];
resolvedThreads: { description: string}[];
}

/** 从正文中提取：人物状态变化、新增/回收的伏笔。输出 JSON */
export function memoryExtractPrompt(
ctx: StoryContext,
content: string
): string {
return `你是连载作品的档案管理员。请阅读本集正文，提取需要记入档案的信息。

作品：《${ctx.title}》第 ${ctx.episodeNumber} 集
已知人物：${ctx.characters.map((c) => c.name).join("、") || "无"}
已知未回收伏笔：
${ctx.openThreads.map((t) => `- ${t.description}`).join("\n") || "无"}

正文：
${content.slice(0, 15000)}

请输出 JSON（不要有其他内容）：
{
"characterUpdates": [{"name": "人物名（必须是已知人物）", "newState": "本集结束后该人物的最新状态（处境/关系/心态变化，一句话）"}],
"newThreads": [{"description": "本集新埋下的伏笔（一句话，说明是什么钩子）"}],
"resolvedThreads": [{"description": "本集回收的伏笔（从已知未回收伏笔中选择，原文引用或概括）"}]
}
没有变化的类别就给空数组。`;
}

/** 从 JSON 输出中提取第一个 JSON 值（数组或对象），容忍前后有多余文字 */
export function extractJson(text: string): unknown | null {
const start = text.search(/[[{]/);
if (start === -1) return null;
const endArr = text.lastIndexOf("]");
const endObj = text.lastIndexOf("}");
const end = Math.max(endArr, endObj);
if (end <= start) return null;
try {
return JSON.parse(text.slice(start, end + 1));
} catch {
return null;
}
}

/** 封面图提示词：根据本集摘要生成可直接投喂生图模型的中文描述 */
export function coverPrompt(
  title: string,
  episodeNumber: number,
  genre: string | null,
  characters: { name: string; role: string | null; profile: string | null }[],
  summary: string
): string {
  const cast = characters
    .slice(0, 4)
    .map((c) => `${c.name}${c.role ? `（${c.role}）` : ""}${c.profile ? `：${c.profile.slice(0, 60)}` : ""}`)
    .join("；");
  return `你是连载作品的美术指导。请为《${title}》第 ${episodeNumber} 集设计一张封面图的生成提示词。
${genre ? `题材：${genre}。` : ""}${cast ? `主要人物：${cast}。` : ""}
本集剧情摘要：
${summary.slice(0, 1200)}

要求：
- 抓住本集最具视觉冲击力的一个瞬间（人物神态、关键场景、标志性道具），不要平铺直叙全集剧情
- 中文输出，一段话，150-250 字，可直接粘贴给图像生成模型
- 包含：主体、场景、氛围情绪、色调光影、竖版封面构图
- 明确要求画面中不出现任何文字、字母、水印
- 只输出提示词正文，不要标题和解释。`;
}
