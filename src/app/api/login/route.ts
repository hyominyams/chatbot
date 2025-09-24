import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const { klass, password, nickname } = await req.json();
  if (!klass || !password || !nickname) {
    return NextResponse.json(
      { error: "반/암호/닉네임을 모두 입력하세요." },
      { status: 400 }
    );
  }

  const { data: cfg, error: cfgErr } = await supabaseAdmin
    .from("config")
    .select("value")
    .eq("key", "CLASS_PASSWORDS")
    .maybeSingle();
  if (cfgErr || !cfg?.value) {
    return NextResponse.json(
      { error: "CLASS_PASSWORDS 설정이 없습니다." },
      { status: 500 }
    );
  }

  let map: Record<string, string> = {};
  try {
    map = JSON.parse(cfg.value);
  } catch {
    // ignore parse error, map stays empty
  }

  if (map[klass] !== password) {
    return NextResponse.json(
      { error: "반/암호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const sessionId = randomUUID();
  const { error: insErr } = await supabaseAdmin.from("sessions").insert({
    id: sessionId,
    class: klass,
    nickname,
  });
  if (insErr) {
    return NextResponse.json({ error: "세션 생성 실패" }, { status: 500 });
  }

  return NextResponse.json({ sessionId });
}
