import { NextResponse } from "next/server";

import { deleteLocalApiIntegration, updateLocalApiIntegration } from "@/lib/local/management-repository";
import { deleteSupabaseApiIntegration, updateSupabaseApiIntegration } from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const payload = {
    name: body.name ?? undefined,
    integration_type: body.integration_type ?? undefined,
    endpoint: body.endpoint ?? null,
    status: body.status ?? undefined,
    secret_ref: body.secret_ref ?? null,
    last_error: body.last_error ?? null,
  };

  const updated = IS_LOCAL_DB_MODE
    ? await updateLocalApiIntegration(id, payload)
    : await updateSupabaseApiIntegration(id, payload);

  if (!updated) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (IS_LOCAL_DB_MODE) {
    await deleteLocalApiIntegration(id);
  } else {
    await deleteSupabaseApiIntegration(id);
  }
  return NextResponse.json({ ok: true });
}
