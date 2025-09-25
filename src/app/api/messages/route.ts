import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_LIMIT = 50;
const MESSAGE_ROLES = new Set(["user", "assistant"]);

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const threadId = searchParams.get("threadId")?.trim();
  const limitParam = searchParams.get("limit");

  if (!threadId) {
    return NextResponse.json({ error: "threadId 필요" }, { status: 400 });
  }

  const limit = Number(limitParam ?? DEFAULT_LIMIT);
  const size = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : DEFAULT_LIMIT;

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .order("id", { ascending: true })
    .limit(size);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 형식입니다." }, { status: 400 });
  }

  const sessionId =
    typeof (payload as { sessionId?: unknown }).sessionId === "string"
      ? (payload as { sessionId?: string }).sessionId?.trim()
      : "";
  const threadId =
    typeof (payload as { threadId?: unknown }).threadId === "string"
      ? (payload as { threadId?: string }).threadId?.trim()
      : "";
  const role =
    typeof (payload as { role?: unknown }).role === "string"
      ? (payload as { role?: string }).role?.trim().toLowerCase()
      : "";
  const content =
    typeof (payload as { content?: unknown }).content === "string"
      ? (payload as { content?: string }).content?.trim()
      : "";

  if (!sessionId || !threadId || !role || !content) {
    return NextResponse.json(
      { error: "sessionId/threadId/role/content 필요" },
      { status: 400 }
    );
  }

  if (!MESSAGE_ROLES.has(role)) {
    return NextResponse.json({ error: "role 값이 올바르지 않습니다." }, { status: 400 });
  }

  const [{ data: session, error: sessionError }, { data: thread, error: threadError }] =
    await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("class, nickname")
        .eq("id", sessionId)
        .maybeSingle(),
      supabaseAdmin
        .from("threads")
        .select("class, nickname")
        .eq("id", threadId)
        .maybeSingle(),
    ]);

  if (sessionError || !session) {
    return NextResponse.json({ error: "세션이 존재하지 않습니다." }, { status: 401 });
  }

  if (threadError || !thread) {
    return NextResponse.json({ error: "스레드를 찾을 수 없습니다." }, { status: 400 });
  }

  if (thread.class !== session.class || thread.nickname !== session.nickname) {
    return NextResponse.json({ error: "스레드 접근 권한이 없습니다." }, { status: 401 });
  }

  const { error: insertError } = await supabaseAdmin.from("messages").insert({
    session_id: sessionId,
    thread_id: threadId,
    role,
    content,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

