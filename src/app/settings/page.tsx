import { redirect } from "next/navigation";

/** 旧地址兼容：LLM 设置已搬入管理后台 */
export default function SettingsRedirect() {
  redirect("/admin/llm");
}
