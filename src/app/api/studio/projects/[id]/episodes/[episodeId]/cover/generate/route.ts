import { NextResponse } from "next/server";

/** 已下线：封面改为手动上传，不再提供后端生图。保留此存根避免旧构建引用失败。 */
const gone = () => NextResponse.json({ error: "已下线：封面请手动上传" }, { status: 410 });

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}
