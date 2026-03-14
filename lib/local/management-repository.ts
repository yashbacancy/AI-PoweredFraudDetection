import { query } from "@/lib/local/db";
import { LOCAL_DEMO_USER_ID } from "@/lib/mode";

export type FeatureMetric = {
  feature: string;
  count: number;
};

export type RiskRuleRow = {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  operator: string;
  threshold: number | null;
  weight: number;
  is_active: boolean;
  updated_at: string;
};

export type ModelRegistryRow = {
  id: string;
  model_key: string;
  version: string;
  status: "active" | "shadow" | "disabled";
  rollout_percent: number;
  review_threshold: number;
  block_threshold: number;
  updated_at: string;
};

export type WatchlistRow = {
  id: string;
  entity_type: string;
  entity_value: string;
  list_type: "whitelist" | "blacklist";
  reason: string | null;
  is_active: boolean;
  expires_at: string | null;
  updated_at: string;
};

export type SecurityEventRow = {
  id: string;
  event_type: string;
  channel: string;
  ip_address: string;
  country: string | null;
  device_id: string | null;
  risk_hint: number;
  occurred_at: string;
};

export type AlertRow = {
  id: string;
  channel: "in_app" | "email" | "webhook" | "slack";
  severity: "low" | "medium" | "high";
  status: "new" | "sent" | "acknowledged" | "closed";
  title: string;
  message: string;
  created_at: string;
  updated_at: string;
  transaction_id: string | null;
  case_id: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
};

