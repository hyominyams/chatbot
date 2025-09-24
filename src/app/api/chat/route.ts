import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { llm } from "@/lib/llm";

type ChatMessage = {
  role: string;
  content: string;
};

const MODEL = process.env.UPSTAGE_MODEL ?? "solar-pro2";
const CONTEXT_N = Number(process.env.CHAT_CONTEXT_LIMIT ?? 12);

const SYSTEM_PROMPT = [
  "# SYSTEM PROMPT — Google Apps Script 시니어 개발 보조",
  "",
  "## 역할",
  "",
  "너는 **초등학생 개발자**들을 돕는 **시니어 개발자**다.",
  "학생 아이디어를 **실현 가능한 수준으로 구체화**하고, **Google Apps Script 코드**를 작성한다.",
  "",
  "## 지침",
  "",
  "* 난이도: **쉬운 CRUD 앱**부터 **AI 활용 앱**까지 가능해야 함.",
  "  (예: 설문 분석 → 운동/식단 추천, 사진 OCR → 수학 풀이, 시트 기반 골든벨 게임)",
  "* 아이디어가 너무 복잡하면 **조금 단순화**해서 구현 가능한 형태로 바꿔 제시.",
  "* 앱 구조는 항상 **3파일**로 제공:",
  "",
  "  1. 'setup.gs' → 스프레드시트 및 기본 데이터 자동 생성",
  "  2. 'code.gs' → 메인 기능 (시트 연동, API 호출, 로직)",
  "  3. 'index.html' → UI (간단·직관적·모바일 우선)",
  "",
  "## 출력 규칙",
  "",
  "* 반드시 위 3파일을 **각각 코드블록**으로 작성.",
  "* 코드에는 **간단한 주석** 포함.",
  "* 코드 아래에는 **실행/배포 순서 3~5단계**를 짧게 안내.",
].join("\n");
export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 형식입니다." }, { status: 400 });
  }

  const sessionId =
    typeof (body as { sessionId?: unknown }).sessionId === "string"
      ? ((body as { sessionId?: string }).sessionId ?? "").trim()
      : "";
  const message =
    typeof (body as { message?: unknown }).message === "string"
      ? ((body as { message?: string }).message ?? "").trim()
      : "";

  if (!sessionId || !message) {
    return NextResponse.json(
      { error: "sessionId/message 필요" },
      { status: 400 }
    );
  }

  const [{ data: summaryRow }, { data: recentMessages, error: recentError }] =
    await Promise.all([
      supabaseAdmin
        .from("summaries")
        .select("summary")
        .eq("session_id", sessionId)
        .maybeSingle(),
      supabaseAdmin
        .from("messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("id", { ascending: false })
        .limit(CONTEXT_N),
    ]);

  if (recentError) {
    return NextResponse.json({ error: recentError.message }, { status: 500 });
  }

  const recent = (recentMessages ?? []).reverse();

  const summaryText = summaryRow?.summary
    ? `\n[요약]\n${summaryRow.summary}\n`
    : "";

  const historyText = recent
    .map((m: ChatMessage) =>
      `${m.role === "assistant" ? "도우미" : m.role === "system" ? "시스템" : "학생"}: ${m.content}`
    )
    .join("\n");

  const prompt = [
    {
      role: "system" as const,
      content: SYSTEM_PROMPT + summaryText,
    },
    {
      role: "user" as const,
      content: historyText
        ? `최근 대화\n${historyText}\n\n새 질문: ${message}`
        : `새 질문: ${message}`,
    },
  ];

  try {
    const completion = await llm.chat.completions.create({
      model: MODEL,
      messages: prompt,
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content ?? "(응답 없음)";

    await supabaseAdmin.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content,
    });

    const summarizeUrl = new URL("/api/summarize", req.url);
    void fetch(summarizeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});

    return NextResponse.json({ content });
  } catch (error: unknown) {
    console.error("[api/chat] Upstage request failed:", error);
    const messageText =
      error instanceof Error && error.message
        ? error.message
        : "예상치 못한 오류가 발생했습니다.";

    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}





