import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_LIMIT = 32;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const threadId = searchParams.get("threadId")?.trim();
  const limitParam = searchParams.get("n")?.trim();

  if (!threadId) {
    return NextResponse.json({ error: "threadId 필요" }, { status: 400 });
  }

  const limit = Number(limitParam ?? DEFAULT_LIMIT);
  const size = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : DEFAULT_LIMIT;

  const [{ data: summaryRow }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabaseAdmin
        .from("thread_summaries")
        .select("summary")
        .eq("thread_id", threadId)
        .maybeSingle(),
      supabaseAdmin
        .from("messages")
        .select("id, role, content, created_at")
        .eq("thread_id", threadId)
        .order("id", { ascending: false })
        .limit(size),
    ]);

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 400 });
  }

  return NextResponse.json({
    summary: summaryRow?.summary ?? "",
    recent: (messages ?? []).reverse(),
  });
}

