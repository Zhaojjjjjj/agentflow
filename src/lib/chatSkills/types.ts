/** Luna chat skills — tools the chat model can call to produce files. */

export interface SkillFile {
  filename: string;
  mime: string;
  content: string;
  /** short inline preview (safe SVG string) when available */
  previewSvg?: string;
}

export interface SkillResult {
  /** one-line summary fed back to the model (and shown as a status) */
  summary: string;
  files: SkillFile[];
}

export interface ChatSkill {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<SkillResult>;
}

export function escXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function slug(s: string): string {
  return s.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 30) || "diagram";
}
