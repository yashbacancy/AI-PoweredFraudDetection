import { NextResponse } from "next/server";

import { deleteLocalAlert, updateLocalAlert } from "@/lib/local/management-repository";
import { deleteSupabaseAlert, updateSupabaseAlert } from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const payload = {
    title: body.title ?? undefined,
    message: body.message ?? undefined,
    channel: body.channel ?? undefined,
    severity: body.severity ?? undefined,
    status: body.status ?? undefined,
    transaction_id: body.transaction_id ?? undefined,
    case_id: body.case_id ?? undefined,
  };

  const updated = IS_LOCAL_DB_MODE
    ? await updateLocalAlert(id, payload)
    : await updateSupabaseAlert(id, payload);

  if (!updated) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (IS_LOCAL_DB_MODE) {
    await deleteLocalAlert(id);
  } else {
    await deleteSupabaseAlert(id);
  }
  return NextResponse.json({ ok: true });
}
