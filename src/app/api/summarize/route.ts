import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { llm } from "@/lib/llm";

const KEEP_RECENT = 12;

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 형식입니다." }, { status: 400 });
  }

  const threadId =
    typeof (payload as { threadId?: unknown }).threadId === "string"
      ? ((payload as { threadId?: string }).threadId ?? "").trim()
      : "";

  if (!threadId) {
    return NextResponse.json({ error: "threadId 필요" }, { status: 400 });
  }

  const { data: recent } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("thread_id", threadId)
    .order("id", { ascending: false })
    .limit(KEEP_RECENT);

  const minRecentId = recent && recent.length
    ? Math.min(...recent.map((r) => Number(r.id)))
    : Number.MAX_SAFE_INTEGER;

  const { data: old, error: oldErr } = await supabaseAdmin
    .from("messages")
    .select("id, role, content")
    .eq("thread_id", threadId)
    .lt("id", minRecentId)
    .order("id", { ascending: true });

  if (oldErr) {
    return NextResponse.json({ error: oldErr.message }, { status: 400 });
  }

  if (!old || old.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "요약할 메시지가 충분하지 않습니다." });
  }

  const text = old
    .map((m) => `${m.role === "user" ? "학생" : "도우미"}: ${m.content}`)
    .join("\n");

  const prompt = [
    {
      role: "system" as const,
      content:
        "너는 교사용 수업 기록 요약기다. 의사결정/규칙/사실만 5~8줄 bullet로 요약하라. 존댓말 불필요.",
    },
    { role: "user" as const, content: `다음 대화 로그를 요약해줘:\n\n${text}` },
  ];

  const completion = await llm.chat.completions.create({
    model: "solar-pro2",
    messages: prompt,
    temperature: 0.5,
    max_tokens: 16384,
  });

  const summary = completion.choices[0]?.message?.content ?? "(요약 없음)";
  const lastId = Number(old[old.length - 1].id);

  const { error: upsertError } = await supabaseAdmin
    .from("thread_summaries")
    .upsert({
      thread_id: threadId,
      summary,
      last_msg_id: lastId,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
