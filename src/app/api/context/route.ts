import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const n = Number(req.nextUrl.searchParams.get("n") || "12");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId 필요" }, { status: 400 });
  }

  const [{ data: sum }, { data: msgs, error: msgErr }] = await Promise.all([
    supabaseAdmin
      .from("summaries")
      .select("summary,last_msg_id")
      .eq("session_id", sessionId)
      .maybeSingle(),
    supabaseAdmin
      .from("messages")
      .select("id,role,content,created_at")
      .eq("session_id", sessionId)
      .order("id", { ascending: false })
      .limit(n),
  ]);

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  return NextResponse.json({
    summary: sum?.summary || "",
    recent: (msgs || []).reverse(),
  });
}
