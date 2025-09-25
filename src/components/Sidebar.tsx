"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createThread,
  listThreads,
  patchThread,
  type ThreadSummary,
} from "@/lib/api";

const STORAGE_KEY = "classbot_login";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [klass, setKlass] = useState<string | null>(null);
  const [nick, setNick] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const activeThreadId = useMemo(() => {
    const parts = pathname?.split("/") ?? [];
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  }, [pathname]);

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
      console.error("세션 정보를 불러오지 못했습니다.", err);
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    if (!klass || !nick) return;
    setLoading(true);
    setError(null);
    try {
      const { threads: items } = await listThreads(klass, nick, {
        query: search.trim() || undefined,
        limit: 100,
      });
      setThreads(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [klass, nick, search]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  const handleNewThread = async () => {
    if (!sessionId) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      const { threadId } = await createThread(sessionId);
      await refreshThreads();
      router.push(`/chat/${threadId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    }
  };

  const grouped = useMemo(() => {
    const pinned = threads.filter((thread) => Boolean(thread.pinned));
    const regular = threads.filter((thread) => !thread.pinned);
    return { pinned, regular };
  }, [threads]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  return (
    <aside className="flex h-full w-72 flex-col gap-6 border-r border-gray-200 bg-gray-50 p-6">
      <header>
        <div className="text-lg font-semibold text-gray-800">ClassCoder</div>
        <div className="text-xs text-gray-500">
          {klass ? `${klass} · ${nick ?? ""}` : "로그인이 필요합니다"}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="스레드 검색"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          onClick={handleNewThread}
          className="w-full rounded-lg bg-blue-400 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          새 채팅
        </button>
        <button
          onClick={() => refreshThreads()}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
        >
          새로고침
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-xs text-gray-500">불러오는 중...</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!loading && !error && threads.length === 0 && (
          <p className="text-xs text-gray-500">스레드가 없습니다.</p>
        )}

        <ThreadSection
          title="고정됨"
          threads={grouped.pinned}
          activeThreadId={activeThreadId}
          formatter={formatter}
          refreshThreads={refreshThreads}
        />
        <ThreadSection
          title="전체"
          threads={grouped.regular}
          activeThreadId={activeThreadId}
          formatter={formatter}
          refreshThreads={refreshThreads}
        />
      </div>
    </aside>
  );
}

function ThreadSection({
  title,
  threads,
  activeThreadId,
  formatter,
  refreshThreads,
}: {
  title: string;
  threads: ThreadSummary[];
  activeThreadId: string | null;
  formatter: Intl.DateTimeFormat;
  refreshThreads: () => Promise<void>;
}) {
  const router = useRouter();

  if (threads.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h2>
      <ul className="space-y-2">
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isPinned = Boolean(thread.pinned);
          return (
            <li
              key={thread.id}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-gray-100 ${
                isActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-transparent bg-white"
              }`}
            >
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/chat/${thread.id}`)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-gray-800">
                    {thread.title || "제목 없음"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatter.format(new Date(thread.updated_at))}
                  </div>
                </button>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await patchThread(thread.id, { pinned: !isPinned });
                        await refreshThreads();
                      } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert(message);
                      }
                    }}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      isPinned
                        ? "border-blue-400 bg-blue-100 text-blue-700"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {isPinned ? "고정 해제" : "고정"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("이 스레드를 삭제할까요?")) return;
                      try {
                        await patchThread(thread.id, { deleted: true });
                        if (thread.id === activeThreadId) {
                          router.push("/chat");
                        }
                        await refreshThreads();
                      } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert(message);
                      }
                    }}
                    className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
