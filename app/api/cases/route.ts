import { NextResponse } from "next/server";

import { createLocalCase, getLocalCases } from "@/lib/local/repository";

export async function GET() {
  const data = await getLocalCases();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const data = await createLocalCase({
    transaction_id: body.transaction_id || null,
    title: body.title,
    reason: body.reason,
    status: body.status,
    severity: body.severity,
    assigned_to: body.assigned_to || null,
    resolution_notes: body.resolution_notes || null,
  });

  return NextResponse.json(data);
}
