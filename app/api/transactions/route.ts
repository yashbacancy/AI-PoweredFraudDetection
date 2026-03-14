import { NextResponse } from "next/server";

import { createLocalTransaction, getLocalTransactions } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { createSupabaseTransaction, getSupabaseTransactions } from "@/lib/supabase/repository";

export async function GET() {
  const data = IS_LOCAL_DB_MODE
    ? await getLocalTransactions()
    : await getSupabaseTransactions();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.merchant_name || !body?.payment_method || !body?.device_id || !body?.country) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "Invalid amount" }, { status: 400 });
  }

  const payload = {
    merchant_name: body.merchant_name,
    amount,
    payment_method: body.payment_method,
    ip_address: body.ip_address,
    country: body.country,
    device_id: body.device_id,
    merchant_category: body.merchant_category ?? null,
    currency: body.currency ?? "USD",
    channel: body.channel ?? "web",
    behavioral_biometrics: body.behavioral_biometrics ?? null,
  };

  const data = IS_LOCAL_DB_MODE
    ? await createLocalTransaction(payload)
    : await createSupabaseTransaction(payload);

  return NextResponse.json(data);
}
