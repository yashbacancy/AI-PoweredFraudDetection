import { NextResponse } from "next/server";

import { deleteLocalCase, updateLocalCase } from "@/lib/local/repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const data = await updateLocalCase(id, {
    transaction_id: body.transaction_id || null,
    title: body.title,
    reason: body.reason,
    status: body.status,
    severity: body.severity,
    assigned_to: body.assigned_to || null,
    resolution_notes: body.resolution_notes || null,
  });

  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await deleteLocalCase(id);
  return NextResponse.json({ ok: true });
}
