import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_LIMIT = 30;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const klass = searchParams.get("klass")?.trim();
  const nickname = searchParams.get("nickname")?.trim();
  const limitParam = searchParams.get("limit");
  const query = searchParams.get("q")?.trim();

  if (!klass || !nickname) {
    return NextResponse.json({ error: "klass/nickname 필요" }, { status: 400 });
  }

  const limit = Number(limitParam ?? DEFAULT_LIMIT);
  const size = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : DEFAULT_LIMIT;

  let builder = supabaseAdmin
    .from("threads")
    .select("id, title, pinned, created_at, updated_at")
    .eq("class", klass)
    .eq("nickname", nickname)
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(size);

  if (query && query.length > 0) {
    builder = builder.ilike("title", `%${query}%`);
  }

  const { data, error } = await builder;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ threads: data ?? [] });
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
  const titleRaw =
    typeof (payload as { title?: unknown }).title === "string"
      ? (payload as { title?: string }).title?.trim()
      : undefined;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId 필요" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("class, nickname")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "세션이 존재하지 않습니다." }, { status: 401 });
  }

  const title = titleRaw && titleRaw.length > 0 ? titleRaw : "새 채팅";

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("threads")
    .insert({
      class: session.class,
      nickname: session.nickname,
      title,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "스레드 생성 실패" },
      { status: 400 }
    );
  }

  return NextResponse.json({ threadId: inserted.id });
}