export type ApiIntegrationRow = {
  id: string;
  name: string;
  integration_type: "webhook" | "email" | "slack" | "siem";
  endpoint: string | null;
  status: "active" | "disabled" | "error";
  secret_ref: string | null;
  last_delivery_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type ComplianceReportRow = {
  id: string;
  report_type: "pci_dss" | "gdpr" | "risk_audit" | "chargeback_summary";
  period_start: string;
  period_end: string;
  status: "draft" | "generated" | "submitted";
  generated_at: string | null;
  updated_at: string;
};

export type ChargebackStatRow = {
  total_chargebacks: number;
  disputed_chargebacks: number;
  won_chargebacks: number;
  lost_chargebacks: number;
  recovered_amount: number;
};

export type GraphEdgeRow = {
  id: string;
  source_type: string;
  source_value: string;
  target_type: string;
  target_value: string;
  signal: string;
  weight: number;
  created_at: string;
};

export type GraphSignalMetricRow = {
  signal: string;
  edge_count: number;
};

export type CustomerRiskProfileRow = {
  user_id: string;
  risk_score: number;
  risk_tier: "low" | "medium" | "high";
  total_transactions: number;
  blocked_transactions: number;
  review_transactions: number;
  chargeback_count: number;
  avg_chargeback_probability: number;
  last_transaction_at: string | null;
  updated_at: string;
};

export type IdentityVerificationRow = {
  id: string;
  provider: string;
  document_type: string | null;
  document_country: string | null;
  status: "pending" | "verified" | "failed" | "manual_review";
  confidence_score: number;
  verified_at: string | null;
  updated_at: string;
};

export type ChannelEventRow = {
  id: string;
  channel: string;
  event_type: string;
  transaction_id: string | null;
  occurred_at: string;
};

export async function getLocalFeatureMetrics() {
  return query<FeatureMetric>(
    `select 'Transactions' as feature, count(*)::int as count from transactions where user_id = $1
     union all
     select 'Open Cases', count(*)::int from fraud_cases where user_id = $1 and status <> 'resolved'
     union all
     select 'Active Rules', count(*)::int from risk_rules where user_id = $1 and is_active = true
     union all
     select 'Active Blacklist', count(*)::int from entity_lists where user_id = $1 and list_type = 'blacklist' and is_active = true
     union all
     select 'Active Models', count(*)::int from model_registry where user_id = $1 and status in ('active', 'shadow')
     union all
     select 'Pending Alerts', count(*)::int from alerts where user_id = $1 and status in ('new', 'sent', 'acknowledged')
     union all
     select 'Compliance Reports', count(*)::int from compliance_reports where user_id = $1
     union all
     select 'Graph Edges', count(*)::int from graph_edges where user_id = $1`,
    [LOCAL_DEMO_USER_ID],
  );
}

export async function getLocalRiskRules(limit = 40) {
  return query<RiskRuleRow>(
    `select
      id::text as id,
      name,
      description,
      rule_type,
      operator,
      threshold::float8 as threshold,
      weight::int as weight,
      is_active,
      updated_at::text as updated_at
     from risk_rules
     where user_id = $1
     order by is_active desc, updated_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalModelRegistry(limit = 20) {
  return query<ModelRegistryRow>(
    `select
      id::text as id,
      model_key,
      version,
      status,
      rollout_percent::int as rollout_percent,
      review_threshold::int as review_threshold,
      block_threshold::int as block_threshold,
      updated_at::text as updated_at
     from model_registry
     where user_id = $1
     order by updated_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalWatchlist(limit = 50) {
  return query<WatchlistRow>(
    `select
      id::text as id,
      entity_type,
      entity_value,
      list_type,
      reason,
      is_active,
      expires_at::text as expires_at,
      updated_at::text as updated_at
     from entity_lists
     where user_id = $1
     order by is_active desc, updated_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalSecurityEvents(limit = 40) {
  return query<SecurityEventRow>(
    `select
      id::text as id,
      event_type,
      channel,
      coalesce(host(ip_address), '') as ip_address,
      trim(country)::text as country,
      device_id,
      risk_hint::int as risk_hint,
      occurred_at::text as occurred_at
     from account_security_events
     where user_id = $1
     order by occurred_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalAlerts(limit = 50) {
  return query<AlertRow>(
    `select
      id::text as id,
      channel,
      severity,
      status,
      title,
      message,
      created_at::text as created_at,
      updated_at::text as updated_at,
      transaction_id::text as transaction_id,
      case_id::text as case_id,
      sent_at::text as sent_at,
      acknowledged_at::text as acknowledged_at
     from alerts
     where user_id = $1
     order by created_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalApiIntegrations(limit = 20) {
  return query<ApiIntegrationRow>(
    `select
      id::text as id,
      name,
      integration_type,
      endpoint,
      status,
      secret_ref,
      last_delivery_at::text as last_delivery_at,
      last_error,
      updated_at::text as updated_at
     from api_integrations
     where user_id = $1
     order by updated_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalComplianceReports(limit = 30) {
  return query<ComplianceReportRow>(
    `select
      id::text as id,
      report_type,
      period_start::text as period_start,
      period_end::text as period_end,
      status,
      generated_at::text as generated_at,
      updated_at::text as updated_at
     from compliance_reports
     where user_id = $1
     order by period_end desc, updated_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalChargebackStats() {
  const rows = await query<ChargebackStatRow>(
    `select
      count(*)::int as total_chargebacks,
      count(*) filter (where status = 'disputed')::int as disputed_chargebacks,
      count(*) filter (where status = 'won')::int as won_chargebacks,
      count(*) filter (where status = 'lost')::int as lost_chargebacks,
      coalesce(sum(case when status = 'won' then amount else 0 end), 0)::float8 as recovered_amount
     from chargebacks
     where user_id = $1`,
    [LOCAL_DEMO_USER_ID],
  );
  return (
    rows[0] ?? {
      total_chargebacks: 0,
      disputed_chargebacks: 0,
      won_chargebacks: 0,
      lost_chargebacks: 0,
      recovered_amount: 0,
    }
  );
}

export async function getLocalGraphEdges(limit = 60) {
  return query<GraphEdgeRow>(
    `select
      id::text as id,
      source_type,
      source_value,
      target_type,
      target_value,
      signal,
      weight::float8 as weight,
      created_at::text as created_at
     from graph_edges
     where user_id = $1
     order by created_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalGraphSignalMetrics(limit = 12) {
  return query<GraphSignalMetricRow>(
    `select signal, count(*)::int as edge_count
     from graph_edges
     where user_id = $1
     group by signal
     order by edge_count desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalCustomerRiskProfile() {
  const rows = await query<CustomerRiskProfileRow>(
    `select
      user_id,
      risk_score::int as risk_score,
      risk_tier,
      total_transactions::int as total_transactions,
      blocked_transactions::int as blocked_transactions,
      review_transactions::int as review_transactions,
      chargeback_count::int as chargeback_count,
      avg_chargeback_probability::float8 as avg_chargeback_probability,
      last_transaction_at::text as last_transaction_at,
      updated_at::text as updated_at
     from customer_risk_profiles
     where user_id = $1
     limit 1`,
    [LOCAL_DEMO_USER_ID],
  );
  return rows[0] ?? null;
}

export async function getLocalIdentityVerifications(limit = 10) {
  return query<IdentityVerificationRow>(
    `select
      id::text as id,
      provider,
      document_type,
      trim(document_country)::text as document_country,
      status,
      confidence_score::float8 as confidence_score,
      verified_at::text as verified_at,
      updated_at::text as updated_at
     from identity_verifications
     where user_id = $1
     order by updated_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

export async function getLocalChannelEvents(limit = 40) {
  return query<ChannelEventRow>(
    `select
      id::text as id,
      channel,
      event_type,
      transaction_id::text as transaction_id,
      occurred_at::text as occurred_at
     from channel_events
     where user_id = $1
     order by occurred_at desc
     limit $2`,
    [LOCAL_DEMO_USER_ID, limit],
  );
}

type RiskRuleWritePayload = {
  name: string;
  description?: string | null;
  rule_type: string;
  operator: string;
  threshold?: number | null;
  weight: number;
  is_active: boolean;
};

export async function createLocalRiskRule(payload: RiskRuleWritePayload) {
  const rows = await query<RiskRuleRow>(
    `insert into risk_rules
      (user_id, name, description, rule_type, operator, threshold, weight, is_active)
     values
      ($1, $2, $3, $4, $5, $6, $7, $8)
     returning
      id::text as id,
      name,
      description,
      rule_type,
      operator,
      threshold::float8 as threshold,
      weight::int as weight,
      is_active,
      updated_at::text as updated_at`,
    [
      LOCAL_DEMO_USER_ID,
      payload.name,
      payload.description ?? null,
      payload.rule_type,
      payload.operator,
      payload.threshold ?? null,
      payload.weight,
      payload.is_active,
    ],
  );
  return rows[0];
}

export async function updateLocalRiskRule(
  id: string,
  payload: Partial<RiskRuleWritePayload>,
) {
  const rows = await query<RiskRuleRow>(
    `update risk_rules
     set
      name = coalesce($2, name),
      description = $3,
      rule_type = coalesce($4, rule_type),
      operator = coalesce($5, operator),
      threshold = $6,
      weight = coalesce($7, weight),
      is_active = coalesce($8, is_active),
      updated_at = now()
     where id = $1::uuid and user_id = $9
     returning
      id::text as id,
      name,
      description,
      rule_type,
      operator,
      threshold::float8 as threshold,
      weight::int as weight,
      is_active,
      updated_at::text as updated_at`,
    [
      id,
      payload.name ?? null,
      payload.description ?? null,
      payload.rule_type ?? null,
      payload.operator ?? null,
      payload.threshold ?? null,
      payload.weight ?? null,
      payload.is_active ?? null,
      LOCAL_DEMO_USER_ID,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteLocalRiskRule(id: string) {
  await query(`delete from risk_rules where id = $1::uuid and user_id = $2`, [id, LOCAL_DEMO_USER_ID]);
}

type AlertWritePayload = {
  channel: "in_app" | "email" | "webhook" | "slack";
  severity: "low" | "medium" | "high";
  status: "new" | "sent" | "acknowledged" | "closed";
  title: string;
  message: string;
  transaction_id?: string | null;
  case_id?: string | null;
};

function shouldSetSentAt(status: AlertWritePayload["status"]) {
  return status === "sent" || status === "acknowledged" || status === "closed";
}

function shouldSetAcknowledgedAt(status: AlertWritePayload["status"]) {
  return status === "acknowledged" || status === "closed";
}

export async function createLocalAlert(payload: AlertWritePayload) {
  const rows = await query<AlertRow>(
    `insert into alerts
      (user_id, transaction_id, case_id, channel, severity, status, title, message, sent_at, acknowledged_at)
     values
      (
        $1,
        $2::uuid,
        $3::uuid,
        $4,
        $5,
        $6,
        $7,
        $8,
        case when $9::boolean then now() else null end,
        case when $10::boolean then now() else null end
      )
     returning
      id::text as id,
      channel,
      severity,
      status,
      title,
      message,
      created_at::text as created_at,
      updated_at::text as updated_at,
      transaction_id::text as transaction_id,
      case_id::text as case_id,
      sent_at::text as sent_at,
      acknowledged_at::text as acknowledged_at`,
    [
      LOCAL_DEMO_USER_ID,
      payload.transaction_id ?? null,
      payload.case_id ?? null,
      payload.channel,
      payload.severity,
      payload.status,
      payload.title,
      payload.message,
      shouldSetSentAt(payload.status),
      shouldSetAcknowledgedAt(payload.status),
    ],
  );
  return rows[0];
}

export async function updateLocalAlert(id: string, payload: Partial<AlertWritePayload>) {
  const rows = await query<AlertRow>(
    `update alerts
     set
      transaction_id = coalesce($2::uuid, transaction_id),
      case_id = coalesce($3::uuid, case_id),
      channel = coalesce($4, channel),
      severity = coalesce($5, severity),
      status = coalesce($6, status),
      title = coalesce($7, title),
      message = coalesce($8, message),
      sent_at = case
        when $9::boolean then coalesce(sent_at, now())
        else sent_at
      end,
      acknowledged_at = case
        when $10::boolean then coalesce(acknowledged_at, now())
        else acknowledged_at
      end,
      updated_at = now()
     where id = $1::uuid and user_id = $11
     returning
      id::text as id,
      channel,
      severity,
      status,
      title,
      message,
      created_at::text as created_at,
      updated_at::text as updated_at,
      transaction_id::text as transaction_id,
      case_id::text as case_id,
      sent_at::text as sent_at,
      acknowledged_at::text as acknowledged_at`,
    [
      id,
      payload.transaction_id ?? null,
      payload.case_id ?? null,
      payload.channel ?? null,
      payload.severity ?? null,
      payload.status ?? null,
      payload.title ?? null,
      payload.message ?? null,
      shouldSetSentAt(payload.status ?? "new"),
      shouldSetAcknowledgedAt(payload.status ?? "new"),
      LOCAL_DEMO_USER_ID,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteLocalAlert(id: string) {
  await query(`delete from alerts where id = $1::uuid and user_id = $2`, [id, LOCAL_DEMO_USER_ID]);
}

type ApiIntegrationWritePayload = {
  name: string;
  integration_type: "webhook" | "email" | "slack" | "siem";
  endpoint?: string | null;
  status: "active" | "disabled" | "error";
  secret_ref?: string | null;
  last_error?: string | null;
};

export async function createLocalApiIntegration(payload: ApiIntegrationWritePayload) {
  const rows = await query<ApiIntegrationRow>(
    `insert into api_integrations
      (user_id, name, integration_type, endpoint, status, secret_ref, last_error)
     values
      ($1, $2, $3, $4, $5, $6, $7)
     returning
      id::text as id,
      name,
      integration_type,
      endpoint,
      status,
      secret_ref,
      last_delivery_at::text as last_delivery_at,
      last_error,
      updated_at::text as updated_at`,
    [
      LOCAL_DEMO_USER_ID,
      payload.name,
      payload.integration_type,
      payload.endpoint ?? null,
      payload.status,
      payload.secret_ref ?? null,
      payload.last_error ?? null,
    ],
  );
  return rows[0];
}

export async function updateLocalApiIntegration(id: string, payload: Partial<ApiIntegrationWritePayload>) {
  const rows = await query<ApiIntegrationRow>(
    `update api_integrations
     set
      name = coalesce($2, name),
      integration_type = coalesce($3, integration_type),
      endpoint = $4,
      status = coalesce($5, status),
      secret_ref = $6,
      last_error = $7,
      updated_at = now()
     where id = $1::uuid and user_id = $8
     returning
      id::text as id,
      name,
      integration_type,
      endpoint,
      status,
      secret_ref,
      last_delivery_at::text as last_delivery_at,
      last_error,
      updated_at::text as updated_at`,
    [
      id,
      payload.name ?? null,
      payload.integration_type ?? null,
      payload.endpoint ?? null,
      payload.status ?? null,
      payload.secret_ref ?? null,
      payload.last_error ?? null,
      LOCAL_DEMO_USER_ID,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteLocalApiIntegration(id: string) {
  await query(`delete from api_integrations where id = $1::uuid and user_id = $2`, [id, LOCAL_DEMO_USER_ID]);
}

type WatchlistWritePayload = {
  entity_type: string;
  entity_value: string;
  list_type: "whitelist" | "blacklist";
  reason?: string | null;
  is_active: boolean;
  expires_at?: string | null;
};

export async function createLocalWatchlistEntry(payload: WatchlistWritePayload) {
  const rows = await query<WatchlistRow>(
    `insert into entity_lists
      (user_id, entity_type, entity_value, list_type, reason, is_active, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7::timestamptz)
     returning
      id::text as id,
      entity_type,
      entity_value,
      list_type,
      reason,
      is_active,
      expires_at::text as expires_at,
      updated_at::text as updated_at`,
    [
      LOCAL_DEMO_USER_ID,
      payload.entity_type,
      payload.entity_value,
      payload.list_type,
      payload.reason ?? null,
      payload.is_active,
      payload.expires_at ?? null,
    ],
  );
  return rows[0];
}

export async function updateLocalWatchlistEntry(id: string, payload: Partial<WatchlistWritePayload>) {
  const rows = await query<WatchlistRow>(
    `update entity_lists
     set
      entity_type = coalesce($2, entity_type),
      entity_value = coalesce($3, entity_value),
      list_type = coalesce($4, list_type),
      reason = $5,
      is_active = coalesce($6, is_active),
      expires_at = $7::timestamptz,
      updated_at = now()
     where id = $1::uuid and user_id = $8
     returning
      id::text as id,
      entity_type,
      entity_value,
      list_type,
      reason,
      is_active,
      expires_at::text as expires_at,
      updated_at::text as updated_at`,
    [
      id,
      payload.entity_type ?? null,
      payload.entity_value ?? null,
      payload.list_type ?? null,
      payload.reason ?? null,
      payload.is_active ?? null,
      payload.expires_at ?? null,
      LOCAL_DEMO_USER_ID,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteLocalWatchlistEntry(id: string) {
  await query(`delete from entity_lists where id = $1::uuid and user_id = $2`, [id, LOCAL_DEMO_USER_ID]);
}
