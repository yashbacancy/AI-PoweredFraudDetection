import { NextResponse } from "next/server";

import { createLocalRiskRule, getLocalRiskRules } from "@/lib/local/management-repository";
import { createSupabaseRiskRule, getSupabaseRiskRules } from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export async function GET() {
  const rules = IS_LOCAL_DB_MODE
    ? await getLocalRiskRules(200)
    : await getSupabaseRiskRules(200);
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.name || !body?.rule_type || !body?.operator) {
    return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
  }

  const weight = Number(body.weight);
  if (!Number.isFinite(weight) || weight < 1 || weight > 100) {
    return NextResponse.json({ message: "Weight must be between 1 and 100." }, { status: 400 });
  }

  const threshold =
    body.threshold === null || body.threshold === "" || body.threshold === undefined
      ? null
      : Number(body.threshold);
  if (threshold !== null && !Number.isFinite(threshold)) {
    return NextResponse.json({ message: "Threshold must be numeric." }, { status: 400 });
  }

  const payload = {
    name: body.name,
    description: body.description ?? null,
    rule_type: body.rule_type,
    operator: body.operator,
    threshold,
    weight: Math.round(weight),
    is_active: body.is_active ?? true,
  };

  const rule = IS_LOCAL_DB_MODE
    ? await createLocalRiskRule(payload)
    : await createSupabaseRiskRule(payload);

  return NextResponse.json(rule, { status: 201 });
}
