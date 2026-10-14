import type { ChatSkill } from "./types";

const MAX_LEN = 200_000;

function safeFilename(name: string, ext: string): string {
  const base = name.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 40) || "file";
  return base.endsWith(ext) ? base : `${base}${ext}`;
}

/**
 * markdown_doc — 生成 Markdown 文档文件（总结、报告、README、笔记…）
 */
export const markdownSkill: ChatSkill = {
  name: "markdown_doc",
  description:
    "当用户想要一份「文档」——总结、报告、README、学习笔记、方案文档等，需要可下载保存时调用。返回 .md 文件。只写正文内容，不要在文件里再包一层代码块标记。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "文档标题（用作文件名）" },
      content: { type: "string", description: "完整的 Markdown 正文" },
    },
    required: ["title", "content"],
  },
  execute: async (args) => {
    const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "文档";
    const content = typeof args.content === "string" ? args.content : "";
    if (!content.trim()) throw new Error("content 不能为空");
    if (content.length > MAX_LEN) throw new Error("文档过长（最多 20 万字符）");
    const filename = safeFilename(title, ".md");
    return {
      summary: `已生成文档 ${filename}`,
      files: [{ filename, mime: "text/markdown", content }],
    };
  },
};

/**
 * code_file — 生成代码文件（脚本、组件、配置…）
 */
export const codeSkill: ChatSkill = {
  name: "code_file",
  description:
    "当用户想要一份「可以直接保存运行的代码文件」时调用（Python 脚本、JS/TS、HTML 片段、SQL、配置文件等）。返回对应后缀的文件，可下载。不要在文件内容里包 markdown 代码块标记，直接给源码。",
  parameters: {
    type: "object",
    properties: {
      filename: { type: "string", description: "文件名（含后缀），如 crawl.py、utils.ts、schema.sql" },
      content: { type: "string", description: "完整的源代码" },
    },
    required: ["filename", "content"],
  },
  execute: async (args) => {
    let filename = typeof args.filename === "string" ? args.filename.trim() : "code.txt";
    filename = filename.replace(/[^\w\u4e00-\u9fa5.\-+]/g, "_").slice(0, 60) || "code.txt";
    const content = typeof args.content === "string" ? args.content : "";
    if (!content.trim()) throw new Error("content 不能为空");
    if (content.length > MAX_LEN) throw new Error("代码过长（最多 20 万字符）");
    return {
      summary: `已生成代码文件 ${filename}`,
      files: [{ filename, mime: "text/plain", content }],
    };
  },
};

/**
 * csv_table — 生成 CSV 表格文件（数据整理、清单导出…）
 */
export const csvSkill: ChatSkill = {
  name: "csv_table",
  description:
    "当用户想要一份「表格数据文件」——清单、台账、数据整理结果，需要用 Excel 打开时调用。返回 .csv 文件（Excel 可直接打开）。表头用中文，单元格不要换行。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "表格标题（用作文件名）" },
      headers: { type: "string", description: "表头，逗号分隔，如：姓名,电话,备注" },
      rows: {
        type: "array",
        description: "数据行，每行是与表头等长的字符串数组",
        items: { type: "array", items: { type: "string" } },
      },
    },
    required: ["headers", "rows"],
  },
  execute: async (args) => {
    const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "表格";
    const headers = typeof args.headers === "string" ? args.headers : "";
    const rows = Array.isArray(args.rows) ? args.rows : [];
    if (!headers.trim() || rows.length === 0) throw new Error("表头和数据行不能为空");
    if (rows.length > 2000) throw new Error("数据行太多（最多 2000 行）");
    const cell = (v: unknown) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const head = headers.split(/[,，]/).map((h) => cell(h.trim()));
    const lines = [head.join(",")];
    for (const r of rows) {
      const arr = Array.isArray(r) ? r : [];
      lines.push(head.map((_, i) => cell(arr[i])).join(","));
    }
    const content = "﻿" + lines.join("\n"); // BOM：Excel 直接打开不乱码
    const filename = safeFilename(title, ".csv");
    return {
      summary: `已生成表格文件 ${filename}（${rows.length} 行，可用 Excel 打开）`,
      files: [{ filename, mime: "text/csv", content }],
    };
  },
};

/**
 * json_data — 生成 JSON 数据文件
 */
export const jsonSkill: ChatSkill = {
  name: "json_data",
  description: "当用户想要一份「结构化数据文件」（JSON 格式的配置、数据集、接口示例）时调用。返回 .json 文件。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "文件名（不含后缀）" },
      data: { type: "string", description: "JSON 字符串，必须是合法 JSON" },
    },
    required: ["title", "data"],
  },
  execute: async (args) => {
    const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "data";
    const raw = typeof args.data === "string" ? args.data : "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("data 不是合法 JSON");
    }
    const content = JSON.stringify(parsed, null, 2);
    if (content.length > MAX_LEN) throw new Error("数据过大（最多 20 万字符）");
    const filename = safeFilename(title, ".json");
    return {
      summary: `已生成数据文件 ${filename}`,
      files: [{ filename, mime: "application/json", content }],
    };
  },
};

/**
 * html_page — 生成单文件 HTML 页面（可视化报告、交互小工具、落地页草稿…），
 * 聊天内可直接交互预览，也可下载。
 */
export const htmlSkill: ChatSkill = {
  name: "html_page",
  description:
    "当用户想要一个「能打开看的页面」——可视化报告、数据看板、交互小工具、落地页草稿、动画演示时调用。返回单个 .html 文件（所有 CSS/JS 内联，零依赖），聊天内可直接交互预览，也可下载用浏览器打开。页面要美观：浅色系、留白、#7C3AED 点缀。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "页面标题（用作文件名和 <title>）" },
      html: {
        type: "string",
        description:
          "完整的 HTML 文档（含 <html> 标签，CSS/JS 全部内联，不要引用外部 CDN）。直接给源码，不要包 markdown 代码块。",
      },
    },
    required: ["title", "html"],
  },
  execute: async (args) => {
    const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "页面";
    let html = typeof args.html === "string" ? args.html : "";
    if (!html.trim()) throw new Error("html 不能为空");
    if (html.length > MAX_LEN) throw new Error("页面过大（最多 20 万字符）");
    // 去掉可能被模型包上的代码块标记
    html = html.replace(/^```html\s*/i, "").replace(/\s*```$/, "").trim();
    if (!/<html/i.test(html)) {
      html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body>${html}</body></html>`;
    }
    const filename = safeFilename(title, ".html");
    return {
      summary: `已生成页面 ${filename}（可在聊天内直接交互预览）`,
      files: [{ filename, mime: "text/html", content: html, previewHtml: html }],
    };
  },
};
