"use client";

/**
 * agentflow 品牌标识 —— 「冻结的执行瞬间」
 * 纯几何构图：300° 圆环（缺口即方向）+ 缺口端点的彗头圆点 + 中心节点圆点。
 * 扁平单色 #7C3AED，无渐变。
 */
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="agentflow" role="img">
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#7C3AED" />
      <path
        d="M47.0 34.0 A15 15 0 1 1 39.5 21.0"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle cx="39.5" cy="21.0" r="4.2" fill="#FFFFFF" />
      <circle cx="32" cy="34" r="6" fill="#FFFFFF" />
    </svg>
  );
}
