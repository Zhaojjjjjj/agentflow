import { escXml, type ChatSkill } from "./types";

interface CanvasNode {
  id: string;
  label: string;
  detail?: string;
}
interface CanvasEdge {
  from: string;
  to: string;
  label?: string;
}

const W = 260;
const H = 110;
const GAP_X = 80;
const GAP_Y = 60;

function layout(nodes: CanvasNode[], edges: CanvasEdge[]) {
  const depth = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const q = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  for (const id of q) depth.set(id, 0);
  while (q.length) {
    const cur = q.shift()!;
    for (const nxt of adj.get(cur) ?? []) {
      const d = (depth.get(cur) ?? 0) + 1;
      if (d > (depth.get(nxt) ?? -1)) {
        depth.set(nxt, d);
        q.push(nxt);
      }
    }
  }
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, 0);
  const cols = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const c = depth.get(n.id) ?? 0;
    const r = cols.get(c) ?? 0;
    cols.set(c, r + 1);
    pos.set(n.id, { x: c * (W + GAP_X), y: r * (H + GAP_Y) });
  }
  return pos;
}

function toPreviewSvg(nodes: CanvasNode[], edges: CanvasEdge[], pos: Map<string, { x: number; y: number }>): string {
  let maxX = 0;
  let maxY = 0;
  for (const p of pos.values()) {
    maxX = Math.max(maxX, p.x + W);
    maxY = Math.max(maxY, p.y + H);
  }
  const parts: string[] = [
    `<defs><marker id="carr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" fill="#8b5cf6"/></marker></defs>`,
  ];
  for (const e of edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + W;
    const y1 = a.y + H / 2;
    const x2 = b.x;
    const y2 = b.y + H / 2;
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2 - 3}" y2="${y2}" stroke="#8b5cf6" stroke-width="1.6" marker-end="url(#carr)"/>`
    );
    if (e.label) {
      parts.push(
        `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-size="11" fill="#a78bfa">${escXml(e.label)}</text>`
      );
    }
  }
  for (const n of nodes) {
    const p = pos.get(n.id)!;
    parts.push(
      `<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="12" fill="#1e1b2e" stroke="#8b5cf6" stroke-width="1.5"/>`
    );
    parts.push(
      `<text x="${p.x + 16}" y="${p.y + 30}" font-size="14" font-weight="600" fill="#ede9fe">${escXml(n.label)}</text>`
    );
    if (n.detail) {
      const d = n.detail.length > 42 ? n.detail.slice(0, 42) + "…" : n.detail;
      parts.push(
        `<text x="${p.x + 16}" y="${p.y + 56}" font-size="12" fill="#a5b4fc">${escXml(d)}</text>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX + 20} ${maxY + 20}" width="100%" style="max-width:760px;background:#14121f;border-radius:12px;">${parts.join("")}</svg>`;
}

/**
 * json_canvas — 生成 Obsidian Canvas 格式的知识画布文件（.canvas），
 * 适合脑图、知识关联、想法整理。可直接在 Obsidian 里打开。
 */
export const jsonCanvasSkill: ChatSkill = {
  name: "json_canvas",
  description:
    "当用户想要脑图、知识画布、想法关联图（可在 Obsidian 里打开的 .canvas 文件）时调用。传入节点和连线，返回 .canvas 文件 + 预览图。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "画布标题（用作文件名）" },
      nodes: {
        type: "array",
        description: "节点列表",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "节点唯一标识，如 n1" },
            label: { type: "string", description: "节点标题" },
            detail: { type: "string", description: "节点补充说明（可选）" },
          },
          required: ["id", "label"],
        },
      },
      edges: {
        type: "array",
        description: "连线列表",
        items: {
          type: "object",
          properties: {
            from: { type: "string", description: "起点节点 id" },
            to: { type: "string", description: "终点节点 id" },
            label: { type: "string", description: "关系说明（可选）" },
          },
          required: ["from", "to"],
        },
      },
    },
    required: ["nodes", "edges"],
  },
  execute: async (args) => {
    const rawNodes = Array.isArray(args.nodes) ? args.nodes : [];
    const nodes: CanvasNode[] = rawNodes
      .filter((n) => n && typeof n.id === "string" && typeof n.label === "string")
      .slice(0, 40)
      .map((n) => ({
        id: n.id.slice(0, 40),
        label: n.label.slice(0, 60),
        detail: typeof n.detail === "string" ? n.detail.slice(0, 200) : undefined,
      }));
    if (nodes.length === 0) throw new Error("nodes 不能为空");
    const ids = new Set(nodes.map((n) => n.id));
    const rawEdges = Array.isArray(args.edges) ? args.edges : [];
    const edges: CanvasEdge[] = rawEdges
      .filter((e) => e && ids.has(e.from) && ids.has(e.to))
      .slice(0, 60)
      .map((e) => ({
        from: e.from,
        to: e.to,
        label: typeof e.label === "string" ? e.label.slice(0, 40) : undefined,
      }));
    const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "知识画布";

    const pos = layout(nodes, edges);
    const canvas = {
      nodes: nodes.map((n) => {
        const p = pos.get(n.id)!;
        return {
          id: n.id,
          type: "text",
          text: n.detail ? `## ${n.label}\n\n${n.detail}` : `## ${n.label}`,
          x: p.x,
          y: p.y,
          width: W,
          height: H,
        };
      }),
      edges: edges.map((e, i) => ({
        id: `e${i}`,
        fromNode: e.from,
        toNode: e.to,
        toEnd: "arrow",
        ...(e.label ? { label: e.label } : {}),
      })),
    };
    const json = JSON.stringify(canvas, null, 2);
    const preview = toPreviewSvg(nodes, edges, pos);
    const filename = `${title.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 30) || "canvas"}.canvas`;
    return {
      summary: `已生成知识画布文件 ${filename}（Obsidian Canvas 格式，可在 Obsidian 里打开）`,
      files: [{ filename, mime: "application/json", content: json, previewSvg: preview }],
    };
  },
};
