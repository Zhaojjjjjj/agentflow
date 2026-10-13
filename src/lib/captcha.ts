// 轻量图形验证码（无外部依赖，纯 SVG）。
// 流程：GET /api/auth/captcha 返回 SVG，同时把答案签名后写入 httpOnly cookie（5 分钟有效）；
// 登录时提交 captcha 字段，后端验签比对，一次性使用。

import { SignJWT, jwtVerify } from "jose";

export const CAPTCHA_COOKIE = "agentflow_captcha";
const EXPIRES_IN = "5m";

// 易混淆字符已剔除（0/O、1/l/I）
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function getSecret(): Uint8Array | null {
  const raw = process.env.AUTH_SECRET || process.env.APP_ENCRYPTION_KEY || "";
  return raw ? new TextEncoder().encode(raw) : null;
}

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

export function generateCode(length = 4): string {
  let s = "";
  for (let i = 0; i < length; i++) s += CHARS[rand(CHARS.length)];
  return s;
}

/** 生成验证码 SVG（120×44，字符随机旋转/错位 + 干扰线/点） */
export function generateSvg(code: string): string {
  const W = 120;
  const H = 44;
  let chars = "";
  const step = W / (code.length + 1);
  for (let i = 0; i < code.length; i++) {
    const x = step * (i + 1) + (Math.random() * 8 - 4);
    const y = H / 2 + (Math.random() * 10 - 5);
    const rotate = Math.random() * 36 - 18;
    const size = 22 + Math.random() * 6;
    const colors = ["#7C3AED", "#4F46E5", "#0F766E", "#B45309", "#1D4ED8"];
    const c = colors[rand(colors.length)];
    chars += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rotate.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" font-family="Georgia, 'Times New Roman', serif" font-size="${size.toFixed(0)}" font-weight="bold" font-style="italic" fill="${c}">${code[i]}</text>`;
  }
  let noise = "";
  for (let i = 0; i < 4; i++) {
    const x1 = rand(W);
    const y1 = rand(H);
    const x2 = rand(W);
    const y2 = rand(H);
    noise += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#C4B5FD" stroke-width="1.2" opacity="0.7"/>`;
  }
  for (let i = 0; i < 24; i++) {
    noise += `<circle cx="${rand(W)}" cy="${rand(H)}" r="${(Math.random() * 1.6 + 0.6).toFixed(1)}" fill="#DDD6FE"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="8" fill="#F8FAFC"/>${noise}${chars}</svg>`;
}

/** 签发答案 cookie 的值（5 分钟有效）。无签名密钥时返回 null。 */
export async function signCode(code: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  return await new SignJWT({ code: code.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(secret);
}

/** 校验用户输入与 cookie 中的答案（忽略大小写）。 */
export async function verifyCode(input: string, token: string | undefined | null): Promise<boolean> {
  if (!input || !token) return false;
  const secret = getSecret();
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return typeof payload.code === "string" && payload.code === input.trim().toLowerCase();
  } catch {
    return false;
  }
}
