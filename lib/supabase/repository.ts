import { evaluateRiskSignals, type RiskEvaluation } from "@/lib/risk";
import type { FraudCase, Transaction } from "@/lib/types";
import { dispatchAlert } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";
import type { AlertRow, ApiIntegrationRow } from "@/lib/local/management-repository";

type AlertChannel = "in_app" | "email" | "webhook" | "slack";
type FeatureChannel = "web" | "mobile_app" | "api" | "pos" | "call_center";
type RuleType = "amount" | "velocity_1h" | "velocity_24h" | "geo" | "device" | "payment_method";
type RuleOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "in" | "not_in";

type TransactionWritePayload = {
  merchant_name: string;
  amount: number;
  payment_method: string;
  ip_address: string;
  country: string;
  device_id: string;
  merchant_category?: string | null;
  currency?: string | null;
  channel?: string | null;
  behavioral_biometrics?: BehavioralBiometricInput | null;
};

type TransactionUpdatePayload = Partial<TransactionWritePayload>;

type BehavioralBiometricInput = {
  typing_cadence_ms?: number;
  pointer_velocity?: number;
  touch_pressure?: number;
  scroll_speed?: number;
};

type DeviceRow = {
  id: string;
  risk_level: "low" | "medium" | "high";
  last_country: string | null;
};

type PaymentMethodRow = {
  id: string;
  status: "active" | "blocked" | "expired";
  country: string | null;
};

type VelocityStats = {
  velocity_1h: number;
  velocity_24h: number;
  historical_avg_amount: number;
};

type ModelRow = {
  version: string;
  review_threshold: number;
  block_threshold: number;
};

type ActiveRiskRule = {
  name: string;
  rule_type: RuleType;
  operator: RuleOperator;
  threshold: number | null;
  weight: number;
};

type StoredTransaction = {
  merchant_name: string;
  merchant_category: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  ip_address: string | null;
  country: string;
  device_id: string;
};

type RiskContext = {
  velocity: VelocityStats;
  device: DeviceRow;
  paymentMethod: PaymentMethodRow | null;
  accountTakeoverEvents: number;
  identityStatus: "pending" | "verified" | "failed" | "manual_review" | null;
  customerRiskScore: number;
  watchlistHit: boolean;
  allowlistHit: boolean;
  model: ModelRow;
  chargebackRatio: number;
  matchedRuleCodes: string[];
  matchedRuleNames: string[];
  ruleWeightBoost: number;
  behaviorAnomaly: number;
  channel: FeatureChannel;
  geoMismatch: boolean;
};

const TRANSACTION_SELECT =
  "id, created_at, updated_at, user_id, merchant_name, amount, status, risk_score, payment_method, ip_address, country, device_id";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeCountry(country: string | null | undefined) {
  return (country ?? "US").trim().toUpperCase().slice(0, 2) || "US";
}

function normalizeChannel(channel: string | null | undefined): FeatureChannel {
  const value = (channel ?? "").trim().toLowerCase();
  if (value === "mobile" || value === "mobile_app") return "mobile_app";
  if (value === "api") return "api";
  if (value === "pos") return "pos";
  if (value === "call_center") return "call_center";
  return "web";
}

function inferDeviceRisk(deviceId: string) {
  const normalized = deviceId.toLowerCase();
  if (normalized.includes("unknown") || normalized.includes("new")) return "high" as const;
  if (normalized.includes("server") || normalized.includes("remote")) return "medium" as const;
  return "low" as const;
}

function computeBehaviorAnomaly(input?: BehavioralBiometricInput | null) {
  if (!input) return 0;

  let score = 10;
  if (typeof input.typing_cadence_ms === "number") {
    if (input.typing_cadence_ms < 80 || input.typing_cadence_ms > 360) score += 30;
    else if (input.typing_cadence_ms < 120 || input.typing_cadence_ms > 280) score += 12;
  }

  if (typeof input.pointer_velocity === "number") {
    if (input.pointer_velocity > 850) score += 26;
    else if (input.pointer_velocity > 550) score += 14;
  }

  if (typeof input.touch_pressure === "number") {
    if (input.touch_pressure > 0.85) score += 16;
    else if (input.touch_pressure < 0.1) score += 10;
  }

  if (typeof input.scroll_speed === "number") {
    if (input.scroll_speed > 800) score += 18;
    else if (input.scroll_speed > 550) score += 10;
  }

  return clamp(Math.round(score), 0, 100);
}

