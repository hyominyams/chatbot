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
  getContext,
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
  const [summary, setSummary] = useState<string>("");
  const [recent, setRecent] = useState<ChatMessage[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        router.replace("/");
        return;
      }
      const stored = JSON.parse(raw) as StoredSession;
      if (!stored?.authed || !stored.sessionId) {
        router.replace("/");
        return;
      }
      setSession(stored);
    } catch (err) {
      console.error(err);
      router.replace("/");
    }
  }, [router]);

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
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

  const fetchContext = useCallback(async () => {
    if (!threadId) return;
    setContextLoading(true);
    setContextError(null);
    try {
      const { summary, recent } = await getContext(threadId, 12);
      setSummary(summary);
      setRecent(recent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setContextError(message);
    } finally {
      setContextLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    setInitializing(true);
    void fetchMessages();
    void fetchContext();
  }, [fetchMessages, fetchContext]);

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
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      },
    ]);

    setLoading(true);
    try {
      await sendUserMessage(session.sessionId, threadId, content);
      await fetchMessages();
      await fetchContext();

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
          id: Date.now() + 1,
          role: "assistant",
          content: `오류: ${message}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
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
      await fetchContext();
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

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-sm text-slate-600">
        세션 정보를 찾을 수 없습니다. 다시 로그인해 주세요.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">{threadTitle}</h1>
        <p className="text-xs text-slate-500">{session.klass} · {session.nick}</p>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden bg-slate-50 p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">요약</h2>
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              className="rounded-lg bg-blue-400 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {summarizing ? "갱신 중..." : "요약 갱신"}
            </button>
          </div>
          {contextLoading ? (
            <p className="text-sm text-slate-500">요약을 불러오는 중...</p>
          ) : contextError ? (
            <p className="text-sm text-red-500">{contextError}</p>
          ) : summary ? (
            <Markdown>{summary}</Markdown>
          ) : (
            <p className="text-sm text-slate-500">요약이 없습니다. 버튼을 눌러 생성해 보세요.</p>
          )}

          {recent.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">최근 대화</h3>
              <ul className="space-y-2">
                {recent.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                  >
                    <div className="mb-1 text-xs text-slate-500">
                      {item.role === "assistant" ? "어시스턴트" : "학생"}
                    </div>
                    <div>{item.content}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            {initializing && <p className="text-sm text-slate-500">불러오는 중...</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {messages.length === 0 && !initializing && !error && (
              <p className="text-sm text-slate-500">대화를 시작해 보세요.</p>
            )}
            {messages.map((msg) => (
              <article
                key={msg.id}
                className={`max-w-xl rounded-lg border px-3 py-2 shadow-xs ${
                  msg.role === "assistant"
                    ? "mr-auto bg-indigo-50 border-indigo-100 text-left"
                    : "ml-auto bg-white border-slate-200 text-right"
                }`}
              >
                <div className="mb-1 text-xs font-semibold text-slate-500">
                  {msg.role === "assistant" ? "어시스턴트" : msg.role === "system" ? "시스템" : "학생"}
                </div>
                <Markdown>{msg.content}</Markdown>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          <CodeDock messages={assistantMessages} />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요"
              className="min-h-[120px] max-h-64 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={loading}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-400 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "전송 중..." : "보내기"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
