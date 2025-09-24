import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const limit = Number(req.nextUrl.searchParams.get("limit") || "50");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId 필요" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { sessionId, role, content } = await req.json();
  if (!sessionId || !role || !content) {
    return NextResponse.json({ error: "sessionId/role/content 필요" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    session_id: sessionId,
    role,
    content,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
