import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { llm } from "@/lib/llm";

type ChatRecord = {
  role: string;
  content: string;
};

const MODEL = process.env.UPSTAGE_MODEL ?? "solar-pro2";
const CONTEXT_N = Number(process.env.CHAT_CONTEXT_LIMIT ?? 32);

const SYSTEM_PROMPT = [
  "# SYSTEM PROMPT — ClassCoder Teacher Assistant",
  "",
  "## 역할",
  "너는 초등학생 앱 아이디어를 충분히 경청하고 구조화한 뒤, 파일별로 단계적 코드를 제공하는 교사 보조 챗봇이다. 절대로 단계를 건너뛰지 마라.",
  "",
  "## 단계 규칙",
  "### STEP 1. 학생과 대화 (최소 5턴)",
  "- 템플릿이 완전히 채워지기 전에는 \"다음으로 넘어갈까요?\"를 말하지 않는다.",
  "- 최소 5턴 이상 질의응답을 진행한 뒤, 템플릿 모든 항목이 채워졌을 때만 STEP 2로 넘어간다.",
  "- 아래 템플릿 항목이 모두 채워질 때까지 질문을 반복한다.",
  "- 템플릿: [앱 제목, 앱 목적, 앱의 기능 요약(3개 이상), 앱 디자인(상단 메뉴/버튼), 입력/출력, 데이터 저장(시트/컬럼/예시행), 제약사항]",
  "- 하나라도 비어 있으면 코드를 출력하지 말고 부족한 항목을 구체적으로 되물어 보완한다.",
  "- 이 템플릿 스냅샷을 요약 컨텍스트에 항상 저장해 유지한다.",
  "",
  "### STEP 2. 코드 작성 (파일별 분리)",
  "- 순서: setup.gs → code.gs → index.html",
  "- 각 파일은 별도 섹션과 아래 형식의 코드블록으로 제공한다:",
  "```ts filename: setup.gs",
  "```",
  "```ts filename: code.gs",
  "```",
  "```html filename: index.html",
  "```",
  "- 각 섹션에는 붙여넣기 위치와 테스트 방법을 간단히 안내한다.",
  "- 주석은 초등학생이 이해할 수 있도록 쉬운 문장으로 작성한다.",
  "",
  "### STEP 3. 피드백/수정",
  "- 학생이 요청한 수정 사항을 먼저 요약한다.",
  "- 수정 시 code.gs에 변경이 있다면 파일 전체를 다시 제공한다(붙여넣어 교체 가능하도록).",
  "- setup.gs와 index.html은 변경된 블록만 제공해도 되지만, 학생이 원하면 전체를 제공한다.",
  "",
  "## 출력 규칙",
  "- STEP 1에서는 절대 코드를 출력하지 않는다.",
  "- STEP 2와 STEP 3에서도 위의 코드블록 포맷을 반드시 지킨다.",
  "- 각 단계가 끝날 때마다 ‘다음으로 넘어갈까요?’라고 묻는다.",
].join("\n");

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 형식입니다." }, { status: 400 });
  }

  const sessionId =
    typeof (payload as { sessionId?: unknown }).sessionId === "string"
      ? ((payload as { sessionId?: string }).sessionId ?? "").trim()
      : "";
  const threadId =
    typeof (payload as { threadId?: unknown }).threadId === "string"
      ? ((payload as { threadId?: string }).threadId ?? "").trim()
      : "";
  const message =
    typeof (payload as { message?: unknown }).message === "string"
      ? ((payload as { message?: string }).message ?? "").trim()
      : "";

  if (!sessionId || !threadId || !message) {
    return NextResponse.json(
      { error: "sessionId/threadId/message 필요" },
      { status: 400 }
    );
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

  const { error: userInsertError } = await supabaseAdmin.from("messages").insert({
    session_id: sessionId,
    thread_id: threadId,
    role: "user",
    content: message,
  });

  if (userInsertError) {
    return NextResponse.json({ error: userInsertError.message }, { status: 400 });
  }

  const [{ data: summaryRow }, { data: recentMessages, error: recentError }] =
    await Promise.all([
      supabaseAdmin
        .from("thread_summaries")
        .select("summary")
        .eq("thread_id", threadId)
        .maybeSingle(),
      supabaseAdmin
        .from("messages")
        .select("role, content")
        .eq("thread_id", threadId)
        .order("id", { ascending: false })
        .limit(CONTEXT_N),
    ]);

  if (recentError) {
    return NextResponse.json({ error: recentError.message }, { status: 400 });
  }

  const recent = (recentMessages ?? []).reverse();
  const summaryText = summaryRow?.summary ? `\n[요약]\n${summaryRow.summary}\n` : "";

  const historyText = recent
    .map((record: ChatRecord) =>
      `${record.role === "assistant" ? "어시스턴트" : record.role === "system" ? "시스템" : "학생"}: ${record.content}`
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
        ? `최근 대화\n${historyText}\n\n새 메시지: ${message}`
        : `새 메시지: ${message}`,
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
      thread_id: threadId,
      role: "assistant",
      content,
    });

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
