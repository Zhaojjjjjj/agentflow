import { escXml, type ChatSkill } from "./types";

interface SpecNode {
  id: string;
  label: string;
  shape?: string;
}
interface SpecEdge {
  from: string;
  to: string;
  label?: string;
}

const W = 170;
const H = 64;
const GAP_X = 60;
const GAP_Y = 50;

/** 简单分层布局：按拓扑深度分列 */
function layout(nodes: SpecNode[], edges: SpecEdge[]) {
  const depth = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  const queue = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  for (const id of queue) depth.set(id, 0);
  // BFS 传播深度
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const q = [...queue];
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
  // 孤立节点放第 0 列
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

function shapeStyle(shape?: string): string {
  switch (shape) {
    case "diamond":
      return "rhombus";
    case "ellipse":
      return "ellipse";
    case "parallelogram":
      return "shape=parallelogram";
    default:
      return "rounded=1";
  }
}

function toDrawioXml(title: string, nodes: SpecNode[], edges: SpecEdge[], pos: Map<string, { x: number; y: number }>): string {
  const cells: string[] = [];
  let cid = 2;
  const idMap = new Map<string, string>();
  for (const n of nodes) {
    const id = `v${cid++}`;
    idMap.set(n.id, id);
    const p = pos.get(n.id)!;
    cells.push(
      `<mxCell id="${id}" value="${escXml(n.label)}" style="${shapeStyle(n.shape)};whiteSpace=wrap;html=1;fontSize=13;fillColor=#f5f3ff;strokeColor=#7c3aed;" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${W}" height="${H}" as="geometry"/></mxCell>`
    );
  }
  for (const e of edges) {
    const s = idMap.get(e.from);
    const t = idMap.get(e.to);
    if (!s || !t) continue;
    const id = `e${cid++}`;
    cells.push(
      `<mxCell id="${id}" value="${escXml(e.label ?? "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;fontSize=12;" edge="1" parent="1" source="${s}" target="${t}"><mxGeometry relative="1" as="geometry"/></mxCell>`
    );
  }
  return `<mxfile><diagram name="${escXml(title)}" id="d1"><mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join("")}</root></mxGraphModel></diagram></mxfile>`;
}

function toPreviewSvg(nodes: SpecNode[], edges: SpecEdge[], pos: Map<string, { x: number; y: number }>): string {
  let maxX = 0;
  let maxY = 0;
  for (const p of pos.values()) {
    maxX = Math.max(maxX, p.x + W);
    maxY = Math.max(maxY, p.y + H);
  }
  const parts: string[] = [
    `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b"/></marker></defs>`,
  ];
  for (const e of edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + W;
    const y1 = a.y + H / 2;
    const x2 = b.x;
    const y2 = b.y + H / 2;
    const mx = (x1 + x2) / 2;
    parts.push(
      `<path d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 2} ${y2}" fill="none" stroke="#64748b" stroke-width="1.6" marker-end="url(#arr)"/>`
    );
    if (e.label) {
      parts.push(
        `<text x="${mx}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-size="11" fill="#94a3b8">${escXml(e.label)}</text>`
      );
    }
  }
  for (const n of nodes) {
    const p = pos.get(n.id)!;
    const rx = n.shape === "ellipse" ? H / 2 : 10;
    parts.push(
      `<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="${rx}" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>`
    );
    const words = n.label;
    parts.push(
      `<text x="${p.x + W / 2}" y="${p.y + H / 2 + 5}" text-anchor="middle" font-size="13" fill="#1e293b">${escXml(words)}</text>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX + 20} ${maxY + 20}" width="100%" style="max-width:720px;background:#fff;border-radius:12px;">${parts.join("")}</svg>`;
}

function cleanNodes(v: unknown): SpecNode[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n) => n && typeof n.id === "string" && typeof n.label === "string")
    .slice(0, 40)
    .map((n) => ({ id: n.id.slice(0, 40), label: n.label.slice(0, 60), shape: typeof n.shape === "string" ? n.shape : undefined }));
}

function cleanEdges(v: unknown, ids: Set<string>): SpecEdge[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((e) => e && ids.has(e.from) && ids.has(e.to))
    .slice(0, 60)
    .map((e) => ({ from: e.from, to: e.to, label: typeof e.label === "string" ? e.label.slice(0, 40) : undefined }));
}

/**
 * drawio_diagram — 生成可在 draw.io / diagrams.net 打开编辑的流程图文件（.drawio），
 * 同时附带一张 SVG 预览图。
 */
export const drawioSkill: ChatSkill = {
  name: "drawio_diagram",
  description:
    "当用户想要一张「可以拿去 draw.io / diagrams.net 打开继续编辑」的流程图、架构图时调用。传入节点和连线，返回 .drawio 文件（可下载后用 draw.io 打开编辑）+ SVG 预览图。节点坐标不用填，会自动布局。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "图表标题（用作文件名）" },
      nodes: {
        type: "array",
        description: "节点列表",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "节点唯一标识，如 n1" },
            label: { type: "string", description: "节点上显示的文字" },
            shape: { type: "string", description: "形状", enum: ["rect", "ellipse", "diamond", "parallelogram"] },
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
            label: { type: "string", description: "连线上的文字（可选）" },
          },
          required: ["from", "to"],
        },
      },
    },
    required: ["nodes", "edges"],
  },
  execute: async (args) => {
    const nodes = cleanNodes(args.nodes);
    if (nodes.length === 0) throw new Error("nodes 不能为空");
    const ids = new Set(nodes.map((n) => n.id));
    const edges = cleanEdges(args.edges, ids);
    const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "流程图";

    const pos = layout(nodes, edges);
    const xml = toDrawioXml(title, nodes, edges, pos);
    const preview = toPreviewSvg(nodes, edges, pos);
    const filename = `${title.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 30) || "diagram"}.drawio`;
    return {
      summary: `已生成可编辑的流程图文件 ${filename}（用 draw.io / diagrams.net 打开继续编辑）`,
      files: [
        { filename, mime: "application/x-drawio", content: xml, previewSvg: preview },
      ],
    };
  },
};
