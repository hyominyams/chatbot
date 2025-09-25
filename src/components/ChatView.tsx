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
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-blue-50/60 font-[\'Noto Sans KR\',_sans-serif]">
      <header className="border-b border-blue-100 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-blue-600">
              💬 {threadTitle}
            </h1>
            <p className="text-xs text-slate-500">{session.klass} · {session.nick}</p>
          </div>
          <button
            type="button"
            onClick={handleSummarize}
            disabled={summarizing}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            🤖 {summarizing ? "요약 중" : "요약 갱신"}
          </button>
        </div>
      </header>

      <main className="flex flex-col overflow-hidden">
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto px-6 py-6">
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
                className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm ${
                  isAssistant
                    ? "self-start border border-blue-100 bg-white"
                    : "self-end border border-blue-200 bg-blue-100"
                }`}
              >
                <span className="mb-1 block text-xs font-semibold text-blue-500">
                  {isAssistant ? "🤖 어시스턴트" : "🧒 학생"}
                </span>
                <div className="text-[15px] leading-relaxed text-slate-700">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </article>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <section className="px-6 pb-4">
          <CodeDock messages={assistantMessages} />
        </section>
      </main>

      <footer className="sticky bottom-0 border-t border-blue-100 bg-white/90 px-6 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.05)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
          className="flex items-end gap-3"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요 (Enter: 전송 / Shift+Enter: 줄바꿈)"
            className="h-24 flex-1 resize-none rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400 outline-hidden"
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
