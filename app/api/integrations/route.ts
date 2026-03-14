import { NextResponse } from "next/server";

import { createLocalApiIntegration, getLocalApiIntegrations } from "@/lib/local/management-repository";
import { createSupabaseApiIntegration, getSupabaseApiIntegrations } from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function GET() {
  const integrations = IS_LOCAL_DB_MODE
    ? await getLocalApiIntegrations(200)
    : await getSupabaseApiIntegrations(200);
  return NextResponse.json(integrations);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.name || !body?.integration_type || !body?.status) {
    return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
  }

  const payload = {
    name: body.name,
    integration_type: body.integration_type,
    endpoint: body.endpoint ?? null,
    status: body.status,
    secret_ref: body.secret_ref ?? null,
    last_error: body.last_error ?? null,
  };

  const integration = IS_LOCAL_DB_MODE
    ? await createLocalApiIntegration(payload)
    : await createSupabaseApiIntegration(payload);

  return NextResponse.json(integration, { status: 201 });
}
