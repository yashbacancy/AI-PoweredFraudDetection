import { createClient } from "@/lib/supabase/server";
import type {
  AlertRow,
  ApiIntegrationRow,
  RiskRuleRow,
  WatchlistRow,
} from "@/lib/local/management-repository";

function row<T>(data: unknown): T | undefined {
  if (data === null || data === undefined) return undefined;
  return data as T;
}

// ── Risk Rules ───────────────────────────────────────────────────────────────

export async function getSupabaseRiskRules(limit = 40): Promise<RiskRuleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("risk_rules" as never)
    .select("id, name, description, rule_type, operator, threshold, weight, is_active, updated_at")
    .order("is_active" as never, { ascending: false })
    .order("updated_at" as never, { ascending: false })
    .limit(limit);
  return ((data ?? []) as RiskRuleRow[]);
}

export async function createSupabaseRiskRule(payload: {
  name: string;
  description?: string | null;
  rule_type: string;
  operator: string;
  threshold?: number | null;
  weight: number;
  is_active: boolean;
}): Promise<RiskRuleRow | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("risk_rules" as never)
    .insert({ ...payload, user_id: user!.id } as never)
    .select("id, name, description, rule_type, operator, threshold, weight, is_active, updated_at")
    .single();
  return row<RiskRuleRow>(data);
}

export async function updateSupabaseRiskRule(
  id: string,
  payload: Partial<{
    name: string;
    description: string | null;
    rule_type: string;
    operator: string;
    threshold: number | null;
    weight: number;
    is_active: boolean;
  }>,
): Promise<RiskRuleRow | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("risk_rules" as never)
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, id)
    .select("id, name, description, rule_type, operator, threshold, weight, is_active, updated_at")
    .single();
  return row<RiskRuleRow>(data);
}

export async function deleteSupabaseRiskRule(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("risk_rules" as never).delete().eq("id" as never, id);
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export async function getSupabaseAlerts(limit = 50): Promise<AlertRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alerts" as never)
    .select("id, channel, severity, status, title, message, created_at, updated_at, transaction_id, case_id, sent_at, acknowledged_at")
    .order("created_at" as never, { ascending: false })
    .limit(limit);
  return (data ?? []) as AlertRow[];
}

export async function createSupabaseAlert(payload: {
  channel: AlertRow["channel"];
  severity: AlertRow["severity"];
  status: AlertRow["status"];
  title: string;
  message: string;
  transaction_id?: string | null;
  case_id?: string | null;
}): Promise<AlertRow | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sentAt = ["sent", "acknowledged", "closed"].includes(payload.status) ? new Date().toISOString() : null;
  const acknowledgedAt = ["acknowledged", "closed"].includes(payload.status) ? new Date().toISOString() : null;
  const { data } = await supabase
    .from("alerts" as never)
    .insert({ ...payload, user_id: user!.id, sent_at: sentAt, acknowledged_at: acknowledgedAt } as never)
    .select("id, channel, severity, status, title, message, created_at, updated_at, transaction_id, case_id, sent_at, acknowledged_at")
    .single();
  return row<AlertRow>(data);
}

export async function updateSupabaseAlert(
  id: string,
  payload: Partial<Pick<AlertRow, "channel" | "severity" | "status" | "title" | "message" | "transaction_id" | "case_id">>,
): Promise<AlertRow | undefined> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
  if (payload.status && ["sent", "acknowledged", "closed"].includes(payload.status)) {
    updates.sent_at = new Date().toISOString();
  }
  if (payload.status && ["acknowledged", "closed"].includes(payload.status)) {
    updates.acknowledged_at = new Date().toISOString();
  }
  const { data } = await supabase
    .from("alerts" as never)
    .update(updates as never)
    .eq("id" as never, id)
    .select("id, channel, severity, status, title, message, created_at, updated_at, transaction_id, case_id, sent_at, acknowledged_at")
    .single();
  return row<AlertRow>(data);
}

export async function deleteSupabaseAlert(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("alerts" as never).delete().eq("id" as never, id);
}

// ── API Integrations ─────────────────────────────────────────────────────────

export async function getSupabaseApiIntegrations(limit = 20): Promise<ApiIntegrationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_integrations" as never)
    .select("id, name, integration_type, endpoint, status, secret_ref, last_delivery_at, last_error, updated_at")
    .order("updated_at" as never, { ascending: false })
    .limit(limit);
  return (data ?? []) as ApiIntegrationRow[];
}

export async function createSupabaseApiIntegration(payload: {
  name: string;
  integration_type: ApiIntegrationRow["integration_type"];
  endpoint?: string | null;
  status: ApiIntegrationRow["status"];
  secret_ref?: string | null;
  last_error?: string | null;
}): Promise<ApiIntegrationRow | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("api_integrations" as never)
    .insert({ ...payload, user_id: user!.id } as never)
    .select("id, name, integration_type, endpoint, status, secret_ref, last_delivery_at, last_error, updated_at")
    .single();
  return row<ApiIntegrationRow>(data);
}

export async function updateSupabaseApiIntegration(
  id: string,
  payload: Partial<Pick<ApiIntegrationRow, "name" | "integration_type" | "endpoint" | "status" | "secret_ref" | "last_error" | "last_delivery_at">>,
): Promise<ApiIntegrationRow | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_integrations" as never)
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, id)
    .select("id, name, integration_type, endpoint, status, secret_ref, last_delivery_at, last_error, updated_at")
    .single();
  return row<ApiIntegrationRow>(data);
}

export async function deleteSupabaseApiIntegration(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("api_integrations" as never).delete().eq("id" as never, id);
}

// ── Watchlists ───────────────────────────────────────────────────────────────

export async function getSupabaseWatchlist(limit = 50): Promise<WatchlistRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_lists" as never)
    .select("id, entity_type, entity_value, list_type, reason, is_active, expires_at, updated_at")
    .order("is_active" as never, { ascending: false })
    .order("updated_at" as never, { ascending: false })
    .limit(limit);
  return (data ?? []) as WatchlistRow[];
}

export async function createSupabaseWatchlistEntry(payload: {
  entity_type: string;
  entity_value: string;
  list_type: "whitelist" | "blacklist";
  reason?: string | null;
  is_active: boolean;
  expires_at?: string | null;
}): Promise<WatchlistRow | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("entity_lists" as never)
    .insert({ ...payload, user_id: user!.id } as never)
    .select("id, entity_type, entity_value, list_type, reason, is_active, expires_at, updated_at")
    .single();
  return row<WatchlistRow>(data);
}

export async function updateSupabaseWatchlistEntry(
  id: string,
  payload: Partial<Pick<WatchlistRow, "entity_type" | "entity_value" | "list_type" | "reason" | "is_active" | "expires_at">>,
): Promise<WatchlistRow | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_lists" as never)
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, id)
    .select("id, entity_type, entity_value, list_type, reason, is_active, expires_at, updated_at")
    .single();
  return row<WatchlistRow>(data);
}

export async function deleteSupabaseWatchlistEntry(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("entity_lists" as never).delete().eq("id" as never, id);
}
