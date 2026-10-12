"use client";

export default function LogoutButton() {
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };
  return (
    <button className="btn-secondary" onClick={logout}>
      退出登录
    </button>
  );
}
