import { NextResponse } from "next/server";

import {
  createLocalWatchlistEntry,
  getLocalWatchlist,
} from "@/lib/local/management-repository";
import {
  createSupabaseWatchlistEntry,
  getSupabaseWatchlist,
} from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function GET() {
  const entries = IS_LOCAL_DB_MODE
    ? await getLocalWatchlist(200)
    : await getSupabaseWatchlist(200);
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.entity_type || !body?.entity_value || !body?.list_type) {
    return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
  }

  const payload = {
    entity_type: body.entity_type,
    entity_value: body.entity_value,
    list_type: body.list_type as "whitelist" | "blacklist",
    reason: body.reason ?? null,
    is_active: body.is_active ?? true,
    expires_at: body.expires_at ?? null,
  };

  const entry = IS_LOCAL_DB_MODE
    ? await createLocalWatchlistEntry(payload)
    : await createSupabaseWatchlistEntry(payload);

  return NextResponse.json(entry, { status: 201 });
}
