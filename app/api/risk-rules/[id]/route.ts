import { NextResponse } from "next/server";

import { deleteLocalRiskRule, updateLocalRiskRule } from "@/lib/local/management-repository";
import { deleteSupabaseRiskRule, updateSupabaseRiskRule } from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const weight =
    body.weight === undefined || body.weight === null || body.weight === "" ? undefined : Number(body.weight);
  if (weight !== undefined && (!Number.isFinite(weight) || weight < 1 || weight > 100)) {
    return NextResponse.json({ message: "Weight must be between 1 and 100." }, { status: 400 });
  }

  const threshold =
    body.threshold === undefined || body.threshold === ""
      ? undefined
      : body.threshold === null
        ? null
        : Number(body.threshold);
  if (threshold !== undefined && threshold !== null && !Number.isFinite(threshold)) {
    return NextResponse.json({ message: "Threshold must be numeric." }, { status: 400 });
  }

  const payload = {
    name: body.name ?? undefined,
    description: body.description ?? null,
    rule_type: body.rule_type ?? undefined,
    operator: body.operator ?? undefined,
    threshold,
    weight: weight === undefined ? undefined : Math.round(weight),
    is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
  };

  const updated = IS_LOCAL_DB_MODE
    ? await updateLocalRiskRule(id, payload)
    : await updateSupabaseRiskRule(id, payload);

  if (!updated) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (IS_LOCAL_DB_MODE) {
    await deleteLocalRiskRule(id);
  } else {
    await deleteSupabaseRiskRule(id);
  }
  return NextResponse.json({ ok: true });
}
