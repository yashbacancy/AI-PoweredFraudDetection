import { NextResponse } from "next/server";

import { deleteLocalCase, updateLocalCase } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { deleteSupabaseCase, updateSupabaseCase } from "@/lib/supabase/repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const payload = {
    transaction_id: body.transaction_id || null,
    title: body.title,
    reason: body.reason,
    status: body.status,
    severity: body.severity,
    assigned_to: body.assigned_to || null,
    resolution_notes: body.resolution_notes || null,
  };
  const data = IS_LOCAL_DB_MODE
    ? await updateLocalCase(id, payload)
    : await updateSupabaseCase(id, payload);

  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (IS_LOCAL_DB_MODE) {
    await deleteLocalCase(id);
  } else {
    await deleteSupabaseCase(id);
  }
  return NextResponse.json({ ok: true });
}
