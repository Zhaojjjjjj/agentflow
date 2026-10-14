import type { ChatSkill } from "./types";

/**
 * graphviz_diagram — render Graphviz DOT to an SVG file.
 * Uses @viz-js/viz (WASM, no system binaries needed — works on Vercel).
 */
export const graphvizSkill: ChatSkill = {
  name: "graphviz_diagram",
  description:
    "当用户想要流程图、架构图、关系图、时序概念图等可视化图表时调用。用 Graphviz DOT 语言描述图形，返回渲染好的 SVG 图表文件（可直接预览和下载）。节点文字支持中文。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "图表标题（用作文件名）" },
      dot: {
        type: "string",
        description:
          'Graphviz DOT 源码，例如: digraph { rankdir=LR; A [label="开始"]; B [label="结束"]; A -> B; }。中文 label 必须用双引号包裹。',
      },
      engine: {
        type: "string",
        description: "布局引擎",
        enum: ["dot", "neato", "circo", "fdp"],
      },
    },
    required: ["dot"],
  },
  execute: async (args) => {
    const dot = typeof args.dot === "string" ? args.dot.trim() : "";
    if (!dot) throw new Error("缺少 dot 参数");
    if (dot.length > 20000) throw new Error("DOT 源码过长（最多 20000 字符）");
    const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "图表";
    const engine = ["dot", "neato", "circo", "fdp"].includes(args.engine as string)
      ? (args.engine as "dot" | "neato" | "circo" | "fdp")
      : "dot";

    const { instance } = await import("@viz-js/viz");
    const viz = await instance();
    let svg: string;
    try {
      svg = viz.renderString(dot, { format: "svg", engine });
    } catch (e) {
      throw new Error(`DOT 渲染失败: ${e instanceof Error ? e.message : String(e)}`);
    }
    // 去掉 XML 声明，方便内联预览
    svg = svg.replace(/<\?xml[^?]*\?>\s*/, "").replace(/<!DOCTYPE[^>]*>\s*/, "");
    const filename = `${title.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 30) || "diagram"}.svg`;
    return {
      summary: `已生成图表文件 ${filename}（SVG，可预览/下载）`,
      files: [{ filename, mime: "image/svg+xml", content: svg, previewSvg: svg }],
    };
  },
};
