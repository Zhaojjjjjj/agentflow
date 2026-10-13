"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/toast";
import { PageHeader, Button, Field, Input } from "@/components/ui";
import { useMe, type MeUser } from "@/components/UserMenu";

function AvatarBlock({ user, onChanged }: { user: MeUser; onChanged: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/account/avatar", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "上传失败");
      setPreview(null);
      onChanged(j.avatar_url);
      toast.success("头像已更新");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const src = preview || user.avatar_url;
  return (
    <div className="flex items-center gap-5">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="头像" width={72} height={72} className="rounded-full object-cover ring-2 ring-slate-100" />
      ) : (
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-600 text-2xl font-semibold text-white">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setPreview(URL.createObjectURL(f));
              void upload(f);
            }
            e.target.value = "";
          }}
        />
        <Button variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "上传中…" : "更换头像"}
        </Button>
        <p className="mt-1.5 text-xs text-slate-400">PNG / JPEG / WebP / GIF，不超过 2MB</p>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (newPw !== newPw2) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "修改失败");
      toast.success("密码已修改");
      setOldPw("");
      setNewPw("");
      setNewPw2("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "修改失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm space-y-4">
      <Field label="原密码">
        <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="新密码（至少 6 位）">
        <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="确认新密码">
        <Input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" />
      </Field>
      <Button variant="primary" disabled={busy || !oldPw || !newPw} onClick={submit}>
        {busy ? "保存中…" : "修改密码"}
      </Button>
    </div>
  );
}

export default function AccountPage() {
  const me = useMe();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (me) setAvatarUrl(me.avatar_url);
  }, [me]);

  if (me === undefined) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-slate-400">加载中…</p>
      </main>
    );
  }
  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-slate-400">未登录</p>
      </main>
    );
  }
  const user: MeUser = { ...me, avatar_url: avatarUrl ?? me.avatar_url };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader title="个人设置" desc="管理你的头像与登录密码" />
      <section className="card mb-6 p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">头像</h3>
        <AvatarBlock user={user} onChanged={setAvatarUrl} />
      </section>
      <section className="card mb-6 p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">账号信息</h3>
        <div className="grid max-w-sm gap-4">
          <Field label="用户名">
            <Input value={user.username} disabled />
          </Field>
          <Field label="角色">
            <Input value={user.role === "admin" ? "管理员" : "普通用户"} disabled />
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          LLM 供应商由管理员统一配置，所有用户共用，无需单独设置。
        </p>
      </section>
      <section className="card p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">修改密码</h3>
        <PasswordForm />
      </section>
    </main>
  );
}
