import type { ChatSkill } from "./types";
import { graphvizSkill } from "./graphviz";
import { drawioSkill } from "./drawio";
import { jsonCanvasSkill } from "./jsonCanvas";
import { markdownSkill, codeSkill, csvSkill, jsonSkill, htmlSkill } from "./files";

export const CHAT_SKILLS: ChatSkill[] = [
  graphvizSkill,
  drawioSkill,
  jsonCanvasSkill,
  markdownSkill,
  codeSkill,
  csvSkill,
  jsonSkill,
  htmlSkill,
];

export const CHAT_SKILL_MAP = new Map(CHAT_SKILLS.map((s) => [s.name, s]));

/** OpenAI function-calling 格式的工具定义，发给模型 */
export function chatToolDefs() {
  return CHAT_SKILLS.map((s) => ({
    type: "function" as const,
    function: {
      name: s.name,
      description: s.description,
      parameters: s.parameters,
    },
  }));
}

/** 给系统提示词追加的技能说明 */
export const SKILL_SYSTEM_PROMPT = `你可以使用以下技能（需要时主动调用，不要只输出代码）：

【可视化】
1. graphviz_diagram — 用户想要流程图、架构图、关系图等图表时调用。用 DOT 语言描述，返回可预览/下载的 SVG 图表文件。
2. drawio_diagram — 用户想要「能拿去 draw.io 继续编辑」的流程图时调用。传入节点和连线，返回 .drawio 文件 + 预览图。
3. json_canvas — 用户想要脑图、知识画布、想法关联图时调用。返回 Obsidian Canvas 格式的 .canvas 文件 + 预览图。

【文件输出】
4. markdown_doc — 用户想要一份文档（总结、报告、README、笔记、方案）需要下载保存时调用，返回 .md 文件。
5. code_file — 用户想要一份可直接保存运行的代码文件（脚本、SQL、配置等）时调用，返回对应后缀的文件。
6. csv_table — 用户想要表格数据文件（清单、台账，Excel 能打开）时调用，返回 .csv 文件。
7. json_data — 用户想要结构化 JSON 数据文件时调用。
8. html_page — 用户想要一个「能打开看的页面」（可视化报告、小工具、落地页草稿、动画演示）时调用。返回单文件 HTML，聊天内可直接交互预览。

规则：
- 当用户说"画个流程图""整理成文档""导出表格""做个页面看看"或明显需要文件/可视化时，直接调用相应技能生成文件，再用一句话介绍文件内容和怎么用。
- 一次回答最多调用 2 个技能；不要为了调用而调用，纯文字能讲清楚就别用技能。`;

export async function executeChatSkill(name: string, args: Record<string, unknown>) {
  const skill = CHAT_SKILL_MAP.get(name);
  if (!skill) throw new Error(`未知技能: ${name}`);
  return skill.execute(args);
}

/** 技能中文名（用于思考步骤展示） */
export const CHAT_SKILL_LABELS: Record<string, string> = {
  graphviz_diagram: "画图表",
  drawio_diagram: "画可编辑流程图",
  json_canvas: "整理脑图",
  markdown_doc: "写文档",
  code_file: "写代码",
  csv_table: "整理表格",
  json_data: "准备数据",
  html_page: "做页面",
};
