"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/toast";
import { PageHeader, Badge, Skeleton, EmptyState } from "@/components/ui";

interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  is_published: boolean;
  updated_at: string;
  owner_id: string | null;
  owner_name: string | null;
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "昨天" : `${d} 天前`;
}

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setWorkflows(j.workflows || []);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="工作流管理" desc="所有用户创建的工作流（管理员视角）" />

      {loading ? (
        <Skeleton rows={5} />
      ) : workflows.length === 0 ? (
        <EmptyState title="还没有工作流" description="用户在控制台新建工作流后会显示在这里" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs text-slate-400">
                  <th className="px-5 py-2.5 font-medium">工作流</th>
                  <th className="px-4 py-2.5 font-medium">创建者</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">版本</th>
                  <th className="px-4 py-2.5 font-medium">更新时间</th>
                  <th className="px-5 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w) => (
                  <tr key={w.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{w.name}</p>
                      {w.description && (
                        <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">{w.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {w.owner_name ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                            {w.owner_name.slice(0, 1).toUpperCase()}
                          </span>
                          {w.owner_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {w.is_published ? (
                        <Badge tone="green">已发布</Badge>
                      ) : (
                        <Badge tone="gray">草稿</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">v{w.version}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(w.updated_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/workflows/${w.id}`}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        打开 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
