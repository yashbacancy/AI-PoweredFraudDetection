type DecisionStatus = "approved" | "review" | "blocked";
type Channel = "web" | "mobile_app" | "api" | "pos" | "call_center";
type DeviceRiskLevel = "low" | "medium" | "high";
type PaymentMethodStatus = "active" | "blocked" | "expired";
type IdentityStatus = "pending" | "verified" | "failed" | "manual_review";

type BaseInput = {
  amount: number;
  country: string;
  payment_method: string;
  device_id: string;
};

export type RiskSignalInput = BaseInput & {
  velocity_1h?: number;
  velocity_24h?: number;
  historical_avg_amount?: number;
  device_risk_level?: DeviceRiskLevel | null;
  payment_method_status?: PaymentMethodStatus | null;
  account_takeover_events?: number;
  behavior_anomaly?: number;
  geo_mismatch?: boolean;
  identity_status?: IdentityStatus | null;
  customer_risk_score?: number;
  chargeback_ratio?: number;
  watchlist_hit?: boolean;
  allowlist_hit?: boolean;
  rule_weight_boost?: number;
  channel?: Channel;
  model_review_threshold?: number;
  model_block_threshold?: number;
};

export type RiskEvaluation = {
  score: number;
  status: DecisionStatus;
  chargeback_probability: number;
  severity: "low" | "medium" | "high";
  reason_codes: string[];
  breakdown: Record<string, number>;
};

function addSignal(
  state: { score: number; reasons: string[]; breakdown: Record<string, number> },
  code: string,
  points: number,
  bucket: string,
) {
  if (points === 0) return;
  state.score += points;
  state.reasons.push(code);
  state.breakdown[bucket] = (state.breakdown[bucket] ?? 0) + points;
}

export function scoreToStatus(score: number, reviewThreshold = 40, blockThreshold = 70): DecisionStatus {
  const review = Math.min(98, Math.max(1, Math.round(reviewThreshold)));
  const block = Math.min(99, Math.max(review + 1, Math.round(blockThreshold)));
  if (score >= block) return "blocked";
  if (score >= review) return "review";
  return "approved";
}

