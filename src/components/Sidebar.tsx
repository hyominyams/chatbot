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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeThreadId = useMemo(() => {
    const parts = pathname?.split("/") ?? [];
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as {
        sessionId?: string;
        klass?: string;
        nick?: string;
        authed?: boolean;
      };
      if (!stored?.authed || !stored.sessionId) return;
      setSessionId(stored.sessionId ?? null);
      setKlass(stored.klass ?? null);
      setNick(stored.nick ?? null);
    } catch (err) {
      console.error(err);
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
      setThreads(items.filter((item) => !item.deleted_at));
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
      alert("먼저 로그인해 주세요.");
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
    const pinned = threads.filter((thread) => thread.pinned);
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
    <aside className="flex h-full w-72 flex-col gap-5 border-r border-slate-200 bg-gray-50 p-6">
      <header className="space-y-1">
        <div className="text-lg font-semibold text-slate-900">ClassCoder</div>
        <div className="text-xs text-slate-500">
          {klass ? `${klass} · ${nick ?? ""}` : "로그인 필요"}
        </div>
      </header>

      <div className="space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="스레드 검색"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="button"
          onClick={handleNewThread}
          className="w-full rounded-lg bg-blue-400 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          새 채팅
        </button>
        <button
          type="button"
          onClick={() => refreshThreads()}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-gray-100"
        >
          새로고침
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {loading && <p className="text-xs text-slate-500">불러오는 중...</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!loading && !error && threads.length === 0 && (
          <p className="text-xs text-slate-500">스레드가 없습니다.</p>
        )}

        <ThreadSection
          title="고정됨"
          threads={grouped.pinned}
          activeId={activeThreadId}
          formatter={formatter}
          refresh={refreshThreads}
        />
        <ThreadSection
          title="전체"
          threads={grouped.regular}
          activeId={activeThreadId}
          formatter={formatter}
          refresh={refreshThreads}
        />
      </div>
    </aside>
  );
}

function ThreadSection({
  title,
  threads,
  activeId,
  formatter,
  refresh,
}: {
  title: string;
  threads: ThreadSummary[];
  activeId: string | null;
  formatter: Intl.DateTimeFormat;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();

  if (threads.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      <ul className="space-y-2">
        {threads.map((thread) => {
          const isActive = thread.id === activeId;
          return (
            <li
              key={thread.id}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-gray-100 ${
                isActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-transparent bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => router.push(`/chat/${thread.id}`)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-slate-900">
                    {thread.title?.trim() || "제목 없음"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatter.format(new Date(thread.updated_at))}
                  </div>
                </button>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await patchThread(thread.id, { pinned: !thread.pinned });
                        await refresh();
                      } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert(message);
                      }
                    }}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      thread.pinned
                        ? "border-blue-400 bg-blue-100 text-blue-700"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-gray-100"
                    }`}
                  >
                    {thread.pinned ? "고정 해제" : "고정"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("이 스레드를 삭제할까요?")) return;
                      try {
                        await patchThread(thread.id, { deleted: true });
                        if (thread.id === activeId) router.push("/chat");
                        await refresh();
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
