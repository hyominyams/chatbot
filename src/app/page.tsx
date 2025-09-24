"use client";

import { FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "classbot_login";

type ChatRole = "user" | "assistant" | "system";

type ChatMessage = {
  id?: number | string;
  role: ChatRole;
  content: string;
  created_at?: string;
};

type StoredSession = {
  klass?: string;
  nick?: string;
  authed?: boolean;
  sessionId?: string;
};

export default function Home() {
  const [klass, setKlass] = useState("");
  const [pwd, setPwd] = useState("");
  const [nick, setNick] = useState("");
  const [authed, setAuthed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<ChatMessage[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMessages = async (session: string) => {
    try {
      const res = await fetch(
        `/api/messages?sessionId=${encodeURIComponent(session)}&limit=50`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "메시지 불러오기 실패");
      }

      const messages: ChatMessage[] = (Array.isArray(data?.messages)
        ? data.messages
        : [])
        .map((item: any, index: number): ChatMessage => {
          const role: ChatRole =
            item?.role === "assistant" || item?.role === "system"
              ? item.role
              : "user";
          return {
            id: item?.id ?? index,
            role,
            content: typeof item?.content === "string" ? item.content : "",
            created_at:
              typeof item?.created_at === "string" ? item.created_at : undefined,
          };
        });

      setLog(messages);
    } catch (error) {
      console.error(error);
      alert((error as Error).message);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedRaw = window.localStorage.getItem(STORAGE_KEY);
    if (!storedRaw) {
      return;
    }

    try {
      const stored = JSON.parse(storedRaw) as StoredSession;
      if (!stored?.authed || !stored.sessionId) {
        return;
      }

      setAuthed(true);
      setSessionId(stored.sessionId);
      if (stored.klass) setKlass(stored.klass);
      if (stored.nick) setNick(stored.nick);
      void fetchMessages(stored.sessionId);
    } catch (error) {
      console.error("세션 복원 실패", error);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!klass || !pwd || !nick) {
      alert("반/암호/닉네임을 입력하세요.");
      return;
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klass, password: pwd, nickname: nick }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "로그인 실패");
      }

      const session = {
        klass,
        nick,
        authed: true,
        sessionId: payload.sessionId as string,
      } satisfies StoredSession;

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setAuthed(true);
      setSessionId(session.sessionId ?? null);
      setPwd("");
      await fetchMessages(session.sessionId ?? "");
    } catch (error) {
      console.error(error);
      alert((error as Error).message);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setSessionId(null);
    setLog([]);
    setMsg("");
  };

  const send = async () => {
    const text = msg.trim();
    if (!text) {
      return;
    }

    if (!sessionId) {
      alert("먼저 로그인하세요.");
      return;
    }

    setMsg("");
    setLog((prev) => [...prev, { role: "user", content: text }]);

    try {
      const saveUser = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "user", content: text }),
      });
      if (!saveUser.ok) {
        const errorBody = await saveUser.json();
        throw new Error(errorBody?.error || "사용자 메시지 저장 실패");
      }
    } catch (error) {
      console.error(error);
    }

    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "모델 호출 실패");
      }

      const content = typeof payload?.content === "string" ? payload.content : "";
      setLog((prev) => [...prev, { role: "assistant", content }]);


    } catch (error) {
      console.error(error);
      setLog((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `오류: ${(error as Error).message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMessage = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ClassCoder Chatbot</h1>
        {authed ? (
          <button
            className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-600"
            onClick={handleLogout}
          >
            로그아웃
          </button>
        ) : null}
      </header>

      {!authed ? (
        <section className="rounded border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-medium">로그인</h2>
          <form className="flex flex-col gap-3" onSubmit={handleLogin}>
            <label className="flex flex-col gap-1 text-sm">
              <span>반</span>
              <input
                className="rounded border border-slate-600 bg-slate-800 p-2"
                value={klass}
                onChange={(event) => setKlass(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>암호</span>
              <input
                className="rounded border border-slate-600 bg-slate-800 p-2"
                type="password"
                value={pwd}
                onChange={(event) => setPwd(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>닉네임</span>
              <input
                className="rounded border border-slate-600 bg-slate-800 p-2"
                value={nick}
                onChange={(event) => setNick(event.target.value)}
              />
            </label>
            <button
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              type="submit"
            >
              로그인
            </button>
          </form>
        </section>
      ) : null}

      {authed ? (
        <section className="flex flex-col gap-4">
          <div className="rounded border border-slate-700 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-medium">대화 로그</h2>
            <div className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 text-sm">
              {log.length === 0 ? (
                <p className="text-slate-400">아직 대화가 없습니다.</p>
              ) : (
                log.map((item, index) => (
                  <div key={item.id ?? index} className="flex flex-col gap-1">
                    <span className="text-xs uppercase text-slate-500">
                      {item.role === "assistant"
                        ? "어시스턴트"
                        : item.role === "system"
                        ? "시스템"
                        : nick || "사용자"}
                    </span>
                    <p className="whitespace-pre-wrap text-slate-200">{item.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <form className="flex flex-col gap-3" onSubmit={handleSubmitMessage}>
            <textarea
              className="min-h-[120px] rounded border border-slate-700 bg-slate-900 p-3 text-sm"
              placeholder="메시지를 입력하세요"
              value={msg}
              onChange={(event) => setMsg(event.target.value)}
              disabled={loading}
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-slate-600"
                type="submit"
                disabled={loading}
              >
                {loading ? "응답 대기 중..." : "보내기"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}





