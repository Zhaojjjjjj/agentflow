"use client";

import { useId } from "react";

/** agentflow 品牌标识：三节点 + 流动曲线 */
export default function Logo({ size = 28 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = `afg-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="agentflow" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${gid})`} />
      <path
        d="M14 42 C 22 42, 24 22, 32 22 C 40 22, 42 42, 50 42"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle cx="14" cy="42" r="6.5" fill="#FFFFFF" />
      <circle cx="32" cy="22" r="6.5" fill="#6D28D9" />
      <circle cx="32" cy="22" r="6.5" fill="none" stroke="#FFFFFF" strokeWidth="4" />
      <circle cx="50" cy="42" r="6.5" fill="#FFFFFF" />
    </svg>
  );
}
