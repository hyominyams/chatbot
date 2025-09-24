import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { llm } from "@/lib/llm";

const THRESHOLD = 30;
const KEEP_RECENT = 12;

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId 필요" }, { status: 400 });
  }

  const { data: sum } = await supabaseAdmin
    .from("summaries")
    .select("last_msg_id, summary")
    .eq("session_id", sessionId)
    .maybeSingle();

  const { count, error: cntErr } = await supabaseAdmin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if (cntErr) {
    return NextResponse.json({ error: cntErr.message }, { status: 500 });
  }

  if (!count || count < THRESHOLD) {
    return NextResponse.json({ skipped: true, reason: `count(${count}) < ${THRESHOLD}` });
  }

  const { data: recent } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("session_id", sessionId)
    .order("id", { ascending: false })
    .limit(KEEP_RECENT);

  const minRecentId = recent && recent.length
    ? Math.min(...recent.map((r) => Number(r.id)))
    : Number.MAX_SAFE_INTEGER;

  const { data: old, error: oldErr } = await supabaseAdmin
    .from("messages")
    .select("id, role, content")
    .eq("session_id", sessionId)
    .lt("id", minRecentId)
    .order("id", { ascending: true });

  if (oldErr) {
    return NextResponse.json({ error: oldErr.message }, { status: 500 });
  }
  if (!old || old.length === 0) {
    return NextResponse.json({ skipped: true, reason: "요약할 오래된 메시지 없음" });
  }

  const text = old
    .map((m) => `${m.role === "user" ? "학생" : "도우미"}: ${m.content}`)
    .join("\n");
  const prompt = [
    {
      role: "system" as const,
      content:
        "당신은 사용자의 대화 기록 요약기다. 대화 내용에 근거해서 사실/주요 핵심만 5~8줄 bullet로 요약하세요. 존댓말 불필요.",
    },
    { role: "user" as const, content: `다음 대화 로그를 요약해줘:\n\n${text}` },
  ];

  const comp = await llm.chat.completions.create({
    model: "solar-pro2",
    messages: prompt,
    temperature: 0.2,
  });
  const summary = comp.choices[0].message.content ?? "(요약 없음)";

  const lastId = Number(old[old.length - 1].id);
  const { error: upErr } = await supabaseAdmin.from("summaries").upsert({
    session_id: sessionId,
    summary,
    last_msg_id: lastId,
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { error: delErr } = await supabaseAdmin
    .from("messages")
    .delete()
    .eq("session_id", sessionId)
    .lte("id", lastId);
  if (delErr) {
    return NextResponse.json({ summary, last_msg_id: lastId, warn: delErr.message });
  }

  return NextResponse.json({ summary, last_msg_id: lastId, pruned: true });
}
