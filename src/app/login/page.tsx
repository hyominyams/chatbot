"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CLASS_OPTIONS = ["5-1", "5-2", "6-1", "6-2"] as const;

type LoginResponse = {
  sessionId: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [klass, setKlass] = useState<(typeof CLASS_OPTIONS)[number]>(CLASS_OPTIONS[0]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log({ klass, nickname, password });

    if (!nickname.trim() || !password.trim()) {
      setError("닉네임과 비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klass, nickname, password }),
      });
      const payload: LoginResponse & { error?: string } = await response.json();
      if (!response.ok || !payload.sessionId) {
        throw new Error(payload.error || "로그인에 실패했습니다.");
      }

      window.localStorage.setItem(
        "classbot_login",
        JSON.stringify({ klass, nick: nickname, sessionId: payload.sessionId, authed: true })
      );
      router.push("/chat");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <div className="mb-6 text-center space-y-1">
          <div className="text-4xl">🔑</div>
          <h1 className="text-xl font-bold text-blue-500">로그인</h1>
          <p className="text-sm text-slate-500">ClassCoder 챗봇과 함께 코딩 여정을 시작해요!</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm text-slate-700">
          <label className="block space-y-1">
            <span className="font-semibold">학급 선택</span>
            <select
              value={klass}
              onChange={(event) => setKlass(event.target.value as (typeof CLASS_OPTIONS)[number])}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 outline-hidden"
            >
              {CLASS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="font-semibold">닉네임</span>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="닉네임을 입력하세요"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 outline-hidden"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-semibold">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="반 비밀번호를 입력하세요"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 outline-hidden"
            />
          </label>

          {error ? <p className="text-xs font-semibold text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-400 py-2 text-sm font-bold text-white shadow transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            🚀 {loading ? "로그인 중..." : "로그인하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