export function evaluateRiskSignals(input: RiskSignalInput): RiskEvaluation {
  const state: { score: number; reasons: string[]; breakdown: Record<string, number> } = {
    score: 6,
    reasons: [],
    breakdown: { base: 6 },
  };

  const riskyCountries = new Set(["NG", "RU", "UA", "PH", "VN", "ID"]);
  const channelWeight: Record<Channel, number> = {
    web: 0,
    mobile_app: 2,
    api: 6,
    pos: 4,
    call_center: 3,
  };

  const country = input.country.toUpperCase();
  const paymentMethod = input.payment_method.toLowerCase();
  const deviceId = input.device_id.toLowerCase();

  if (input.watchlist_hit) addSignal(state, "watchlist_blacklist", 45, "watchlist");

  if (input.allowlist_hit) {
    state.score -= 18;
    state.reasons.push("trusted_allowlist");
    state.breakdown.allowlist = (state.breakdown.allowlist ?? 0) - 18;
  }

  if (input.amount > 2500) addSignal(state, "high_amount", 28, "amount");
  else if (input.amount > 1200) addSignal(state, "elevated_amount", 14, "amount");

  if ((input.historical_avg_amount ?? 0) > 0) {
    const ratio = input.amount / (input.historical_avg_amount ?? 1);
    if (ratio >= 3.2) addSignal(state, "historical_spike", 20, "historical");
    else if (ratio >= 2) addSignal(state, "historical_deviation", 10, "historical");
  }

  if ((input.velocity_1h ?? 0) >= 5) addSignal(state, "velocity_1h_spike", 18, "velocity");
  else if ((input.velocity_1h ?? 0) >= 3) addSignal(state, "velocity_1h_elevated", 10, "velocity");
  if ((input.velocity_24h ?? 0) >= 12) addSignal(state, "velocity_24h_spike", 12, "velocity");

  if (riskyCountries.has(country)) addSignal(state, "geo_risk_country", 16, "geolocation");
  if (input.geo_mismatch) addSignal(state, "geo_mismatch", 12, "geolocation");

  if (input.device_risk_level === "high") addSignal(state, "device_high_risk", 18, "device");
  else if (input.device_risk_level === "medium") addSignal(state, "device_medium_risk", 8, "device");

  if (deviceId.includes("new") || deviceId.includes("unknown")) {
    addSignal(state, "new_or_unknown_device", 10, "device");
  }

  if (paymentMethod === "crypto" || paymentMethod === "virtual_card") {
    addSignal(state, "payment_instrument_risky", 14, "payment");
  }

  if (input.payment_method_status === "blocked") addSignal(state, "payment_method_blocked", 26, "payment");
  else if (input.payment_method_status === "expired") addSignal(state, "payment_method_expired", 8, "payment");

  const takeoverEvents = input.account_takeover_events ?? 0;
  if (takeoverEvents >= 3) addSignal(state, "account_takeover_pattern", 22, "account_takeover");
  else if (takeoverEvents > 0) addSignal(state, "account_takeover_signal", 10, "account_takeover");

  const behaviorAnomaly = input.behavior_anomaly ?? 0;
  if (behaviorAnomaly >= 80) addSignal(state, "behavioral_biometrics_anomaly", 20, "behavior");
  else if (behaviorAnomaly >= 60) addSignal(state, "behavioral_biometrics_drift", 12, "behavior");
  else if (behaviorAnomaly >= 35) addSignal(state, "behavioral_biometrics_notice", 6, "behavior");

  if (input.identity_status === "failed" || input.identity_status === "manual_review") {
    addSignal(state, "identity_verification_failed", 22, "identity");
  } else if (input.identity_status === "pending") {
    addSignal(state, "identity_verification_pending", 8, "identity");
  } else if (input.identity_status === "verified") {
    state.score -= 6;
    state.reasons.push("identity_verified");
    state.breakdown.identity = (state.breakdown.identity ?? 0) - 6;
  }

  const customerRisk = input.customer_risk_score ?? 0;
  if (customerRisk >= 70) addSignal(state, "customer_high_risk_profile", 14, "customer");
  else if (customerRisk >= 40) addSignal(state, "customer_medium_risk_profile", 7, "customer");

  const chargebackRatio = input.chargeback_ratio ?? 0;
  if (chargebackRatio >= 0.25) addSignal(state, "chargeback_history_high", 10, "chargeback");
  else if (chargebackRatio >= 0.1) addSignal(state, "chargeback_history_medium", 5, "chargeback");

  const channel = input.channel ?? "web";
  if (channelWeight[channel] > 0) {
    addSignal(state, `channel_${channel}`, channelWeight[channel], "channel");
  }

  if ((input.rule_weight_boost ?? 0) > 0) {
    addSignal(state, "rules_engine_boost", Math.round(input.rule_weight_boost ?? 0), "rules_engine");
  }

  const score = Math.min(99, Math.max(1, Math.round(state.score)));
  const status = scoreToStatus(score, input.model_review_threshold, input.model_block_threshold);

  const chargeback_probability = Math.min(
    99,
    Math.max(
      0,
      Number(
        (
          score * 0.7 +
          (input.velocity_24h ?? 0) * 1.4 +
          (input.chargeback_ratio ?? 0) * 25 +
          (input.behavior_anomaly ?? 0) * 0.15
        ).toFixed(2),
      ),
    ),
  );

  return {
    score,
    status,
    chargeback_probability,
    severity: score >= 75 ? "high" : score >= 45 ? "medium" : "low",
    reason_codes: [...new Set(state.reasons)],
    breakdown: state.breakdown,
  };
}

export function calculateRiskScore(input: BaseInput) {
  return evaluateRiskSignals(input).score;
}
