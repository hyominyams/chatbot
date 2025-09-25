export type ThreadSummary = {
  id: string;
  title: string;
  pinned?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (data as any)?.error === "string" ? (data as any).error : "요청이 실패했습니다.";
    throw new Error(message);
  }
  return data as T;
}

export async function listThreads(
  klass: string,
  nickname: string,
  options: { limit?: number; query?: string } = {}
) {
  const params = new URLSearchParams({
    klass,
    nickname,
    limit: String(options.limit ?? 30),
  });
  if (options.query) params.set("q", options.query);
  const res = await fetch(`/api/threads?${params.toString()}`, { cache: "no-store" });
  return handleResponse<{ threads: ThreadSummary[] }>(res);
}

export async function createThread(sessionId: string, title?: string) {
  const res = await fetch(`/api/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, title }),
  });
  return handleResponse<{ threadId: string }>(res);
}

export async function patchThread(
  threadId: string,
  updates: Partial<{ title: string; pinned: boolean; deleted: boolean }>
) {
  const res = await fetch(`/api/threads/${threadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse<{ ok: true }>(res);
}

export async function getMessages(threadId: string, limit = 50) {
  const params = new URLSearchParams({ threadId, limit: String(limit) });
  const res = await fetch(`/api/messages?${params.toString()}`, { cache: "no-store" });
  return handleResponse<{ messages: ChatMessage[] }>(res);
}

export async function sendUserMessage(sessionId: string, threadId: string, content: string) {
  const chatRes = await fetch(`/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, threadId, message: content }),
  });
  return handleResponse<{ content: string }>(chatRes);
}

export async function getContext(threadId: string, limit = 32) {
  const params = new URLSearchParams({ threadId, n: String(limit) });
  const res = await fetch(`/api/context?${params.toString()}`, { cache: "no-store" });
  return handleResponse<{ summary: string; recent: ChatMessage[] }>(res);
}

export async function summarizeThread(threadId: string) {
  const res = await fetch(`/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId }),
  });
  return handleResponse<{ ok: boolean }>(res);
}