function safeRuleCode(name: string) {
  return `rule_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function compareNumeric(value: number, operator: RuleOperator, threshold: number) {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    case "neq":
      return value !== threshold;
    case "in":
      return value === threshold;
    case "not_in":
      return value !== threshold;
    default:
      return false;
  }
}

function evaluateRules(
  rules: ActiveRiskRule[],
  params: {
    amount: number;
    velocity_1h: number;
    velocity_24h: number;
    country: string;
    device_id: string;
    device_risk_level: "low" | "medium" | "high";
    payment_method: string;
    payment_method_status: "active" | "blocked" | "expired" | null;
  },
) {
  const riskyCountries = new Set(["NG", "RU", "UA", "PH", "VN", "ID"]);
  const matchedRuleCodes: string[] = [];
  const matchedRuleNames: string[] = [];
  let ruleWeightBoost = 0;

  for (const rule of rules) {
    let isMatch = false;
    const threshold = Number.isFinite(rule.threshold ?? NaN) ? Number(rule.threshold) : null;

    if (rule.rule_type === "amount" && threshold !== null) {
      isMatch = compareNumeric(params.amount, rule.operator, threshold);
    } else if (rule.rule_type === "velocity_1h" && threshold !== null) {
      isMatch = compareNumeric(params.velocity_1h, rule.operator, threshold);
    } else if (rule.rule_type === "velocity_24h" && threshold !== null) {
      isMatch = compareNumeric(params.velocity_24h, rule.operator, threshold);
    } else if (rule.rule_type === "geo") {
      const risky = riskyCountries.has(params.country);
      isMatch = rule.operator === "not_in" || rule.operator === "neq" ? !risky : risky;
    } else if (rule.rule_type === "device") {
      const suspicious =
        params.device_risk_level === "high" ||
        params.device_id.toLowerCase().includes("new") ||
        params.device_id.toLowerCase().includes("unknown");
      isMatch = rule.operator === "not_in" || rule.operator === "neq" ? !suspicious : suspicious;
    } else if (rule.rule_type === "payment_method") {
      const riskyPayment =
        params.payment_method_status === "blocked" ||
        params.payment_method_status === "expired" ||
        params.payment_method.toLowerCase() === "crypto" ||
        params.payment_method.toLowerCase() === "virtual_card";
      isMatch = rule.operator === "not_in" || rule.operator === "neq" ? !riskyPayment : riskyPayment;
    }

    if (isMatch) {
      matchedRuleNames.push(rule.name);
      matchedRuleCodes.push(safeRuleCode(rule.name));
      ruleWeightBoost += Math.max(1, Math.round(rule.weight * 0.55));
    }
  }

  return {
    matchedRuleCodes,
    matchedRuleNames,
    ruleWeightBoost,
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  throwIfError(error);
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

async function getOrCreateDevice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: TransactionWritePayload,
  channel: FeatureChannel,
) {
  const country = normalizeCountry(payload.country);
  const targetIp = payload.ip_address || null;

  const byFingerprint = await supabase
    .from("devices" as never)
    .select("id, risk_level, last_country, updated_at")
    .eq("user_id" as never, userId)
    .eq("device_fingerprint" as never, payload.device_id)
    .order("updated_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(byFingerprint.error);

  const byLabel = byFingerprint.data
    ? { data: null as unknown, error: null as { message: string } | null }
    : await supabase
        .from("devices" as never)
        .select("id, risk_level, last_country, updated_at")
        .eq("user_id" as never, userId)
        .ilike("label" as never, payload.device_id)
        .order("updated_at" as never, { ascending: false })
        .limit(1)
        .maybeSingle();
  throwIfError(byLabel.error as { message: string } | null);

  const existing = (byFingerprint.data ?? byLabel.data) as
    | { id: string; risk_level: "low" | "medium" | "high"; last_country: string | null }
    | null;

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      last_country: country,
    };
    if (targetIp) updatePayload.ip_address = targetIp;
    const updateRes = await supabase
      .from("devices" as never)
      .update(updatePayload as never)
      .eq("id" as never, existing.id)
      .eq("user_id" as never, userId);
    throwIfError(updateRes.error);

    return {
      id: existing.id,
      risk_level: existing.risk_level,
      last_country: existing.last_country,
    } as DeviceRow;
  }

  const inferredRisk = inferDeviceRisk(payload.device_id);
  const deviceType =
    channel === "mobile_app" ? "mobile" : channel === "api" ? "server" : "desktop";
  const insertRes = await supabase
    .from("devices" as never)
    .insert({
      user_id: userId,
      label: payload.device_id,
      device_fingerprint: payload.device_id,
      device_type: deviceType,
      ip_address: targetIp,
      last_country: country,
      last_seen_at: new Date().toISOString(),
      risk_level: inferredRisk,
    } as never)
    .select("id, risk_level, last_country")
    .single();
  throwIfError(insertRes.error);
  const created = insertRes.data as Record<string, unknown> | null;
  if (!created) {
    throw new Error("Failed to create device");
  }
  return {
    id: String(created.id),
    risk_level: (created.risk_level as DeviceRow["risk_level"]) ?? inferredRisk,
    last_country: created.last_country ? String(created.last_country) : null,
  } as DeviceRow;
}

async function getPaymentMethodContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  paymentMethod: string,
) {
  const normalized = paymentMethod.trim().toLowerCase();
  const queryByColumn = async (column: string) => {
    const result = await supabase
      .from("payment_methods" as never)
      .select("id, status, country, is_default, updated_at")
      .eq("user_id" as never, userId)
      .ilike(column as never, normalized)
      .order("is_default" as never, { ascending: false })
      .order("updated_at" as never, { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(result.error);
    return result.data as
      | { id: string; status: "active" | "blocked" | "expired"; country: string | null }
      | null;
  };

  const found =
    (await queryByColumn("method_type")) ??
    (await queryByColumn("provider")) ??
    (await queryByColumn("fingerprint"));

  if (!found) return null;

  return {
    id: found.id,
    status: found.status,
    country: found.country,
  } as PaymentMethodRow;
}

async function getVelocityStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  excludedTransactionId?: string,
) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let q1 = supabase
    .from("transactions" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id" as never, userId)
    .gte("occurred_at" as never, oneHourAgo);
  let q24 = supabase
    .from("transactions" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id" as never, userId)
    .gte("occurred_at" as never, dayAgo);
  let qAvg = supabase
    .from("transactions" as never)
    .select("amount")
    .eq("user_id" as never, userId)
    .limit(5000);

  if (excludedTransactionId) {
    q1 = q1.neq("id" as never, excludedTransactionId);
    q24 = q24.neq("id" as never, excludedTransactionId);
    qAvg = qAvg.neq("id" as never, excludedTransactionId);
  }

  const [oneHourRes, dayRes, avgRes] = await Promise.all([q1, q24, qAvg]);
  throwIfError(oneHourRes.error);
  throwIfError(dayRes.error);
  throwIfError(avgRes.error);

  const amounts = (avgRes.data ?? []).map((row) =>
    toNumber((row as { amount: unknown }).amount),
  );
  const historicalAvgAmount =
    amounts.length === 0
      ? 0
      : amounts.reduce((acc, amount) => acc + amount, 0) / amounts.length;

  return {
    velocity_1h: oneHourRes.count ?? 0,
    velocity_24h: dayRes.count ?? 0,
    historical_avg_amount: historicalAvgAmount,
  } as VelocityStats;
}

async function getRuleSet(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const result = await supabase
    .from("risk_rules" as never)
    .select("name, rule_type, operator, threshold, weight")
    .eq("user_id" as never, userId)
    .eq("is_active" as never, true);
  throwIfError(result.error);

  return ((result.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    name: String(row.name ?? ""),
    rule_type: String(row.rule_type ?? "amount") as RuleType,
    operator: String(row.operator ?? "gt") as RuleOperator,
    threshold:
      row.threshold === null || row.threshold === undefined
        ? null
        : toNumber(row.threshold, 0),
    weight: Math.max(1, Math.round(toNumber(row.weight, 10))),
  }));
}

async function getChargebackRatio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const [totalRes, riskyRes] = await Promise.all([
    supabase
      .from("chargebacks" as never)
      .select("id", { count: "exact", head: true })
      .eq("user_id" as never, userId),
    supabase
      .from("chargebacks" as never)
      .select("id", { count: "exact", head: true })
      .eq("user_id" as never, userId)
      .in("status" as never, ["received", "disputed", "lost"]),
  ]);
  throwIfError(totalRes.error);
  throwIfError(riskyRes.error);

  const total = totalRes.count ?? 0;
  if (total === 0) return 0;
  return (riskyRes.count ?? 0) / total;
}

async function getIdentityStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const result = await supabase
    .from("identity_verifications" as never)
    .select("status, updated_at")
    .eq("user_id" as never, userId)
    .order("updated_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(result.error);
  const row = result.data as { status?: string } | null;
  if (!row?.status) return null;
  return row.status as
    | "pending"
    | "verified"
    | "failed"
    | "manual_review";
}

async function getCustomerRiskScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const result = await supabase
    .from("customer_risk_profiles" as never)
    .select("risk_score")
    .eq("user_id" as never, userId)
    .limit(1)
    .maybeSingle();
  throwIfError(result.error);
  const row = result.data as { risk_score?: unknown } | null;
  return toNumber(row?.risk_score, 0);
}

async function getAccountTakeoverEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const result = await supabase
    .from("account_security_events" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id" as never, userId)
    .in("event_type" as never, ["login_failed", "mfa_failed"])
    .gte("occurred_at" as never, since);
  throwIfError(result.error);
  return result.count ?? 0;
}

async function getWatchlistSignals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: TransactionWritePayload,
) {
  const result = await supabase
    .from("entity_lists" as never)
    .select("entity_type, entity_value, list_type, expires_at")
    .eq("user_id" as never, userId)
    .eq("is_active" as never, true);
  throwIfError(result.error);

  const now = Date.now();
  const country = normalizeCountry(payload.country);
  const paymentMethod = payload.payment_method.toLowerCase();
  const ip = payload.ip_address ?? "";

  let watchlistHit = false;
  let allowlistHit = false;

  for (const row of (result.data ?? []) as Array<{
    entity_type: string;
    entity_value: string;
    list_type: "whitelist" | "blacklist";
    expires_at: string | null;
  }>) {
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue;

    const entityType = row.entity_type;
    const value = row.entity_value;
    const isMatch =
      (entityType === "ip" && value === ip) ||
      (entityType === "device" && value === payload.device_id) ||
      (entityType === "country" && value.toUpperCase() === country) ||
      (entityType === "payment_method" && value.toLowerCase() === paymentMethod);

    if (!isMatch) continue;
    if (row.list_type === "blacklist") watchlistHit = true;
    if (row.list_type === "whitelist") allowlistHit = true;
  }

  return { watchlistHit, allowlistHit };
}

async function getModelContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const result = await supabase
    .from("model_registry" as never)
    .select("version, review_threshold, block_threshold, updated_at")
    .eq("user_id" as never, userId)
    .eq("status" as never, "active")
    .order("updated_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(result.error);
  const row = result.data as
    | { version?: unknown; review_threshold?: unknown; block_threshold?: unknown }
    | null;
  if (!row) {
    return {
      version: "fraud-v4.0.0",
      review_threshold: 40,
      block_threshold: 70,
    } as ModelRow;
  }

  return {
    version: String(row.version ?? "fraud-v4.0.0"),
    review_threshold: Math.max(1, Math.round(toNumber(row.review_threshold, 40))),
    block_threshold: Math.max(1, Math.round(toNumber(row.block_threshold, 70))),
  } as ModelRow;
}

async function getActiveAlertIntegrations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const result = await supabase
    .from("api_integrations" as never)
    .select(
      "id, name, integration_type, endpoint, status, secret_ref, last_delivery_at, last_error, updated_at",
    )
    .eq("user_id" as never, userId)
    .eq("status" as never, "active");
  throwIfError(result.error);
  return (result.data ?? []) as ApiIntegrationRow[];
}

async function getActiveAlertChannels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<AlertChannel[]> {
  const result = await supabase
    .from("api_integrations" as never)
    .select("integration_type")
    .eq("user_id" as never, userId)
    .eq("status" as never, "active");
  throwIfError(result.error);

  const channels = new Set<AlertChannel>(["in_app"]);
  for (const row of (result.data ?? []) as Array<{ integration_type: string }>) {
    if (row.integration_type === "webhook" || row.integration_type === "siem") channels.add("webhook");
    if (row.integration_type === "email") channels.add("email");
    if (row.integration_type === "slack") channels.add("slack");
  }
  return [...channels];
}

async function refreshCustomerRiskProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const transactionsRes = await supabase
    .from("transactions" as never)
    .select("risk_score, status, chargeback_probability, occurred_at")
    .eq("user_id" as never, userId)
    .limit(5000);
  throwIfError(transactionsRes.error);
  const txRows = (transactionsRes.data ?? []) as Array<{
    risk_score: number;
    status: "approved" | "review" | "blocked";
    chargeback_probability: number;
    occurred_at: string;
  }>;

  const totalTransactions = txRows.length;
  const blockedTransactions = txRows.filter((row) => row.status === "blocked").length;
  const reviewTransactions = txRows.filter((row) => row.status === "review").length;
  const avgRisk =
    totalTransactions === 0
      ? 1
      : Math.max(
          1,
          Math.min(
            99,
            Math.round(
              txRows.reduce((acc, row) => acc + toNumber(row.risk_score, 0), 0) /
                totalTransactions,
            ),
          ),
        );
  const riskTier = avgRisk >= 70 ? "high" : avgRisk >= 40 ? "medium" : "low";
  const avgChargebackProbability =
    totalTransactions === 0
      ? 0
      : Number(
          (
            txRows.reduce((acc, row) => acc + toNumber(row.chargeback_probability, 0), 0) /
            totalTransactions
          ).toFixed(2),
        );
  const lastTransactionAt =
    txRows
      .map((row) => row.occurred_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  const [chargebacksRes, failedEventsRes, watchlistRes] = await Promise.all([
    supabase
      .from("chargebacks" as never)
      .select("id", { count: "exact", head: true })
      .eq("user_id" as never, userId),
    supabase
      .from("account_security_events" as never)
      .select("id", { count: "exact", head: true })
      .eq("user_id" as never, userId)
      .in("event_type" as never, ["login_failed", "mfa_failed"])
      .gte("occurred_at" as never, new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("entity_lists" as never)
      .select("id", { count: "exact", head: true })
      .eq("user_id" as never, userId)
      .eq("is_active" as never, true),
  ]);
  throwIfError(chargebacksRes.error);
  throwIfError(failedEventsRes.error);
  throwIfError(watchlistRes.error);

  const upsertRes = await supabase
    .from("customer_risk_profiles" as never)
    .upsert(
      {
        user_id: userId,
        risk_score: avgRisk,
        risk_tier: riskTier,
        total_transactions: totalTransactions,
        blocked_transactions: blockedTransactions,
        review_transactions: reviewTransactions,
        chargeback_count: chargebacksRes.count ?? 0,
        avg_chargeback_probability: avgChargebackProbability,
        last_transaction_at: lastTransactionAt,
        signals: {
          last_computed_at: new Date().toISOString(),
          failed_security_events_6h: failedEventsRes.count ?? 0,
          watchlist_entries: watchlistRes.count ?? 0,
        },
      } as never,
      { onConflict: "user_id" },
    );
  throwIfError(upsertRes.error);
}

async function upsertRiskAuditReport(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  transactionId: string;
  evaluation: RiskEvaluation;
  reasonCodes: string[];
  channel: FeatureChannel;
}) {
  const statusRes = await params.supabase
    .from("transactions" as never)
    .select("status")
    .eq("user_id" as never, params.userId)
    .limit(5000);
  throwIfError(statusRes.error);
  const statuses = (statusRes.data ?? []) as Array<{ status: "approved" | "review" | "blocked" }>;

  const total = statuses.length;
  const blocked = statuses.filter((row) => row.status === "blocked").length;
  const review = statuses.filter((row) => row.status === "review").length;

  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const periodEnd = now.toISOString().slice(0, 10);

  const summary = {
    total_transactions: total,
    blocked_transactions: blocked,
    review_transactions: review,
    last_transaction_id: params.transactionId,
    last_decision: params.evaluation.status,
    last_score: params.evaluation.score,
    last_reason_codes: params.reasonCodes,
    last_channel: params.channel,
    updated_at: new Date().toISOString(),
  };

  const upsertRes = await params.supabase
    .from("compliance_reports" as never)
    .upsert(
      {
        user_id: params.userId,
        report_type: "risk_audit",
        period_start: periodStart,
        period_end: periodEnd,
        status: "generated",
        summary,
        generated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,report_type,period_start,period_end" },
    );
  throwIfError(upsertRes.error);
}

async function buildRiskContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: TransactionWritePayload,
  excludedTransactionId?: string,
): Promise<RiskContext> {
  const country = normalizeCountry(payload.country);
  const channel = normalizeChannel(payload.channel);
  const device = await getOrCreateDevice(supabase, userId, { ...payload, country }, channel);

  const [
    paymentMethod,
    velocity,
    rules,
    chargebackRatio,
    identityStatus,
    customerRiskScore,
    accountTakeoverEvents,
    watchlistSignals,
    model,
  ] = await Promise.all([
    getPaymentMethodContext(supabase, userId, payload.payment_method),
    getVelocityStats(supabase, userId, excludedTransactionId),
    getRuleSet(supabase, userId),
    getChargebackRatio(supabase, userId),
    getIdentityStatus(supabase, userId),
    getCustomerRiskScore(supabase, userId),
    getAccountTakeoverEvents(supabase, userId),
    getWatchlistSignals(supabase, userId, payload),
    getModelContext(supabase, userId),
  ]);

  const velocityWithCurrent = {
    velocity_1h: velocity.velocity_1h + 1,
    velocity_24h: velocity.velocity_24h + 1,
  };

  const behaviorAnomaly = computeBehaviorAnomaly(payload.behavioral_biometrics);
  const geoMismatch = Boolean(device.last_country && normalizeCountry(device.last_country) !== country);
  const rulesEval = evaluateRules(rules, {
    amount: payload.amount,
    velocity_1h: velocityWithCurrent.velocity_1h,
    velocity_24h: velocityWithCurrent.velocity_24h,
    country,
    device_id: payload.device_id,
    device_risk_level: device.risk_level,
    payment_method: payload.payment_method,
    payment_method_status: paymentMethod?.status ?? null,
  });

  return {
    velocity: {
      velocity_1h: velocityWithCurrent.velocity_1h,
      velocity_24h: velocityWithCurrent.velocity_24h,
      historical_avg_amount: velocity.historical_avg_amount,
    },
    device,
    paymentMethod,
    accountTakeoverEvents,
    identityStatus,
    customerRiskScore,
    watchlistHit: watchlistSignals.watchlistHit,
    allowlistHit: watchlistSignals.allowlistHit,
    model,
    chargebackRatio,
    matchedRuleCodes: rulesEval.matchedRuleCodes,
    matchedRuleNames: rulesEval.matchedRuleNames,
    ruleWeightBoost: rulesEval.ruleWeightBoost,
    behaviorAnomaly,
    channel,
    geoMismatch,
  };
}

function buildRiskEvaluation(payload: TransactionWritePayload, context: RiskContext) {
  const evaluation = evaluateRiskSignals({
    amount: payload.amount,
    country: normalizeCountry(payload.country),
    payment_method: payload.payment_method,
    device_id: payload.device_id,
    velocity_1h: context.velocity.velocity_1h,
    velocity_24h: context.velocity.velocity_24h,
    historical_avg_amount: context.velocity.historical_avg_amount,
    device_risk_level: context.device.risk_level,
    payment_method_status: context.paymentMethod?.status ?? null,
    account_takeover_events: context.accountTakeoverEvents,
    behavior_anomaly: context.behaviorAnomaly,
    geo_mismatch: context.geoMismatch,
    identity_status: context.identityStatus,
    customer_risk_score: context.customerRiskScore,
    chargeback_ratio: context.chargebackRatio,
    watchlist_hit: context.watchlistHit,
    allowlist_hit: context.allowlistHit,
    rule_weight_boost: context.ruleWeightBoost,
    channel: context.channel,
    model_review_threshold: context.model.review_threshold,
    model_block_threshold: context.model.block_threshold,
  });

  return {
    evaluation,
    reasonCodes: [...new Set([...evaluation.reason_codes, ...context.matchedRuleCodes])],
  };
}

async function writeRiskArtifacts(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  transaction: Transaction;
  payload: TransactionWritePayload;
  context: RiskContext;
  evaluation: RiskEvaluation;
  reasonCodes: string[];
}) {
  const explanation = {
    channel: params.context.channel,
    model_version: params.context.model.version,
    matched_rule_names: params.context.matchedRuleNames,
    watchlist_hit: params.context.watchlistHit,
    allowlist_hit: params.context.allowlistHit,
    identity_status: params.context.identityStatus,
    account_takeover_events_6h: params.context.accountTakeoverEvents,
    behavior_anomaly: params.context.behaviorAnomaly,
    geo_mismatch: params.context.geoMismatch,
    payment_method_status: params.context.paymentMethod?.status ?? "unknown",
    payment_method_country: params.context.paymentMethod?.country ?? null,
    device_risk_level: params.context.device.risk_level,
    velocity_1h: params.context.velocity.velocity_1h,
    velocity_24h: params.context.velocity.velocity_24h,
    historical_avg_amount: params.context.velocity.historical_avg_amount,
    customer_risk_score: params.context.customerRiskScore,
    chargeback_ratio: params.context.chargebackRatio,
    feature_breakdown: params.evaluation.breakdown,
  };

  const riskRes = await params.supabase
    .from("risk_scores" as never)
    .upsert(
      {
        user_id: params.userId,
        transaction_id: params.transaction.id,
        model_version: params.context.model.version,
        score: params.evaluation.score,
        decision: params.evaluation.status,
        reason_codes: params.reasonCodes,
        explanation,
      } as never,
      { onConflict: "transaction_id" },
    );
  throwIfError(riskRes.error);

  const channelRes = await params.supabase
    .from("channel_events" as never)
    .insert({
      user_id: params.userId,
      transaction_id: params.transaction.id,
      channel: params.context.channel,
      event_type: `transaction_${params.evaluation.status}`,
      metadata: {
        score: params.evaluation.score,
        reason_codes: params.reasonCodes,
      },
      occurred_at: new Date().toISOString(),
    } as never);
  throwIfError(channelRes.error);

  const graphRes = await params.supabase
    .from("graph_edges" as never)
    .insert([
      {
        user_id: params.userId,
        transaction_id: params.transaction.id,
        source_type: "user",
        source_value: params.userId,
        target_type: "device",
        target_value: params.payload.device_id,
        signal: "shared_device",
        weight: 1.25,
      },
      {
        user_id: params.userId,
        transaction_id: params.transaction.id,
        source_type: "device",
        source_value: params.payload.device_id,
        target_type: "ip",
        target_value: params.payload.ip_address || "unknown",
        signal: "ip_reuse",
        weight: 1.1,
      },
      {
        user_id: params.userId,
        transaction_id: params.transaction.id,
        source_type: "payment_method",
        source_value: params.payload.payment_method,
        target_type: "merchant",
        target_value: params.payload.merchant_name,
        signal: "merchant_method_cluster",
        weight: 0.95,
      },
    ] as never);
  throwIfError(graphRes.error);

  let caseId: string | null = null;
  const openCaseRes = await params.supabase
    .from("fraud_cases" as never)
    .select("id, created_at")
    .eq("user_id" as never, params.userId)
    .eq("transaction_id" as never, params.transaction.id)
    .neq("status" as never, "resolved")
    .order("created_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(openCaseRes.error);
  const openCase = openCaseRes.data as { id?: string } | null;
  if (openCase?.id) caseId = String(openCase.id);

  if (!caseId && (params.evaluation.status === "blocked" || params.evaluation.score >= 78)) {
    const caseRes = await params.supabase
      .from("fraud_cases" as never)
      .insert({
        user_id: params.userId,
        transaction_id: params.transaction.id,
        title: `Auto case: ${params.payload.merchant_name}`,
        reason: `Automated controls flagged this transaction (${params.reasonCodes.join(", ")}).`,
        status: params.evaluation.status === "blocked" ? "open" : "investigating",
        severity: params.evaluation.severity,
        assigned_to: "analyst@aegis.com",
      } as never)
      .select("id")
      .single();
    throwIfError(caseRes.error);
    const insertedCase = caseRes.data as { id?: string } | null;
    if (insertedCase?.id) {
      caseId = String(insertedCase.id);
    }
  }

  if (params.evaluation.status !== "approved") {
    const recentAlertRes = await params.supabase
      .from("alerts" as never)
      .select("id")
      .eq("user_id" as never, params.userId)
      .eq("transaction_id" as never, params.transaction.id)
      .in("status" as never, ["new", "sent", "acknowledged"])
      .gte("created_at" as never, new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(1);
    throwIfError(recentAlertRes.error);

    if ((recentAlertRes.data ?? []).length === 0) {
      const channels = await getActiveAlertChannels(params.supabase, params.userId);
      const rows = channels.map((channel) => {
        const isInApp = channel === "in_app";
        return {
          user_id: params.userId,
          transaction_id: params.transaction.id,
          case_id: caseId,
          channel,
          severity: params.evaluation.severity,
          status: isInApp ? "new" : "sent",
          title: `${params.evaluation.status.toUpperCase()} risk decision`,
          message: `${params.payload.merchant_name} scored ${params.evaluation.score} (${params.reasonCodes.join(", ")}).`,
          sent_at: isInApp ? null : new Date().toISOString(),
        };
      });

      const insertedRes = await params.supabase
        .from("alerts" as never)
        .insert(rows as never)
        .select(
          "id, channel, severity, status, title, message, created_at, updated_at, transaction_id, case_id, sent_at, acknowledged_at",
        );
      throwIfError(insertedRes.error);

      const integrations = await getActiveAlertIntegrations(params.supabase, params.userId);
      await Promise.allSettled(
        ((insertedRes.data ?? []) as AlertRow[]).map((alert) => dispatchAlert(alert, integrations)),
      );
    }
  }

  await upsertRiskAuditReport({
    supabase: params.supabase,
    userId: params.userId,
    transactionId: params.transaction.id,
    evaluation: params.evaluation,
    reasonCodes: params.reasonCodes,
    channel: params.context.channel,
  });

  if (params.context.behaviorAnomaly > 0) {
    const biometricsRes = await params.supabase
      .from("behavioral_biometrics" as never)
      .insert({
        user_id: params.userId,
        transaction_id: params.transaction.id,
        typing_cadence_ms: params.payload.behavioral_biometrics?.typing_cadence_ms ?? null,
        pointer_velocity: params.payload.behavioral_biometrics?.pointer_velocity ?? null,
        touch_pressure: params.payload.behavioral_biometrics?.touch_pressure ?? null,
        scroll_speed: params.payload.behavioral_biometrics?.scroll_speed ?? null,
        anomaly_score: params.context.behaviorAnomaly,
      } as never);
    throwIfError(biometricsRes.error);
  }

  await refreshCustomerRiskProfile(params.supabase, params.userId);
}

async function getStoredTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
) {
  const result = await supabase
    .from("transactions" as never)
    .select(
      "merchant_name, merchant_category, amount, currency, payment_method, ip_address, country, device_id",
    )
    .eq("id" as never, id)
    .eq("user_id" as never, userId)
    .maybeSingle();
  throwIfError(result.error);
  if (!result.data) return null;

  const row = result.data as Record<string, unknown>;
  return {
    merchant_name: String(row.merchant_name ?? ""),
    merchant_category:
      row.merchant_category === null || row.merchant_category === undefined
        ? null
        : String(row.merchant_category),
    amount: toNumber(row.amount, 0),
    currency: String(row.currency ?? "USD"),
    payment_method: String(row.payment_method ?? ""),
    ip_address:
      row.ip_address === null || row.ip_address === undefined ? null : String(row.ip_address),
    country: String(row.country ?? "US"),
    device_id: String(row.device_id ?? ""),
  } as StoredTransaction;
}

export async function getSupabaseTransactions(limit?: number): Promise<Transaction[]> {
  const { supabase, userId } = await getAuthedClient();
  let query = supabase
    .from("transactions" as never)
    .select(TRANSACTION_SELECT)
    .eq("user_id" as never, userId)
    .order("created_at" as never, { ascending: false });
  if (limit) query = query.limit(limit);
  const result = await query;
  throwIfError(result.error);
  return (result.data ?? []) as Transaction[];
}

export async function getSupabaseCases(limit?: number): Promise<FraudCase[]> {
  const { supabase, userId } = await getAuthedClient();
  let query = supabase
    .from("fraud_cases" as never)
    .select(
      "id, created_at, updated_at, user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes",
    )
    .eq("user_id" as never, userId)
    .order("created_at" as never, { ascending: false });
  if (limit) query = query.limit(limit);
  const result = await query;
  throwIfError(result.error);
  return (result.data ?? []) as FraudCase[];
}

export async function createSupabaseTransaction(payload: TransactionWritePayload) {
  const { supabase, userId } = await getAuthedClient();

  const normalizedPayload: TransactionWritePayload = {
    ...payload,
    country: normalizeCountry(payload.country),
    currency: payload.currency ?? "USD",
    merchant_category: payload.merchant_category ?? "general",
    channel: normalizeChannel(payload.channel),
  };

  const context = await buildRiskContext(supabase, userId, normalizedPayload);
  const { evaluation, reasonCodes } = buildRiskEvaluation(normalizedPayload, context);

  const insertRes = (await supabase
    .from("transactions" as never)
    .insert({
      user_id: userId,
      merchant_name: normalizedPayload.merchant_name,
      merchant_category: normalizedPayload.merchant_category,
      amount: normalizedPayload.amount,
      currency: normalizedPayload.currency,
      status: evaluation.status,
      risk_score: evaluation.score,
      payment_method: normalizedPayload.payment_method,
      payment_method_id: context.paymentMethod?.id ?? null,
      ip_address: normalizedPayload.ip_address || null,
      country: normalizedPayload.country,
      device_id: normalizedPayload.device_id,
      device_ref_id: context.device.id,
      velocity_1h: context.velocity.velocity_1h,
      velocity_24h: context.velocity.velocity_24h,
      chargeback_probability: evaluation.chargeback_probability,
      occurred_at: new Date().toISOString(),
    } as never)
    .select(TRANSACTION_SELECT)
    .single()) as { error: { message: string } | null; data: Transaction | null };
  throwIfError(insertRes.error);
  if (!insertRes.data) {
    throw new Error("Failed to create transaction");
  }
  const transaction = insertRes.data as Transaction;
  await writeRiskArtifacts({
    supabase,
    userId,
    transaction,
    payload: normalizedPayload,
    context,
    evaluation,
    reasonCodes,
  });

  return transaction;
}

export async function updateSupabaseTransaction(
  id: string,
  payload: TransactionUpdatePayload,
) {
  const { supabase, userId } = await getAuthedClient();
  const existing = await getStoredTransaction(supabase, userId, id);
  if (!existing) return null;

  const mergedPayload: TransactionWritePayload = {
    merchant_name: payload.merchant_name ?? existing.merchant_name,
    merchant_category: payload.merchant_category ?? existing.merchant_category,
    amount: payload.amount ?? existing.amount,
    currency: payload.currency ?? existing.currency,
    payment_method: payload.payment_method ?? existing.payment_method,
    ip_address: payload.ip_address ?? existing.ip_address ?? "",
    country: payload.country ?? existing.country,
    device_id: payload.device_id ?? existing.device_id,
    channel: payload.channel ?? "web",
    behavioral_biometrics: payload.behavioral_biometrics ?? null,
  };

  const normalizedPayload: TransactionWritePayload = {
    ...mergedPayload,
    country: normalizeCountry(mergedPayload.country),
    currency: mergedPayload.currency ?? "USD",
    merchant_category: mergedPayload.merchant_category ?? "general",
    channel: normalizeChannel(mergedPayload.channel),
  };

  const context = await buildRiskContext(supabase, userId, normalizedPayload, id);
  const { evaluation, reasonCodes } = buildRiskEvaluation(normalizedPayload, context);

  const updateRes = await supabase
    .from("transactions" as never)
    .update({
      merchant_name: normalizedPayload.merchant_name,
      merchant_category: normalizedPayload.merchant_category,
      amount: normalizedPayload.amount,
      currency: normalizedPayload.currency,
      status: evaluation.status,
      risk_score: evaluation.score,
      payment_method: normalizedPayload.payment_method,
      payment_method_id: context.paymentMethod?.id ?? null,
      ip_address: normalizedPayload.ip_address || null,
      country: normalizedPayload.country,
      device_id: normalizedPayload.device_id,
      device_ref_id: context.device.id,
      velocity_1h: context.velocity.velocity_1h,
      velocity_24h: context.velocity.velocity_24h,
      chargeback_probability: evaluation.chargeback_probability,
      occurred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id" as never, id)
    .eq("user_id" as never, userId)
    .select(TRANSACTION_SELECT)
    .maybeSingle();
  throwIfError(updateRes.error);
  if (!updateRes.data) return null;

  const transaction = updateRes.data as Transaction;
  await writeRiskArtifacts({
    supabase,
    userId,
    transaction,
    payload: normalizedPayload,
    context,
    evaluation,
    reasonCodes,
  });

  return transaction;
}

export async function deleteSupabaseTransaction(id: string) {
  const { supabase, userId } = await getAuthedClient();
  const deleteRes = await supabase
    .from("transactions" as never)
    .delete()
    .eq("id" as never, id)
    .eq("user_id" as never, userId);
  throwIfError(deleteRes.error);
  await refreshCustomerRiskProfile(supabase, userId);
}

export async function createSupabaseCase(
  payload: Omit<FraudCase, "id" | "created_at" | "updated_at" | "user_id">,
) {
  const { supabase, userId } = await getAuthedClient();
  const result = (await supabase
    .from("fraud_cases" as never)
    .insert({
      user_id: userId,
      transaction_id: payload.transaction_id,
      title: payload.title,
      reason: payload.reason,
      status: payload.status,
      severity: payload.severity,
      assigned_to: payload.assigned_to,
      resolution_notes: payload.resolution_notes,
    } as never)
    .select(
      "id, created_at, updated_at, user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes",
    )
    .single()) as { error: { message: string } | null; data: FraudCase | null };
  throwIfError(result.error);
  if (!result.data) {
    throw new Error("Failed to create fraud case");
  }
  return result.data as FraudCase;
}

export async function updateSupabaseCase(
  id: string,
  payload: Partial<Omit<FraudCase, "id" | "created_at" | "updated_at" | "user_id">>,
) {
  const { supabase, userId } = await getAuthedClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.transaction_id !== undefined) updates.transaction_id = payload.transaction_id;
  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.reason !== undefined) updates.reason = payload.reason;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.severity !== undefined) updates.severity = payload.severity;
  if (payload.assigned_to !== undefined) updates.assigned_to = payload.assigned_to;
  if (payload.resolution_notes !== undefined) updates.resolution_notes = payload.resolution_notes;

  const result = await supabase
    .from("fraud_cases" as never)
    .update(updates as never)
    .eq("id" as never, id)
    .eq("user_id" as never, userId)
    .select(
      "id, created_at, updated_at, user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes",
    )
    .maybeSingle();
  throwIfError(result.error);
  if (!result.data) return null;
  return result.data as FraudCase;
}

export async function deleteSupabaseCase(id: string) {
  const { supabase, userId } = await getAuthedClient();
  const result = await supabase
    .from("fraud_cases" as never)
    .delete()
    .eq("id" as never, id)
    .eq("user_id" as never, userId);
  throwIfError(result.error);
}
