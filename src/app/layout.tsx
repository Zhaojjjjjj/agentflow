import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "agentflow · Agent 工作流编排平台",
  description: "可视化 AI Agent 工作流编排与执行平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
