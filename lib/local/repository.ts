import type { FraudCase, Profile, Transaction } from "@/lib/types";
import { query } from "@/lib/local/db";
import { LOCAL_DEMO_USER_ID } from "@/lib/mode";
import { evaluateRiskSignals, type RiskEvaluation } from "@/lib/risk";

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

type LocalDevice = {
  id: string;
  risk_level: "low" | "medium" | "high";
  last_country: string | null;
};

type LocalPaymentMethod = {
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
  id: string;
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
  device: LocalDevice;
  paymentMethod: LocalPaymentMethod | null;
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

const TRANSACTION_SELECT = `
  id,
  created_at,
  updated_at,
  user_id,
  merchant_name,
  amount::float8 as amount,
  status,
  risk_score,
  payment_method,
  coalesce(host(ip_address), '') as ip_address,
  trim(country)::text as country,
  device_id
`;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  if (normalized.includes("unknown") || normalized.includes("new")) return "high";
  if (normalized.includes("server") || normalized.includes("remote")) return "medium";
  return "low";
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

async function getOrCreateDevice(payload: TransactionWritePayload, channel: FeatureChannel) {
  const existing = await query<LocalDevice>(
    `select id::text as id, risk_level, trim(last_country)::text as last_country
     from devices
     where user_id = $1
       and (device_fingerprint = $2 or lower(label) = lower($2))
     order by updated_at desc
     limit 1`,
    [LOCAL_DEMO_USER_ID, payload.device_id],
  );
  if (existing[0]) {
    await query(
      `update devices
       set last_seen_at = now(),
           ip_address = coalesce($3::inet, ip_address),
           last_country = $4
       where id = $1::uuid and user_id = $2`,
      [existing[0].id, LOCAL_DEMO_USER_ID, payload.ip_address || null, normalizeCountry(payload.country)],
    );
    return existing[0];
  }

  const inferredRisk = inferDeviceRisk(payload.device_id);
  const deviceType = channel === "mobile_app" ? "mobile" : channel === "api" ? "server" : "desktop";

  const inserted = await query<LocalDevice>(
    `insert into devices
      (user_id, label, device_fingerprint, device_type, ip_address, last_country, last_seen_at, risk_level)
     values ($1, $2, $3, $4, $5::inet, $6, now(), $7)
     returning id::text as id, risk_level, trim(last_country)::text as last_country`,
    [
      LOCAL_DEMO_USER_ID,
      payload.device_id,
      payload.device_id,
      deviceType,
      payload.ip_address || null,
      normalizeCountry(payload.country),
      inferredRisk,
    ],
  );
  return inserted[0];
}

async function getPaymentMethodContext(paymentMethod: string) {
  const rows = await query<LocalPaymentMethod>(
    `select id::text as id, status, trim(country)::text as country
     from payment_methods
     where user_id = $1
       and (
         lower(method_type) = lower($2)
         or lower(provider) = lower($2)
         or lower(fingerprint) = lower($2)
       )
     order by is_default desc, updated_at desc
     limit 1`,
    [LOCAL_DEMO_USER_ID, paymentMethod],
  );
  return rows[0] ?? null;
}

async function getVelocityStats(excludedTransactionId?: string) {
  const params: unknown[] = [LOCAL_DEMO_USER_ID];
  let sql = `
    select
      count(*) filter (where occurred_at >= now() - interval '1 hour')::int as velocity_1h,
      count(*) filter (where occurred_at >= now() - interval '24 hours')::int as velocity_24h,
      coalesce(avg(amount), 0)::float8 as historical_avg_amount
    from transactions
    where user_id = $1
  `;

  if (excludedTransactionId) {
    params.push(excludedTransactionId);
    sql += ` and id <> $2::uuid`;
  }

  const rows = await query<VelocityStats>(sql, params);
  return rows[0] ?? { velocity_1h: 0, velocity_24h: 0, historical_avg_amount: 0 };
}

async function getRuleSet() {
  return query<ActiveRiskRule>(
    `select name, rule_type, operator, threshold::float8 as threshold, weight::int as weight
     from risk_rules
     where user_id = $1 and is_active = true`,
    [LOCAL_DEMO_USER_ID],
  );
}

async function getChargebackRatio() {
  const rows = await query<{ ratio: number }>(
    `select
      coalesce(
        count(*) filter (where status in ('received', 'disputed', 'lost'))::float8 / nullif(count(*), 0),
        0
      ) as ratio
     from chargebacks
     where user_id = $1`,
    [LOCAL_DEMO_USER_ID],
  );
  return rows[0]?.ratio ?? 0;
}

async function getIdentityStatus() {
  const rows = await query<{ status: "pending" | "verified" | "failed" | "manual_review" }>(
    `select status
     from identity_verifications
     where user_id = $1
     order by updated_at desc
     limit 1`,
    [LOCAL_DEMO_USER_ID],
  );
  return rows[0]?.status ?? null;
}

async function getCustomerRiskScore() {
  const rows = await query<{ risk_score: number }>(
    `select risk_score::int as risk_score
     from customer_risk_profiles
     where user_id = $1
     limit 1`,
    [LOCAL_DEMO_USER_ID],
  );
  return rows[0]?.risk_score ?? 0;
}

async function getAccountTakeoverEvents() {
  const rows = await query<{ failed_events: number }>(
    `select count(*)::int as failed_events
     from account_security_events
     where user_id = $1
       and event_type in ('login_failed', 'mfa_failed')
       and occurred_at >= now() - interval '6 hours'`,
    [LOCAL_DEMO_USER_ID],
  );
  return rows[0]?.failed_events ?? 0;
}

async function getWatchlistSignals(payload: TransactionWritePayload) {
  const rows = await query<{ list_type: "whitelist" | "blacklist" }>(
    `select list_type
     from entity_lists
     where user_id = $1
       and is_active = true
       and (expires_at is null or expires_at > now())
       and (
         (entity_type = 'ip' and entity_value = $2)
         or (entity_type = 'device' and entity_value = $3)
         or (entity_type = 'country' and upper(entity_value) = upper($4))
         or (entity_type = 'payment_method' and lower(entity_value) = lower($5))
       )`,
    [
      LOCAL_DEMO_USER_ID,
      payload.ip_address ?? "",
      payload.device_id,
      normalizeCountry(payload.country),
      payload.payment_method,
    ],
  );

  return {
    watchlistHit: rows.some((row) => row.list_type === "blacklist"),
    allowlistHit: rows.some((row) => row.list_type === "whitelist"),
  };
}

async function getModelContext() {
  const rows = await query<ModelRow>(
    `select version, review_threshold::int as review_threshold, block_threshold::int as block_threshold
     from model_registry
     where user_id = $1 and status = 'active'
     order by updated_at desc
     limit 1`,
    [LOCAL_DEMO_USER_ID],
  );

  return (
    rows[0] ?? {
      version: "fraud-v4.0.0",
      review_threshold: 40,
      block_threshold: 70,
    }
  );
}

async function getActiveAlertChannels(): Promise<AlertChannel[]> {
  const rows = await query<{ integration_type: "webhook" | "email" | "slack" | "siem" }>(
    `select integration_type
     from api_integrations
     where user_id = $1 and status = 'active'`,
    [LOCAL_DEMO_USER_ID],
  );

  const channels = new Set<AlertChannel>(["in_app"]);
  for (const row of rows) {
    if (row.integration_type === "webhook" || row.integration_type === "siem") channels.add("webhook");
    if (row.integration_type === "email") channels.add("email");
    if (row.integration_type === "slack") channels.add("slack");
  }
  return [...channels];
}

async function refreshCustomerRiskProfile() {
  await query(
    `insert into customer_risk_profiles
      (
        user_id,
        risk_score,
        risk_tier,
        total_transactions,
        blocked_transactions,
        review_transactions,
        chargeback_count,
        avg_chargeback_probability,
        last_transaction_at,
        signals
      )
     select
       $1,
       greatest(1, least(99, coalesce(round(avg(t.risk_score))::integer, 1))),
       case
         when coalesce(avg(t.risk_score), 0) >= 70 then 'high'
         when coalesce(avg(t.risk_score), 0) >= 40 then 'medium'
         else 'low'
       end,
       count(*)::integer,
       count(*) filter (where t.status = 'blocked')::integer,
       count(*) filter (where t.status = 'review')::integer,
       coalesce((select count(*)::integer from chargebacks cb where cb.user_id = $1), 0),
       coalesce(round(avg(t.chargeback_probability), 2), 0)::numeric(5, 2),
       max(t.occurred_at),
       jsonb_build_object(
         'last_computed_at', now(),
         'failed_security_events_6h', (
           select count(*) from account_security_events ase
           where ase.user_id = $1
             and ase.event_type in ('login_failed', 'mfa_failed')
             and ase.occurred_at >= now() - interval '6 hours'
         ),
         'watchlist_entries', (
           select count(*) from entity_lists el
           where el.user_id = $1 and el.is_active
         )
       )
     from transactions t
     where t.user_id = $1
     on conflict (user_id) do update
     set
       risk_score = excluded.risk_score,
       risk_tier = excluded.risk_tier,
       total_transactions = excluded.total_transactions,
       blocked_transactions = excluded.blocked_transactions,
       review_transactions = excluded.review_transactions,
       chargeback_count = excluded.chargeback_count,
       avg_chargeback_probability = excluded.avg_chargeback_probability,
       last_transaction_at = excluded.last_transaction_at,
       signals = excluded.signals,
       updated_at = now()`,
    [LOCAL_DEMO_USER_ID],
  );
}

async function upsertRiskAuditReport(params: {
  transactionId: string;
  evaluation: RiskEvaluation;
  reasonCodes: string[];
  channel: FeatureChannel;
}) {
  const counters = await query<{ total: number; blocked: number; review: number }>(
    `select
      count(*)::int as total,
      count(*) filter (where status = 'blocked')::int as blocked,
      count(*) filter (where status = 'review')::int as review
     from transactions
     where user_id = $1`,
    [LOCAL_DEMO_USER_ID],
  );

  const summary = {
    total_transactions: counters[0]?.total ?? 0,
    blocked_transactions: counters[0]?.blocked ?? 0,
    review_transactions: counters[0]?.review ?? 0,
    last_transaction_id: params.transactionId,
    last_decision: params.evaluation.status,
    last_score: params.evaluation.score,
    last_reason_codes: params.reasonCodes,
    last_channel: params.channel,
    updated_at: new Date().toISOString(),
  };

  await query(
    `insert into compliance_reports
      (user_id, report_type, period_start, period_end, status, summary, generated_at)
     values (
       $1,
       'risk_audit',
       date_trunc('month', current_date)::date,
       current_date,
       'generated',
       $2::jsonb,
       now()
     )
     on conflict (user_id, report_type, period_start, period_end)
     do update set
       summary = excluded.summary,
       status = excluded.status,
       generated_at = now(),
       updated_at = now()`,
    [LOCAL_DEMO_USER_ID, JSON.stringify(summary)],
  );
}

async function buildRiskContext(payload: TransactionWritePayload, excludedTransactionId?: string): Promise<RiskContext> {
  const country = normalizeCountry(payload.country);
  const channel = normalizeChannel(payload.channel);
  const device = await getOrCreateDevice({ ...payload, country }, channel);

  const [paymentMethod, velocity, rules, chargebackRatio, identityStatus, customerRiskScore, accountTakeoverEvents, watchlistSignals, model] =
    await Promise.all([
      getPaymentMethodContext(payload.payment_method),
      getVelocityStats(excludedTransactionId),
      getRuleSet(),
      getChargebackRatio(),
      getIdentityStatus(),
      getCustomerRiskScore(),
      getAccountTakeoverEvents(),
      getWatchlistSignals(payload),
      getModelContext(),
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

  const reasonCodes = [...new Set([...evaluation.reason_codes, ...context.matchedRuleCodes])];
  return {
    evaluation,
    reasonCodes,
  };
}

async function writeRiskArtifacts(params: {
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

  await query(
    `insert into risk_scores
      (user_id, transaction_id, model_version, score, decision, reason_codes, explanation)
     values ($1, $2::uuid, $3, $4, $5, $6::text[], $7::jsonb)
     on conflict (transaction_id)
     do update set
       model_version = excluded.model_version,
       score = excluded.score,
       decision = excluded.decision,
       reason_codes = excluded.reason_codes,
       explanation = excluded.explanation,
       updated_at = now()`,
    [
      LOCAL_DEMO_USER_ID,
      params.transaction.id,
      params.context.model.version,
      params.evaluation.score,
      params.evaluation.status,
      params.reasonCodes,
      JSON.stringify(explanation),
    ],
  );

  await query(
    `insert into channel_events (user_id, transaction_id, channel, event_type, metadata, occurred_at)
     values ($1, $2::uuid, $3, $4, $5::jsonb, now())`,
    [
      LOCAL_DEMO_USER_ID,
      params.transaction.id,
      params.context.channel,
      `transaction_${params.evaluation.status}`,
      JSON.stringify({
        score: params.evaluation.score,
        reason_codes: params.reasonCodes,
      }),
    ],
  );

  await query(
    `insert into graph_edges (user_id, transaction_id, source_type, source_value, target_type, target_value, signal, weight)
     values
      ($1, $2::uuid, 'user', $1, 'device', $3, 'shared_device', 1.25),
      ($1, $2::uuid, 'device', $3, 'ip', $4, 'ip_reuse', 1.10),
      ($1, $2::uuid, 'payment_method', $5, 'merchant', $6, 'merchant_method_cluster', 0.95)`,
    [
      LOCAL_DEMO_USER_ID,
      params.transaction.id,
      params.payload.device_id,
      params.payload.ip_address || "unknown",
      params.payload.payment_method,
      params.payload.merchant_name,
    ],
  );

  let caseId: string | null = null;
  const openCase = await query<{ id: string }>(
    `select id::text as id
     from fraud_cases
     where user_id = $1 and transaction_id = $2::uuid and status <> 'resolved'
     order by created_at desc
     limit 1`,
    [LOCAL_DEMO_USER_ID, params.transaction.id],
  );
  caseId = openCase[0]?.id ?? null;

  if (!caseId && (params.evaluation.status === "blocked" || params.evaluation.score >= 78)) {
    const createdCase = await query<{ id: string }>(
      `insert into fraud_cases
        (user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes)
       values
        ($1, $2::uuid, $3, $4, $5, $6, $7, null)
       returning id::text as id`,
      [
        LOCAL_DEMO_USER_ID,
        params.transaction.id,
        `Auto case: ${params.payload.merchant_name}`,
        `Automated controls flagged this transaction (${params.reasonCodes.join(", ")}).`,
        params.evaluation.status === "blocked" ? "open" : "investigating",
        params.evaluation.severity,
        "analyst@aegis.com",
      ],
    );
    caseId = createdCase[0]?.id ?? null;
  }

  if (params.evaluation.status !== "approved") {
    const recentAlert = await query<{ already_alerted: boolean }>(
      `select exists (
        select 1
        from alerts
        where user_id = $1
          and transaction_id = $2::uuid
          and created_at >= now() - interval '30 minutes'
          and status in ('new', 'sent', 'acknowledged')
      ) as already_alerted`,
      [LOCAL_DEMO_USER_ID, params.transaction.id],
    );

    if (!recentAlert[0]?.already_alerted) {
      const channels = await getActiveAlertChannels();
      for (const channel of channels) {
        const isInApp = channel === "in_app";
        await query(
          `insert into alerts
            (user_id, transaction_id, case_id, channel, severity, status, title, message, sent_at)
           values
            ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)`,
          [
            LOCAL_DEMO_USER_ID,
            params.transaction.id,
            caseId,
            channel,
            params.evaluation.severity,
            isInApp ? "new" : "sent",
            `${params.evaluation.status.toUpperCase()} risk decision`,
            `${params.payload.merchant_name} scored ${params.evaluation.score} (${params.reasonCodes.join(", ")}).`,
            isInApp ? null : new Date().toISOString(),
          ],
        );
      }
    }
  }

  await upsertRiskAuditReport({
    transactionId: params.transaction.id,
    evaluation: params.evaluation,
    reasonCodes: params.reasonCodes,
    channel: params.context.channel,
  });

  if (params.context.behaviorAnomaly > 0) {
    await query(
      `insert into behavioral_biometrics
        (user_id, transaction_id, typing_cadence_ms, pointer_velocity, touch_pressure, scroll_speed, anomaly_score)
       values ($1, $2::uuid, $3, $4, $5, $6, $7)`,
      [
        LOCAL_DEMO_USER_ID,
        params.transaction.id,
        params.payload.behavioral_biometrics?.typing_cadence_ms ?? null,
        params.payload.behavioral_biometrics?.pointer_velocity ?? null,
        params.payload.behavioral_biometrics?.touch_pressure ?? null,
        params.payload.behavioral_biometrics?.scroll_speed ?? null,
        params.context.behaviorAnomaly,
      ],
    );
  }

  await refreshCustomerRiskProfile();
}

async function getStoredTransaction(id: string) {
  const rows = await query<StoredTransaction>(
    `select
      id::text as id,
      merchant_name,
      merchant_category,
      amount::float8 as amount,
      currency,
      payment_method,
      coalesce(host(ip_address), '') as ip_address,
      trim(country)::text as country,
      device_id
     from transactions
     where id = $1::uuid and user_id = $2
     limit 1`,
    [id, LOCAL_DEMO_USER_ID],
  );
  return rows[0] ?? null;
}

export async function getLocalProfile(): Promise<Profile | null> {
  const rows = await query<Profile>(
    `select id, created_at, first_name, last_name, email
     from profiles
     where id = $1
     limit 1`,
    [LOCAL_DEMO_USER_ID],
  );
  return rows[0] ?? null;
}

export async function getLocalTransactions(limit?: number): Promise<Transaction[]> {
  const params: unknown[] = [LOCAL_DEMO_USER_ID];
  let sql = `
    select ${TRANSACTION_SELECT}
    from transactions
    where user_id = $1
    order by created_at desc
  `;
  if (limit) {
    params.push(limit);
    sql += ` limit $2`;
  }
  return query<Transaction>(sql, params);
}

export async function getLocalCases(limit?: number): Promise<FraudCase[]> {
  const params: unknown[] = [LOCAL_DEMO_USER_ID];
  let sql = `
    select id, created_at, updated_at, user_id, transaction_id, title, reason,
           status, severity, assigned_to, resolution_notes
    from fraud_cases
    where user_id = $1
    order by created_at desc
  `;
  if (limit) {
    params.push(limit);
    sql += ` limit $2`;
  }
  return query<FraudCase>(sql, params);
}

export async function createLocalTransaction(payload: TransactionWritePayload) {
  const normalizedPayload: TransactionWritePayload = {
    ...payload,
    country: normalizeCountry(payload.country),
    currency: payload.currency ?? "USD",
    merchant_category: payload.merchant_category ?? "general",
    channel: normalizeChannel(payload.channel),
  };

  const context = await buildRiskContext(normalizedPayload);
  const { evaluation, reasonCodes } = buildRiskEvaluation(normalizedPayload, context);

  const rows = await query<Transaction>(
    `insert into transactions
      (
        user_id,
        merchant_name,
        merchant_category,
        amount,
        currency,
        status,
        risk_score,
        payment_method,
        payment_method_id,
        ip_address,
        country,
        device_id,
        device_ref_id,
        velocity_1h,
        velocity_24h,
        chargeback_probability,
        occurred_at
      )
     values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10::inet, $11, $12, $13::uuid, $14, $15, $16, now())
     returning ${TRANSACTION_SELECT}`,
    [
      LOCAL_DEMO_USER_ID,
      normalizedPayload.merchant_name,
      normalizedPayload.merchant_category,
      normalizedPayload.amount,
      normalizedPayload.currency,
      evaluation.status,
      evaluation.score,
      normalizedPayload.payment_method,
      context.paymentMethod?.id ?? null,
      normalizedPayload.ip_address || null,
      normalizedPayload.country,
      normalizedPayload.device_id,
      context.device.id,
      context.velocity.velocity_1h,
      context.velocity.velocity_24h,
      evaluation.chargeback_probability,
    ],
  );

  const transaction = rows[0];
  await writeRiskArtifacts({
    transaction,
    payload: normalizedPayload,
    context,
    evaluation,
    reasonCodes,
  });

  return transaction;
}

export async function updateLocalTransaction(id: string, payload: TransactionUpdatePayload) {
  const existing = await getStoredTransaction(id);
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

  const context = await buildRiskContext(normalizedPayload, id);
  const { evaluation, reasonCodes } = buildRiskEvaluation(normalizedPayload, context);

  const rows = await query<Transaction>(
    `update transactions
     set
       merchant_name = $2,
       merchant_category = $3,
       amount = $4,
       currency = $5,
       status = $6,
       risk_score = $7,
       payment_method = $8,
       payment_method_id = $9::uuid,
       ip_address = $10::inet,
       country = $11,
       device_id = $12,
       device_ref_id = $13::uuid,
       velocity_1h = $14,
       velocity_24h = $15,
       chargeback_probability = $16,
       occurred_at = now(),
       updated_at = now()
     where id = $1::uuid and user_id = $17
     returning ${TRANSACTION_SELECT}`,
    [
      id,
      normalizedPayload.merchant_name,
      normalizedPayload.merchant_category,
      normalizedPayload.amount,
      normalizedPayload.currency,
      evaluation.status,
      evaluation.score,
      normalizedPayload.payment_method,
      context.paymentMethod?.id ?? null,
      normalizedPayload.ip_address || null,
      normalizedPayload.country,
      normalizedPayload.device_id,
      context.device.id,
      context.velocity.velocity_1h,
      context.velocity.velocity_24h,
      evaluation.chargeback_probability,
      LOCAL_DEMO_USER_ID,
    ],
  );
  const transaction = rows[0] ?? null;
  if (!transaction) return null;

  await writeRiskArtifacts({
    transaction,
    payload: normalizedPayload,
    context,
    evaluation,
    reasonCodes,
  });

  return transaction;
}

export async function deleteLocalTransaction(id: string) {
  await query(`delete from transactions where id = $1::uuid and user_id = $2`, [id, LOCAL_DEMO_USER_ID]);
  await refreshCustomerRiskProfile();
}

export async function createLocalCase(payload: Omit<FraudCase, "id" | "created_at" | "updated_at" | "user_id">) {
  const rows = await query<FraudCase>(
    `insert into fraud_cases
      (user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, created_at, updated_at, user_id, transaction_id, title, reason,
               status, severity, assigned_to, resolution_notes`,
    [
      LOCAL_DEMO_USER_ID,
      payload.transaction_id,
      payload.title,
      payload.reason,
      payload.status,
      payload.severity,
      payload.assigned_to,
      payload.resolution_notes,
    ],
  );
  return rows[0];
}

export async function updateLocalCase(id: string, payload: Partial<Omit<FraudCase, "id" | "created_at" | "updated_at" | "user_id">>) {
  const rows = await query<FraudCase>(
    `update fraud_cases
     set transaction_id = coalesce($2, transaction_id),
         title = coalesce($3, title),
         reason = coalesce($4, reason),
         status = coalesce($5, status),
         severity = coalesce($6, severity),
         assigned_to = $7,
         resolution_notes = $8,
         updated_at = now()
     where id = $1::uuid and user_id = $9
     returning id, created_at, updated_at, user_id, transaction_id, title, reason,
               status, severity, assigned_to, resolution_notes`,
    [
      id,
      payload.transaction_id ?? null,
      payload.title ?? null,
      payload.reason ?? null,
      payload.status ?? null,
      payload.severity ?? null,
      payload.assigned_to ?? null,
      payload.resolution_notes ?? null,
      LOCAL_DEMO_USER_ID,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteLocalCase(id: string) {
  await query(`delete from fraud_cases where id = $1::uuid and user_id = $2`, [id, LOCAL_DEMO_USER_ID]);
}

export type TransactionDetail = Transaction & {
  breakdown: Record<string, number> | null;
  reason_codes: string[] | null;
  model_version: string | null;
  explanation: Record<string, unknown> | null;
};

export async function getLocalTransactionDetail(id: string): Promise<TransactionDetail | null> {
  const rows = await query<TransactionDetail>(
    `select
      t.id,
      t.created_at,
      t.updated_at,
      t.user_id,
      t.merchant_name,
      t.amount::float8 as amount,
      t.status,
      t.risk_score,
      t.payment_method,
      coalesce(host(t.ip_address), '') as ip_address,
      trim(t.country)::text as country,
      t.device_id,
      rs.model_version,
      rs.reason_codes,
      rs.explanation->>'feature_breakdown' as breakdown_raw,
      rs.explanation
     from transactions t
     left join risk_scores rs on rs.transaction_id = t.id
     where t.id = $1::uuid and t.user_id = $2
     limit 1`,
    [id, LOCAL_DEMO_USER_ID],
  );

  const row = rows[0];
  if (!row) return null;

  const raw = (row as unknown as { breakdown_raw?: string }).breakdown_raw;
  const breakdown = raw ? (JSON.parse(raw) as Record<string, number>) : null;

  return { ...row, breakdown };
}
