import { NextResponse } from "next/server";

import { deleteLocalTransaction, updateLocalTransaction } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { deleteSupabaseTransaction, updateSupabaseTransaction } from "@/lib/supabase/repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const amount = body.amount === undefined ? undefined : Number(body.amount);

  const payload = {
    merchant_name: body.merchant_name,
    amount: Number.isFinite(amount) ? amount : undefined,
    payment_method: body.payment_method,
    ip_address: body.ip_address,
    country: body.country,
    device_id: body.device_id,
    merchant_category: body.merchant_category ?? undefined,
    currency: body.currency ?? undefined,
    channel: body.channel ?? undefined,
    behavioral_biometrics: body.behavioral_biometrics ?? undefined,
  };
  const data = IS_LOCAL_DB_MODE
    ? await updateLocalTransaction(id, payload)
    : await updateSupabaseTransaction(id, payload);

  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (IS_LOCAL_DB_MODE) {
    await deleteLocalTransaction(id);
  } else {
    await deleteSupabaseTransaction(id);
  }
  return NextResponse.json({ ok: true });
}
