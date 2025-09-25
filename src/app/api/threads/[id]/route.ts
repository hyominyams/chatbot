import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const threadId = params.id;
  if (!threadId) {
    return NextResponse.json({ error: "threadId 필요" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 형식입니다." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  const titleValue =
    typeof (payload as { title?: unknown }).title === "string"
      ? ((payload as { title?: string }).title ?? "").trim()
      : undefined;
  if (titleValue && titleValue.length > 0) {
    updates.title = titleValue;
  }

  if (typeof (payload as { pinned?: unknown }).pinned === "boolean") {
    updates.pinned = (payload as { pinned?: boolean }).pinned;
  }

  if ((payload as { deleted?: unknown }).deleted === true) {
    updates.deleted_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "업데이트할 필드가 없습니다." }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("threads")
    .update(updates)
    .eq("id", threadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

