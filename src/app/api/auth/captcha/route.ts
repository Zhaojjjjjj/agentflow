import { NextResponse } from "next/server";
import { CAPTCHA_COOKIE, generateCode, generateSvg, signCode } from "@/lib/captcha";
import { isProduction } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 颁发图形验证码：返回 SVG，同时把答案签名写入 httpOnly cookie（5 分钟有效，一次性使用）。 */
export async function GET() {
  const code = generateCode(4);
  const svg = generateSvg(code);
  const signed = await signCode(code);
  const res = NextResponse.json({ svg: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` });
  if (signed) {
    res.cookies.set(CAPTCHA_COOKIE, signed, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 60,
    });
  }
  return res;
}
