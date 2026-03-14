import { NextResponse } from "next/server";

import { deleteLocalTransaction, updateLocalTransaction } from "@/lib/local/repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const amount = body.amount === undefined ? undefined : Number(body.amount);

  const data = await updateLocalTransaction(id, {
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
  });

  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await deleteLocalTransaction(id);
  return NextResponse.json({ ok: true });
}
