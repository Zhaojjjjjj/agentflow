import { NextResponse } from "next/server";

/** 已下线：封面生图配置已移除（手动生图，不再需要后端配置）。保留此存根避免旧构建引用失败。 */
const gone = () => NextResponse.json({ error: "已下线" }, { status: 410 });

export async function GET() {
  return gone();
}

export async function PUT() {
  return gone();
}
