import { NextResponse } from "next/server";

import {
  deleteLocalWatchlistEntry,
  updateLocalWatchlistEntry,
} from "@/lib/local/management-repository";
import {
  deleteSupabaseWatchlistEntry,
  updateSupabaseWatchlistEntry,
} from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const updated = IS_LOCAL_DB_MODE
    ? await updateLocalWatchlistEntry(id, {
        entity_type: body.entity_type ?? undefined,
        entity_value: body.entity_value ?? undefined,
        list_type: body.list_type ?? undefined,
        reason: body.reason ?? null,
        is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
        expires_at: body.expires_at ?? null,
      })
    : await updateSupabaseWatchlistEntry(id, {
        entity_type: body.entity_type ?? undefined,
        entity_value: body.entity_value ?? undefined,
        list_type: body.list_type ?? undefined,
        reason: body.reason ?? null,
        is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
        expires_at: body.expires_at ?? null,
      });

  if (!updated) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (IS_LOCAL_DB_MODE) {
    await deleteLocalWatchlistEntry(id);
  } else {
    await deleteSupabaseWatchlistEntry(id);
  }
  return NextResponse.json({ ok: true });
}
