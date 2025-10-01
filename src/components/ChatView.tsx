"use client";

import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";
import CodeDock from "@/components/CodeDock";
import {
  getMessages,
  sendUserMessage,
  summarizeThread,
  patchThread,
  listThreads,
  type ChatMessage,
  type ThreadSummary,
} from "@/lib/api";

const STORAGE_KEY = "classbot_login";
const TITLE_PLACEHOLDER = "새 채팅";

interface StoredSession {
  sessionId: string;
  klass: string;
  nick: string;
  authed: boolean;
}

interface ChatViewProps {
  threadId: string;
}

export default function ChatView({ threadId }: ChatViewProps) {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [threadTitle, setThreadTitle] = useState<string>(TITLE_PLACEHOLDER);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        router.replace("/login");
        return;
      }
      const stored = JSON.parse(raw) as StoredSession;
      if (!stored?.authed || !stored.sessionId) {
        router.replace("/login");
        return;
      }
      setSession(stored);
    } catch (err) {
      console.error(err);
      router.replace("/login");
    }
  }, [router]);

  const fetchMessages = useCallback(async () => {
    setError(null);
    try {
      const { messages: data } = await getMessages(threadId, 200);
      setMessages(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setInitializing(false);
    }
  }, [threadId]);

  useEffect(() => {
    setInitializing(true);
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const { threads } = await listThreads(session.klass, session.nick, { limit: 200 });
        const match: ThreadSummary | undefined = threads.find((thread) => thread.id === threadId);
        if (match?.title) {
          setThreadTitle(match.title.trim() || TITLE_PLACEHOLDER);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [session, threadId]);

  const handleSend = async () => {
    if (!session || !input.trim()) return;

    const content = input.trim();
    setInput("");
    setPendingUserMessage(content);
    setAssistantTyping(true);
    setLoading(true);
    try {
      await sendUserMessage(session.sessionId, threadId, content);
      await fetchMessages();

      if (!threadTitle || threadTitle === TITLE_PLACEHOLDER) {
        const newTitle = content.slice(0, 30);
        setThreadTitle(newTitle);
        try {
          await patchThread(threadId, { title: newTitle });
        } catch (err) {
          console.error(err);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "user",
          content,
          created_at: new Date().toISOString(),
        },
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `오류: ${message}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setPendingUserMessage(null);
      setAssistantTyping(false);
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      await summarizeThread(threadId);
      alert("요약이 갱신되었습니다.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    } finally {
      setSummarizing(false);
    }
  };

  const assistantMessages = useMemo(
    () => messages.filter((msg) => msg.role === "assistant"),
    [messages]
  );

  const conversationStats = useMemo(() => {
    let userCount = 0;
    let assistantCount = 0;
    messages.forEach((msg) => {
      if (msg.role === "assistant") {
        assistantCount += 1;
      } else if (msg.role === "user") {
        userCount += 1;
      }
    });
    return {
      userCount,
      assistantCount,
      total: messages.length,
    };
  }, [messages]);

  const lastMessageTime = useMemo(() => {
    if (messages.length === 0) return "-";
    const latest = messages[messages.length - 1]?.created_at;
    if (!latest) return "-";
    try {
      return new Date(latest).toLocaleString();
    } catch {
      return latest;
    }
  }, [messages]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-sm text-slate-600">
        세션 정보를 찾을 수 없습니다. 다시 로그인해 주세요.
      </div>
    );
  }

  const sidebarSections = (
    <div className="flex flex-col gap-4 text-xs text-slate-600">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-blue-600">대화 정보</h2>
        <dl className="space-y-1">
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-500">반</dt>
            <dd>{session.klass}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-500">닉네임</dt>
            <dd>{session.nick}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-500">총 메시지</dt>
            <dd>{conversationStats.total}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-500">학생</dt>
            <dd>{conversationStats.userCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-500">어시스턴트</dt>
            <dd>{conversationStats.assistantCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-500">마지막 활동</dt>
            <dd className="text-right">{lastMessageTime}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-blue-600">활용 팁</h2>
        <ul className="space-y-1 leading-relaxed">
          <li>- 진행 단계에 맞춰 아이디어를 정리해 주세요.</li>
          <li>- "요약 갱신"으로 긴 대화를 정리할 수 있어요.</li>
          <li>- 완성된 코드는 코드 도크에서 복사해 활용하세요.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-blue-600">기능 빠른 실행</h2>
        <button
          type="button"
          onClick={handleSummarize}
          disabled={summarizing}
          className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {summarizing ? "요약 중..." : "요약 바로 갱신"}
        </button>
      </section>
    </div>
  );


  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-blue-50/60 font-[\'Noto Sans KR\',_sans-serif]">
      <header className="border-b border-blue-100 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-blue-600">
              💬 {threadTitle}
            </h1>
            <p className="text-xs text-slate-500">{session.klass} · {session.nick}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
            </button>
            <button
              type="button"
              onClick={handleSummarize}
              disabled={summarizing}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              🤖 {summarizing ? "요약 중" : "요약 갱신"}
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="mx-auto w-full max-w-3xl flex flex-col gap-5 flex-1 overflow-y-auto px-4 py-6">
            {initializing && <p className="text-sm text-slate-500">불러오는 중...</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {messages.length === 0 && !initializing && !error && (
              <p className="text-sm text-slate-500">대화를 시작해 보세요.</p>
            )}
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              return (
                <article
                  key={msg.id}
                  className={`max-w-[65ch] sm:max-w-[70ch] rounded-xl px-4 py-2 shadow-sm transition ${
                    isAssistant
                      ? "self-start border border-blue-100 bg-white"
                      : "self-end border border-blue-200 bg-blue-100"
                  }`}
                >
                  <span className="mb-0.5 block text-xs font-semibold text-blue-500">
                    {isAssistant ? "🤖 어시스턴트" : "🧒 학생"}
                  </span>
                  <div className="text-[15px] leading-relaxed text-slate-700">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                </article>
              );
            })}
            {pendingUserMessage ? (
              <article className="max-w-[65ch] sm:max-w-[70ch] self-end rounded-xl border border-blue-200 bg-blue-100 px-4 py-2 shadow-sm animate-pulse">
                <span className="mb-0.5 block text-xs font-semibold text-blue-500">🧒 학생</span>
                <div className="text-[15px] leading-relaxed text-slate-700">...</div>
              </article>
            ) : null}
            {assistantTyping ? (
              <article className="max-w-[65ch] sm:max-w-[70ch] self-start rounded-xl border border-blue-100 bg-white px-4 py-2 shadow-sm animate-pulse">
                <span className="mb-0.5 block text-xs font-semibold text-blue-500">🤖 어시스턴트</span>
                <div className="text-[15px] leading-relaxed text-slate-700">...</div>
              </article>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <section className="mx-auto w-full max-w-3xl px-4 pb-4">
            <CodeDock messages={assistantMessages} />
          </section>
        </div>

        {sidebarOpen ? (
          <>
            <div className="fixed right-0 top-24 z-40 flex h-[calc(100vh-6rem)] w-64 flex-col border-l border-blue-100 bg-white/95 p-4 shadow-xl md:hidden">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-blue-600">사이드 패널</h2>
                  <p className="text-xs text-slate-500">대화 흐름과 도움말을 확인해 보세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                >
                  닫기
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sidebarSections}
              </div>
            </div>
            <aside className="hidden w-72 shrink-0 border-l border-blue-100 bg-white/80 p-5 text-sm text-slate-600 shadow-[0_0_12px_rgba(15,23,42,0.05)] md:flex md:flex-col">
              <header className="mb-4">
                <h2 className="text-sm font-semibold text-blue-600">사이드 패널</h2>
                <p className="text-xs text-slate-500">대화 흐름과 도움말을 확인해 보세요.</p>
              </header>
              <div className="flex-1 overflow-y-auto">
                {sidebarSections}
              </div>
            </aside>
          </>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-blue-100 bg-white/90 px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.05)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-5"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요 (Enter: 전송 / Shift+Enter: 줄바꿈)"
            className="h-24 flex-1 resize-none rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-hidden focus:(ring-2 ring-blue-400 outline-hidden)"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            📩 {loading ? "전송 중..." : "전송"}
          </button>
        </form>
      </footer>
    </div>
  );
}
