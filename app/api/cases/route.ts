import { NextResponse } from "next/server";

import { createLocalCase, getLocalCases } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { createSupabaseCase, getSupabaseCases } from "@/lib/supabase/repository";

export async function GET() {
  const data = IS_LOCAL_DB_MODE
    ? await getLocalCases()
    : await getSupabaseCases();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
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
    ? await createLocalCase(payload)
    : await createSupabaseCase(payload);

  return NextResponse.json(data);
}
