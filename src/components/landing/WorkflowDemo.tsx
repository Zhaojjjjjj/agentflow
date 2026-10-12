"use client";

import { useEffect, useState } from "react";

/**
 * 实时演绎的 SVG 工作流：触发器 → LLM → 工具调用 → 人工审批 → 输出
 * 节点按顺序依次点亮，边线虚线流动，发光圆点沿路径循环行进。
 * 纯手写 SVG，无外部资源。
 */

const W = 100;
const H = 44;

const NODES = [
  { id: "trigger", label: "触发器", sub: "MANUAL", x: 8, y: 104 },
  { id: "llm", label: "LLM 推理", sub: "CHAT", x: 140, y: 56 },
  { id: "tool", label: "工具调用", sub: "HTTP", x: 272, y: 104 },
  { id: "approval", label: "人工审批", sub: "HUMAN", x: 404, y: 56 },
  { id: "output", label: "输出", sub: "JSON", x: 532, y: 104 },
];

function edgePath(a: (typeof NODES)[number], b: (typeof NODES)[number]) {
  const x1 = a.x + W;
  const y1 = a.y + H / 2;
  const x2 = b.x;
  const y2 = b.y + H / 2;
  return `M ${x1} ${y1} C ${x1 + 26} ${y1}, ${x2 - 26} ${y2}, ${x2} ${y2}`;
}

const EDGES = NODES.slice(0, -1).map((n, i) => edgePath(n, NODES[i + 1]));

export default function WorkflowDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % NODES.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <svg viewBox="0 0 640 260" className="w-full" role="img" aria-label="工作流执行演示">
        <defs>
          <filter id="wf-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* edges */}
        {EDGES.map((d, i) => {
          const lit = i < active;
          return (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke={lit ? "rgba(139,92,246,0.55)" : "rgba(255,255,255,0.10)"}
                strokeWidth={1.2}
                className={lit ? "edge-flow" : undefined}
                style={{ transition: "stroke 400ms" }}
              />
              {lit && (
                <circle r={2.6} fill="#A78BFA" filter="url(#wf-glow)">
                  <animateMotion dur={`${2.6 + i * 0.4}s`} begin={`${-i * 0.8}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {NODES.map((n, i) => {
          const lit = i <= active;
          const isActive = i === active;
          return (
            <g key={n.id} opacity={lit ? 1 : 0.3} style={{ transition: "opacity 450ms ease" }}>
              {isActive && (
                <rect
                  x={n.x - 5}
                  y={n.y - 5}
                  width={W + 10}
                  height={H + 10}
                  rx={15}
                  fill="none"
                  stroke="#8B5CF6"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  filter="url(#wf-glow)"
                />
              )}
              <rect
                x={n.x}
                y={n.y}
                width={W}
                height={H}
                rx={10}
                fill={isActive ? "#171425" : "#101014"}
                stroke={isActive ? "#8B5CF6" : "rgba(255,255,255,0.14)"}
                strokeWidth={1.2}
                style={{ transition: "stroke 400ms, fill 400ms" }}
              />
              <circle cx={n.x + 15} cy={n.y + H / 2} r={3} fill={isActive ? "#A78BFA" : "#3F3F46"} />
              <text x={n.x + 25} y={n.y + 20} fill="#fff" fontSize={12} fontWeight={600}>
                {n.label}
              </text>
              <text
                x={n.x + 25}
                y={n.y + 34}
                fill="rgba(255,255,255,0.38)"
                fontSize={8.5}
                fontFamily="ui-monospace, monospace"
                letterSpacing={1.5}
              >
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>

      {/* live status line */}
      <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3 font-mono text-[11px] tracking-wide text-white/40">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        <span>
          step {active + 1}/5 · {NODES[active].label} 运行中
        </span>
        <span className="ml-auto hidden sm:inline">durable execution</span>
      </div>
    </div>
  );
}
