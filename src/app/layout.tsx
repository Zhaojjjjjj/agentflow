import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/toast";

export const metadata: Metadata = {
  title: "AgentFlow · Agent 工作流编排平台",
  description: "可视化 AI Agent 工作流编排与执行平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-white text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
