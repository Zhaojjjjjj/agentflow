"use client";

import { useEffect, useState } from "react";

/**
 * 可视化编排卡内的流动画：节点按拓扑顺序依次点亮，
 * 边线虚线流动，发光圆点沿路径行进，循环往复。
 * 纯手写 SVG，无外部资源。
 */

const NODES = [
  { x: 8, y: 26 },
  { x: 78, y: 8 },
  { x: 78, y: 46 },
  { x: 148, y: 26 },
];

const EDGES = [
  "M52 36 C 62 36, 66 18, 78 18",
  "M52 36 C 62 36, 66 56, 78 56",
  "M122 18 C 134 18, 136 32, 148 32",
  "M122 56 C 134 56, 136 40, 148 40",
];

// 每个 step 点亮的节点与边（拓扑顺序）
const STEPS: { nodes: number[]; edges: number[] }[] = [
  { nodes: [0], edges: [] },
  { nodes: [0, 1, 2], edges: [0, 1] },
  { nodes: [0, 1, 2, 3], edges: [0, 1, 2, 3] },
  { nodes: [0, 1, 2, 3], edges: [0, 1, 2, 3] },
];

export default function DagFlowMini() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1300);
    return () => clearInterval(t);
  }, []);

  const { nodes: litNodes, edges: litEdges } = STEPS[step];

  return (
    <svg viewBox="0 0 200 72" className="mt-6 w-full" aria-hidden>
      <defs>
        <filter id="dag-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* edges */}
      {EDGES.map((d, i) => {
        const lit = litEdges.includes(i);
        return (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke={lit ? "rgba(124,58,237,0.65)" : "rgba(15,23,42,0.10)"}
              strokeWidth={1.2}
              className={lit ? "edge-flow" : undefined}
              style={{ transition: "stroke 350ms" }}
            />
            {lit && (
              <circle r={2.2} fill="#7C3AED" filter="url(#dag-glow)">
                <animateMotion dur="1.6s" repeatCount="indefinite" path={d} />
              </circle>
            )}
          </g>
        );
      })}

      {/* nodes */}
      {NODES.map((n, i) => {
        const active = litNodes.includes(i);
        return (
          <g key={i} style={{ transition: "opacity 350ms" }} opacity={active ? 1 : 0.55}>
            <rect
              x={n.x}
              y={n.y}
              width={44}
              height={20}
              rx={6}
              fill={active ? "#F5F3FF" : "#FFFFFF"}
              stroke={active ? "#7C3AED" : "rgba(15,23,42,0.14)"}
              strokeWidth={active ? 1.6 : 1.2}
              filter={active ? "url(#dag-glow)" : undefined}
              style={{ transition: "stroke 350ms, fill 350ms" }}
            />
            {active && <circle cx={n.x + 22} cy={n.y + 10} r={2.4} fill="#7C3AED" />}
          </g>
        );
      })}
    </svg>
  );
}
