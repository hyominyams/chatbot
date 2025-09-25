"use client";

import { useRouter } from "next/navigation";

interface LogoutButtonProps {
  className?: string;
}

export default function LogoutButton({ className = "" }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = () => {
    try {
      window.localStorage.removeItem("classbot_login");
    } catch (err) {
      console.error("Failed to clear session", err);
    }
    router.replace("/login");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 ${className}`.trim()}
    >
      🔓 로그아웃
    </button>
  );
}
