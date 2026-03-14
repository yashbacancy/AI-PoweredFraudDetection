import { NextResponse } from "next/server";

import {
  createLocalAlert,
  getLocalAlerts,
  getLocalApiIntegrations,
} from "@/lib/local/management-repository";
import {
  createSupabaseAlert,
  getSupabaseAlerts,
  getSupabaseApiIntegrations,
} from "@/lib/supabase/management-repository";
import { dispatchAlert } from "@/lib/notifications/dispatch";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function GET() {
  const alerts = IS_LOCAL_DB_MODE
    ? await getLocalAlerts(200)
    : await getSupabaseAlerts(200);
  return NextResponse.json(alerts);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.title || !body?.message || !body?.channel || !body?.severity || !body?.status) {
    return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
  }

  const payload = {
    title: body.title,
    message: body.message,
    channel: body.channel,
    severity: body.severity,
    status: body.status,
    transaction_id: body.transaction_id ?? null,
    case_id: body.case_id ?? null,
  };

  const alert = IS_LOCAL_DB_MODE
    ? await createLocalAlert(payload)
    : await createSupabaseAlert(payload);

  if (alert) {
    const integrations = IS_LOCAL_DB_MODE
      ? await getLocalApiIntegrations(50)
      : await getSupabaseApiIntegrations(50);
    dispatchAlert(alert, integrations).catch(() => {});
  }

  return NextResponse.json(alert, { status: 201 });
}
