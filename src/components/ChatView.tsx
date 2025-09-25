"use client";

import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

interface ChatViewProps {
  threadId: string;
}

export default function ChatView({ threadId }: ChatViewProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [klass, setKlass] = useState<string | null>(null);
  const [nick, setNick] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState<string>(TITLE_PLACEHOLDER);
  const [contextSummary, setContextSummary] = useState<string>("");
  const [contextRecent, setContextRecent] = useState<ChatMessage[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSessionId(parsed?.sessionId ?? null);
      setKlass(parsed?.klass ?? null);
      setNick(parsed?.nick ?? null);
    } catch (err) {
      console.error("세션 복원 실패", err);
    }
  }, []);

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

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    setContextError(null);
    try {
      const { summary, recent } = await getContext(threadId, 12);
      setContextSummary(summary);
      setContextRecent(recent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setContextError(message);
    } finally {
      setContextLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    setInitializing(true);
    fetchMessages();
    loadContext();
  }, [fetchMessages, loadContext]);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!klass || !nick) return;
    (async () => {
      try {
        const { threads } = await listThreads(klass, nick, { limit: 200 });
        const current = threads.find((item: ThreadSummary) => item.id === threadId);
        if (current?.title) {
          setThreadTitle(current.title);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [klass, nick, threadId]);

  const handleSubmit = async () => {
    const content = text.trim();
    if (!content) return;
    if (!sessionId) {
      alert("로그인이 필요합니다.");
      return;
    }

    setText("");
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
      await sendUserMessage(sessionId, threadId, content);
      await fetchMessages();
      await loadContext();

      if (!threadTitle || threadTitle === TITLE_PLACEHOLDER) {
        const newTitle = content.slice(0, 30);
        try {
          await patchThread(threadId, { title: newTitle });
          setThreadTitle(newTitle);
        } catch (err) {
          console.error("스레드 제목 업데이트 실패", err);
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
      void handleSubmit();
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      await summarizeThread(threadId);
      await loadContext();
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

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-800">{threadTitle}</h1>
        <p className="text-xs text-gray-500">{klass ? `${klass} · ${nick ?? ""}` : ""}</p>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">요약</h2>
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              className="rounded-lg bg-blue-400 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {summarizing ? "갱신 중..." : "요약 갱신"}
            </button>
          </div>
          {contextLoading ? (
            <p className="text-sm text-gray-500">요약을 불러오는 중...</p>
          ) : contextError ? (
            <p className="text-sm text-red-500">{contextError}</p>
          ) : contextSummary ? (
            <Markdown>{contextSummary}</Markdown>
          ) : (
            <p className="text-sm text-gray-500">요약이 없습니다. 버튼을 눌러 생성해 보세요.</p>
          )}

          {contextRecent.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">최근 대화</h3>
              <ul className="space-y-2">
                {contextRecent.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  >
                    <div className="mb-1 text-xs text-gray-500">
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
          <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {initializing && <p className="text-sm text-gray-500">불러오는 중...</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {messages.length === 0 && !initializing && !error && (
              <p className="text-sm text-gray-500">대화가 없습니다. 메시지를 입력해보세요.</p>
            )}
            {messages.map((msg) => (
              <article
                key={msg.id}
                className={`max-w-xl rounded-lg border px-3 py-2 shadow-sm ${
                  msg.role === "assistant"
                    ? "mr-auto bg-indigo-50 border-indigo-100 text-left"
                    : "ml-auto bg-white border-gray-200 text-right"
                }`}
              >
                <div className="mb-1 text-xs font-semibold text-gray-500">
                  {msg.role === "assistant" ? "어시스턴트" : "학생"}
                </div>
                <Markdown>{msg.content}</Markdown>
              </article>
            ))}
            <div ref={endRef} />
          </div>

          <CodeDock messages={assistantMessages} />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요"
              className="max-h-60 min-h-[120px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
