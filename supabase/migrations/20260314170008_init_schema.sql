create extension if not exists "pgcrypto";

-- =========================
-- Core Tables
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  role text not null default 'analyst' check (role in ('analyst', 'manager', 'admin')),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  device_fingerprint text not null,
  device_type text not null check (device_type in ('desktop', 'mobile', 'tablet', 'server', 'other')),
  operating_system text,
  browser text,
  ip_address inet,
  last_country char(2),
  last_seen_at timestamptz,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  method_type text not null check (method_type in ('card', 'bank', 'wallet', 'virtual_card', 'crypto')),
  last4 char(4),
  bin char(6),
  country char(2),
  fingerprint text not null,
  status text not null default 'active' check (status in ('active', 'blocked', 'expired')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create table if not exists public.risk_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  rule_type text not null check (rule_type in ('amount', 'velocity_1h', 'velocity_24h', 'geo', 'device', 'payment_method')),
  operator text not null check (operator in ('gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'not_in')),
  threshold numeric(12, 2),
  weight integer not null default 10 check (weight between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_name text not null,
  merchant_category text,
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null default 'USD',
  status text not null check (status in ('approved', 'review', 'blocked')),
  risk_score integer not null check (risk_score between 1 and 99),
  payment_method text not null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  ip_address inet,
  country char(2) not null,
  device_id text not null,
  device_ref_id uuid references public.devices (id) on delete set null,
  velocity_1h integer not null default 0,
  velocity_24h integer not null default 0,
  chargeback_probability numeric(5, 2) not null default 0,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  model_version text not null,
  score integer not null check (score between 1 and 99),
  decision text not null check (decision in ('approved', 'review', 'blocked')),
  reason_codes text[] not null default '{}',
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id)
);

create table if not exists public.fraud_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  title text not null,
  reason text not null,
  status text not null check (status in ('open', 'investigating', 'resolved')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  assigned_to text,
  resolution_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  case_id uuid references public.fraud_cases (id) on delete set null,
  channel text not null check (channel in ('in_app', 'email', 'webhook', 'slack')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null default 'new' check (status in ('new', 'sent', 'acknowledged', 'closed')),
  title text not null,
  message text not null,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chargebacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  case_id uuid references public.fraud_cases (id) on delete set null,
  reason_code text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null default 'USD',
  status text not null check (status in ('received', 'disputed', 'won', 'lost')),
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.behavioral_biometrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  typing_cadence_ms integer,
  pointer_velocity numeric(8, 2),
  touch_pressure numeric(5, 2),
  scroll_speed numeric(8, 2),
  anomaly_score numeric(5, 2) not null default 0 check (anomaly_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('login_success', 'login_failed', 'password_reset', 'mfa_challenge', 'mfa_failed', 'mfa_success', 'profile_update')),
  channel text not null check (channel in ('web', 'mobile_app', 'api', 'call_center')),
  ip_address inet,
  country char(2),
  device_id text,
  risk_hint integer not null default 0 check (risk_hint between 0 and 100),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  document_type text,
  document_country char(2),
  status text not null check (status in ('pending', 'verified', 'failed', 'manual_review')),
  confidence_score numeric(5, 2) not null default 0 check (confidence_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, document_type)
);

create table if not exists public.entity_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('ip', 'device', 'payment_method', 'email', 'country', 'user')),
  entity_value text not null,
  list_type text not null check (list_type in ('whitelist', 'blacklist')),
  reason text,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_value, list_type)
);

create table if not exists public.model_registry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_key text not null,
  version text not null,
  status text not null default 'active' check (status in ('active', 'shadow', 'disabled')),
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  review_threshold integer not null default 40 check (review_threshold between 1 and 99),
  block_threshold integer not null default 70 check (block_threshold between 1 and 99),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, model_key, version)
);

create table if not exists public.graph_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  source_type text not null check (source_type in ('user', 'device', 'payment_method', 'ip', 'merchant')),
  source_value text not null,
  target_type text not null check (target_type in ('user', 'device', 'payment_method', 'ip', 'merchant')),
  target_value text not null,
  signal text not null,
  weight numeric(6, 2) not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.api_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  integration_type text not null check (integration_type in ('webhook', 'email', 'slack', 'siem')),
  endpoint text,
  status text not null default 'active' check (status in ('active', 'disabled', 'error')),
  secret_ref text,
  last_delivery_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.compliance_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_type text not null check (report_type in ('pci_dss', 'gdpr', 'risk_audit', 'chargeback_summary')),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'generated', 'submitted')),
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_type, period_start, period_end)
);

create table if not exists public.channel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  channel text not null check (channel in ('web', 'mobile_app', 'api', 'pos', 'call_center')),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_risk_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  risk_score integer not null default 1 check (risk_score between 1 and 99),
  risk_tier text not null default 'low' check (risk_tier in ('low', 'medium', 'high')),
  total_transactions integer not null default 0,
  blocked_transactions integer not null default 0,
  review_transactions integer not null default 0,
  chargeback_count integer not null default 0,
  avg_chargeback_probability numeric(5, 2) not null default 0,
  last_transaction_at timestamptz,
  signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- Updated At Trigger
-- =========================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_devices_updated_at on public.devices;
create trigger trg_devices_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_methods_updated_at on public.payment_methods;
create trigger trg_payment_methods_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists trg_risk_rules_updated_at on public.risk_rules;
create trigger trg_risk_rules_updated_at
before update on public.risk_rules
for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_risk_scores_updated_at on public.risk_scores;
create trigger trg_risk_scores_updated_at
before update on public.risk_scores
for each row execute function public.set_updated_at();

drop trigger if exists trg_fraud_cases_updated_at on public.fraud_cases;
create trigger trg_fraud_cases_updated_at
before update on public.fraud_cases
for each row execute function public.set_updated_at();

drop trigger if exists trg_alerts_updated_at on public.alerts;
create trigger trg_alerts_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

drop trigger if exists trg_chargebacks_updated_at on public.chargebacks;
create trigger trg_chargebacks_updated_at
before update on public.chargebacks
for each row execute function public.set_updated_at();

drop trigger if exists trg_identity_verifications_updated_at on public.identity_verifications;
create trigger trg_identity_verifications_updated_at
before update on public.identity_verifications
for each row execute function public.set_updated_at();

drop trigger if exists trg_entity_lists_updated_at on public.entity_lists;
create trigger trg_entity_lists_updated_at
before update on public.entity_lists
for each row execute function public.set_updated_at();

drop trigger if exists trg_model_registry_updated_at on public.model_registry;
create trigger trg_model_registry_updated_at
before update on public.model_registry
for each row execute function public.set_updated_at();

drop trigger if exists trg_api_integrations_updated_at on public.api_integrations;
create trigger trg_api_integrations_updated_at
before update on public.api_integrations
for each row execute function public.set_updated_at();

drop trigger if exists trg_compliance_reports_updated_at on public.compliance_reports;
create trigger trg_compliance_reports_updated_at
before update on public.compliance_reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_risk_profiles_updated_at on public.customer_risk_profiles;
create trigger trg_customer_risk_profiles_updated_at
before update on public.customer_risk_profiles
for each row execute function public.set_updated_at();

-- =========================
-- Indexes
-- =========================

create index if not exists idx_profiles_email on public.profiles (email);

create index if not exists idx_devices_user_last_seen on public.devices (user_id, last_seen_at desc);
create index if not exists idx_devices_user_risk on public.devices (user_id, risk_level);

create index if not exists idx_payment_methods_user_status on public.payment_methods (user_id, status);
create index if not exists idx_payment_methods_user_default on public.payment_methods (user_id, is_default);

create index if not exists idx_risk_rules_user_active on public.risk_rules (user_id, is_active);
create index if not exists idx_risk_rules_type on public.risk_rules (user_id, rule_type);

create index if not exists idx_transactions_user_created on public.transactions (user_id, created_at desc);
create index if not exists idx_transactions_user_status on public.transactions (user_id, status);
create index if not exists idx_transactions_user_country on public.transactions (user_id, country);
create index if not exists idx_transactions_user_merchant on public.transactions (user_id, merchant_name);
create index if not exists idx_transactions_device_ref on public.transactions (device_ref_id);
create index if not exists idx_transactions_payment_method_ref on public.transactions (payment_method_id);

create index if not exists idx_risk_scores_user_created on public.risk_scores (user_id, created_at desc);

create index if not exists idx_fraud_cases_user_status on public.fraud_cases (user_id, status, updated_at desc);
create index if not exists idx_fraud_cases_transaction on public.fraud_cases (transaction_id);

create index if not exists idx_alerts_user_status on public.alerts (user_id, status, created_at desc);
create index if not exists idx_alerts_case on public.alerts (case_id);
create index if not exists idx_alerts_transaction on public.alerts (transaction_id);

create index if not exists idx_chargebacks_user_reported on public.chargebacks (user_id, reported_at desc);
create index if not exists idx_chargebacks_transaction on public.chargebacks (transaction_id);

create index if not exists idx_behavioral_biometrics_user_created on public.behavioral_biometrics (user_id, created_at desc);
create index if not exists idx_behavioral_biometrics_transaction on public.behavioral_biometrics (transaction_id);

create index if not exists idx_account_security_events_user_occurred on public.account_security_events (user_id, occurred_at desc);
create index if not exists idx_account_security_events_type on public.account_security_events (user_id, event_type);

create index if not exists idx_identity_verifications_user_status on public.identity_verifications (user_id, status, updated_at desc);
create index if not exists idx_entity_lists_user_type on public.entity_lists (user_id, list_type, entity_type);

create index if not exists idx_model_registry_user_status on public.model_registry (user_id, status, updated_at desc);

create index if not exists idx_graph_edges_user_created on public.graph_edges (user_id, created_at desc);
create index if not exists idx_graph_edges_source on public.graph_edges (source_type, source_value);

create index if not exists idx_api_integrations_user_status on public.api_integrations (user_id, status);
create index if not exists idx_compliance_reports_user_period on public.compliance_reports (user_id, period_start desc);

create index if not exists idx_channel_events_user_occurred on public.channel_events (user_id, occurred_at desc);
create index if not exists idx_channel_events_transaction on public.channel_events (transaction_id);

create index if not exists idx_customer_risk_profiles_tier on public.customer_risk_profiles (risk_tier);

-- =========================
-- RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.payment_methods enable row level security;
alter table public.risk_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.risk_scores enable row level security;
alter table public.fraud_cases enable row level security;
alter table public.alerts enable row level security;
alter table public.chargebacks enable row level security;
alter table public.behavioral_biometrics enable row level security;
alter table public.account_security_events enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.entity_lists enable row level security;
alter table public.model_registry enable row level security;
alter table public.graph_edges enable row level security;
alter table public.api_integrations enable row level security;
alter table public.compliance_reports enable row level security;
alter table public.channel_events enable row level security;
alter table public.customer_risk_profiles enable row level security;

-- profiles
revoke all on public.profiles from anon, authenticated;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete
  on public.profiles for delete
  using (auth.uid() = id);

-- owner-only tables
revoke all on public.devices from anon, authenticated;
revoke all on public.payment_methods from anon, authenticated;
revoke all on public.risk_rules from anon, authenticated;
revoke all on public.transactions from anon, authenticated;
revoke all on public.risk_scores from anon, authenticated;
revoke all on public.fraud_cases from anon, authenticated;
revoke all on public.alerts from anon, authenticated;
revoke all on public.chargebacks from anon, authenticated;
revoke all on public.behavioral_biometrics from anon, authenticated;
revoke all on public.account_security_events from anon, authenticated;
revoke all on public.identity_verifications from anon, authenticated;
revoke all on public.entity_lists from anon, authenticated;
revoke all on public.model_registry from anon, authenticated;
revoke all on public.graph_edges from anon, authenticated;
revoke all on public.api_integrations from anon, authenticated;
revoke all on public.compliance_reports from anon, authenticated;
revoke all on public.channel_events from anon, authenticated;
revoke all on public.customer_risk_profiles from anon, authenticated;

drop policy if exists devices_owner_all on public.devices;
create policy devices_owner_all
  on public.devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists payment_methods_owner_all on public.payment_methods;
create policy payment_methods_owner_all
  on public.payment_methods for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists risk_rules_owner_all on public.risk_rules;
create policy risk_rules_owner_all
  on public.risk_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists transactions_owner_all on public.transactions;
create policy transactions_owner_all
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists risk_scores_owner_all on public.risk_scores;
create policy risk_scores_owner_all
  on public.risk_scores for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists fraud_cases_owner_all on public.fraud_cases;
create policy fraud_cases_owner_all
  on public.fraud_cases for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists alerts_owner_all on public.alerts;
create policy alerts_owner_all
  on public.alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists chargebacks_owner_all on public.chargebacks;
create policy chargebacks_owner_all
  on public.chargebacks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists behavioral_biometrics_owner_all on public.behavioral_biometrics;
create policy behavioral_biometrics_owner_all
  on public.behavioral_biometrics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists account_security_events_owner_all on public.account_security_events;
create policy account_security_events_owner_all
  on public.account_security_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists identity_verifications_owner_all on public.identity_verifications;
create policy identity_verifications_owner_all
  on public.identity_verifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists entity_lists_owner_all on public.entity_lists;
create policy entity_lists_owner_all
  on public.entity_lists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists model_registry_owner_all on public.model_registry;
create policy model_registry_owner_all
  on public.model_registry for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists graph_edges_owner_all on public.graph_edges;
create policy graph_edges_owner_all
  on public.graph_edges for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists api_integrations_owner_all on public.api_integrations;
create policy api_integrations_owner_all
  on public.api_integrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists compliance_reports_owner_all on public.compliance_reports;
create policy compliance_reports_owner_all
  on public.compliance_reports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists channel_events_owner_all on public.channel_events;
create policy channel_events_owner_all
  on public.channel_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists customer_risk_profiles_owner_all on public.customer_risk_profiles;
create policy customer_risk_profiles_owner_all
  on public.customer_risk_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.risk_rules to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.risk_scores to authenticated;
grant select, insert, update, delete on public.fraud_cases to authenticated;
grant select, insert, update, delete on public.alerts to authenticated;
grant select, insert, update, delete on public.chargebacks to authenticated;
grant select, insert, update, delete on public.behavioral_biometrics to authenticated;
grant select, insert, update, delete on public.account_security_events to authenticated;
grant select, insert, update, delete on public.identity_verifications to authenticated;
grant select, insert, update, delete on public.entity_lists to authenticated;
grant select, insert, update, delete on public.model_registry to authenticated;
grant select, insert, update, delete on public.graph_edges to authenticated;
grant select, insert, update, delete on public.api_integrations to authenticated;
grant select, insert, update, delete on public.compliance_reports to authenticated;
grant select, insert, update, delete on public.channel_events to authenticated;
grant select, insert, update, delete on public.customer_risk_profiles to authenticated;

-- =========================
-- Seed First-Visit Demo Data
-- =========================

create or replace function public.seed_core_feature_data_for_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_tx uuid;
  blocked_tx uuid;
  review_tx uuid;
begin
  insert into public.model_registry (user_id, model_key, version, status, rollout_percent, review_threshold, block_threshold, metadata)
  values
    (target_user, 'fraud_primary', 'v4.0.0', 'active', 100, 40, 70, '{"framework":"xgboost","owner":"risk-ml"}'::jsonb),
    (target_user, 'fraud_primary', 'v4.1.0-shadow', 'shadow', 15, 42, 72, '{"framework":"lightgbm","owner":"risk-ml"}'::jsonb)
  on conflict (user_id, model_key, version) do nothing;

  insert into public.identity_verifications (user_id, provider, document_type, document_country, status, confidence_score, metadata, verified_at)
  values
    (target_user, 'persona', 'passport', 'US', 'verified', 96.40, '{"kyc_tier":"enhanced","pep_screening":"clear"}'::jsonb, now() - interval '21 days')
  on conflict (user_id, provider, document_type) do nothing;

  insert into public.entity_lists (user_id, entity_type, entity_value, list_type, reason, is_active, expires_at)
  values
    (target_user, 'device', 'iphone-14-pro', 'whitelist', 'Known trusted customer device', true, null),
    (target_user, 'ip', '102.10.18.73', 'blacklist', 'Prior fraud ring activity', true, now() + interval '90 days'),
    (target_user, 'country', 'PH', 'blacklist', 'Temporary elevated regional risk controls', true, now() + interval '30 days'),
    (target_user, 'payment_method', 'virtual_card', 'blacklist', 'Virtual card abuse pattern', true, null)
  on conflict (user_id, entity_type, entity_value, list_type) do nothing;

  insert into public.api_integrations (user_id, name, integration_type, endpoint, status, secret_ref)
  values
    (target_user, 'Primary Slack SOC', 'slack', 'https://hooks.slack.example/aegis/soc', 'active', 'vault://alerts/slack'),
    (target_user, 'Risk Webhook Sink', 'webhook', 'https://risk-hooks.example/internal/fraud', 'active', 'vault://alerts/webhook'),
    (target_user, 'Compliance Mailbox', 'email', 'fraud-compliance@aegis.dev', 'active', 'vault://alerts/email')
  on conflict (user_id, name) do nothing;

  if not exists (select 1 from public.account_security_events where user_id = target_user limit 1) then
    insert into public.account_security_events (user_id, event_type, channel, ip_address, country, device_id, risk_hint, occurred_at)
    values
      (target_user, 'login_success', 'web', '35.189.12.22', 'US', 'macbook-office', 4, now() - interval '5 hours'),
      (target_user, 'login_failed', 'web', '102.10.18.73', 'PH', 'unknown-browser', 71, now() - interval '4 hours 45 minutes'),
      (target_user, 'mfa_challenge', 'mobile_app', '108.72.41.10', 'US', 'iphone-14-pro', 16, now() - interval '4 hours 30 minutes'),
      (target_user, 'mfa_failed', 'api', '156.146.53.8', 'NG', 'new-device-xy77', 88, now() - interval '4 hours 20 minutes'),
      (target_user, 'password_reset', 'web', '35.189.12.22', 'US', 'macbook-office', 22, now() - interval '3 hours 55 minutes');
  end if;

  select id into latest_tx
  from public.transactions
  where user_id = target_user
  order by occurred_at desc
  limit 1;

  select id into blocked_tx
  from public.transactions
  where user_id = target_user and status = 'blocked'
  order by occurred_at desc
  limit 1;

  select id into review_tx
  from public.transactions
  where user_id = target_user and status = 'review'
  order by occurred_at desc
  limit 1;

  if not exists (select 1 from public.channel_events where user_id = target_user limit 1) then
    if latest_tx is not null then
      insert into public.channel_events (user_id, transaction_id, channel, event_type, metadata, occurred_at)
      values (target_user, latest_tx, 'web', 'transaction_attempt', '{"source":"checkout","multi_channel_linked":true}'::jsonb, now() - interval '6 minutes');
    end if;

    if blocked_tx is not null then
      insert into public.channel_events (user_id, transaction_id, channel, event_type, metadata, occurred_at)
      values (target_user, blocked_tx, 'api', 'transaction_blocked', '{"source":"risk_api","requires_manual_review":true}'::jsonb, now() - interval '19 minutes');
    end if;

    if review_tx is not null then
      insert into public.channel_events (user_id, transaction_id, channel, event_type, metadata, occurred_at)
      values (target_user, review_tx, 'mobile_app', 'transaction_review', '{"source":"mobile_checkout","step_up_auth":"prompted"}'::jsonb, now() - interval '13 minutes');
    end if;
  end if;

  if not exists (select 1 from public.behavioral_biometrics where user_id = target_user limit 1) then
    if latest_tx is not null then
      insert into public.behavioral_biometrics (user_id, transaction_id, typing_cadence_ms, pointer_velocity, touch_pressure, scroll_speed, anomaly_score)
      values (target_user, latest_tx, 182, 318.45, 0.44, 286.20, 18.10);
    end if;

    if blocked_tx is not null then
      insert into public.behavioral_biometrics (user_id, transaction_id, typing_cadence_ms, pointer_velocity, touch_pressure, scroll_speed, anomaly_score)
      values (target_user, blocked_tx, 74, 961.20, 0.95, 912.70, 88.60);
    end if;

    if review_tx is not null then
      insert into public.behavioral_biometrics (user_id, transaction_id, typing_cadence_ms, pointer_velocity, touch_pressure, scroll_speed, anomaly_score)
      values (target_user, review_tx, 105, 708.18, 0.83, 660.40, 63.40);
    end if;
  end if;

  if not exists (select 1 from public.graph_edges where user_id = target_user limit 1) then
    insert into public.graph_edges (user_id, transaction_id, source_type, source_value, target_type, target_value, signal, weight)
    select t.user_id, t.id, 'user', t.user_id::text, 'device', t.device_id, 'shared_device', 1.25
    from public.transactions t
    where t.user_id = target_user
    order by t.occurred_at desc
    limit 8;

    insert into public.graph_edges (user_id, transaction_id, source_type, source_value, target_type, target_value, signal, weight)
    select t.user_id, t.id, 'device', t.device_id, 'ip', host(t.ip_address), 'ip_reuse', 1.10
    from public.transactions t
    where t.user_id = target_user and t.ip_address is not null
    order by t.occurred_at desc
    limit 8;

    insert into public.graph_edges (user_id, transaction_id, source_type, source_value, target_type, target_value, signal, weight)
    select t.user_id, t.id, 'payment_method', t.payment_method, 'merchant', t.merchant_name, 'merchant_method_cluster', 0.95
    from public.transactions t
    where t.user_id = target_user
    order by t.occurred_at desc
    limit 8;
  end if;

  insert into public.compliance_reports (user_id, report_type, period_start, period_end, status, summary, generated_at)
  values
    (
      target_user,
      'pci_dss',
      date_trunc('month', current_date)::date,
      current_date,
      'generated',
      jsonb_build_object(
        'transactions_analyzed', (select count(*) from public.transactions where user_id = target_user),
        'blocked_transactions', (select count(*) from public.transactions where user_id = target_user and status = 'blocked'),
        'mfa_failures', (select count(*) from public.account_security_events where user_id = target_user and event_type = 'mfa_failed')
      ),
      now()
    ),
    (
      target_user,
      'gdpr',
      date_trunc('month', current_date)::date,
      current_date,
      'generated',
      jsonb_build_object(
        'alerts_sent', (select count(*) from public.alerts where user_id = target_user and status in ('new', 'sent', 'acknowledged')),
        'identity_status', (select status from public.identity_verifications where user_id = target_user order by updated_at desc limit 1)
      ),
      now()
    ),
    (
      target_user,
      'risk_audit',
      date_trunc('month', current_date)::date,
      current_date,
      'generated',
      jsonb_build_object(
        'active_rules', (select count(*) from public.risk_rules where user_id = target_user and is_active),
        'watchlist_entries', (select count(*) from public.entity_lists where user_id = target_user and is_active),
        'model_version', (select version from public.model_registry where user_id = target_user and status = 'active' order by updated_at desc limit 1)
      ),
      now()
    ),
    (
      target_user,
      'chargeback_summary',
      date_trunc('month', current_date)::date,
      current_date,
      'generated',
      jsonb_build_object(
        'chargebacks', (select count(*) from public.chargebacks where user_id = target_user),
        'avg_probability', (select coalesce(round(avg(chargeback_probability), 2), 0) from public.transactions where user_id = target_user)
      ),
      now()
    )
  on conflict (user_id, report_type, period_start, period_end) do nothing;

  insert into public.customer_risk_profiles (
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
    target_user,
    greatest(1, least(99, coalesce(round(avg(t.risk_score))::integer, 1))),
    case
      when coalesce(avg(t.risk_score), 0) >= 70 then 'high'
      when coalesce(avg(t.risk_score), 0) >= 40 then 'medium'
      else 'low'
    end,
    count(*)::integer,
    count(*) filter (where t.status = 'blocked')::integer,
    count(*) filter (where t.status = 'review')::integer,
    coalesce((select count(*)::integer from public.chargebacks cb where cb.user_id = target_user), 0),
    coalesce(round(avg(t.chargeback_probability), 2), 0)::numeric(5, 2),
    max(t.occurred_at),
    jsonb_build_object(
      'failed_security_events_6h', (
        select count(*) from public.account_security_events ase
        where ase.user_id = target_user
          and ase.event_type in ('login_failed', 'mfa_failed')
          and ase.occurred_at >= now() - interval '6 hours'
      ),
      'watchlist_blacklist_hits', (
        select count(*) from public.entity_lists el
        where el.user_id = target_user and el.list_type = 'blacklist' and el.is_active
      ),
      'identity_status', (
        select iv.status from public.identity_verifications iv
        where iv.user_id = target_user
        order by iv.updated_at desc
        limit 1
      )
    )
  from public.transactions t
  where t.user_id = target_user
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
    updated_at = now();
end;
$$;

create or replace function public.seed_demo_data_for_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d1 uuid; d2 uuid; d3 uuid; d4 uuid; d5 uuid; d6 uuid;
  pm1 uuid; pm2 uuid; pm3 uuid; pm4 uuid; pm5 uuid;
  tx1 uuid; tx2 uuid; tx3 uuid; tx4 uuid; tx5 uuid; tx6 uuid;
  tx7 uuid; tx8 uuid; tx9 uuid; tx10 uuid; tx11 uuid; tx12 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
begin
  if exists (select 1 from public.transactions where user_id = target_user limit 1) then
    perform public.seed_core_feature_data_for_user(target_user);
    return;
  end if;

  -- devices (6)
  insert into public.devices (user_id, label, device_fingerprint, device_type, operating_system, browser, ip_address, last_country, last_seen_at, risk_level)
  values (target_user, 'MacBook Pro - Office', 'fp_mac_office_001', 'desktop', 'macOS 14', 'Chrome', '35.189.12.22', 'US', now() - interval '10 minutes', 'low')
  returning id into d1;

  insert into public.devices (user_id, label, device_fingerprint, device_type, operating_system, browser, ip_address, last_country, last_seen_at, risk_level)
  values (target_user, 'iPhone 15', 'fp_iphone_015', 'mobile', 'iOS 18', 'Safari', '108.72.41.10', 'US', now() - interval '20 minutes', 'low')
  returning id into d2;

  insert into public.devices (user_id, label, device_fingerprint, device_type, operating_system, browser, ip_address, last_country, last_seen_at, risk_level)
  values (target_user, 'Android Tablet', 'fp_tablet_002', 'tablet', 'Android 15', 'Chrome', '192.188.1.34', 'US', now() - interval '2 hours', 'medium')
  returning id into d3;

  insert into public.devices (user_id, label, device_fingerprint, device_type, operating_system, browser, ip_address, last_country, last_seen_at, risk_level)
  values (target_user, 'Windows Remote Node', 'fp_windows_node_77', 'server', 'Windows 2022', 'Edge', '156.146.53.8', 'NG', now() - interval '35 minutes', 'high')
  returning id into d4;

  insert into public.devices (user_id, label, device_fingerprint, device_type, operating_system, browser, ip_address, last_country, last_seen_at, risk_level)
  values (target_user, 'Linux API Runner', 'fp_linux_api_19', 'server', 'Ubuntu 24.04', 'Headless', '44.211.80.11', 'US', now() - interval '45 minutes', 'medium')
  returning id into d5;

  insert into public.devices (user_id, label, device_fingerprint, device_type, operating_system, browser, ip_address, last_country, last_seen_at, risk_level)
  values (target_user, 'Unknown Browser Session', 'fp_unknown_999', 'other', 'Unknown', 'Unknown', '102.10.18.73', 'PH', now() - interval '15 minutes', 'high')
  returning id into d6;

  -- payment methods (5)
  insert into public.payment_methods (user_id, provider, method_type, last4, bin, country, fingerprint, status, is_default)
  values (target_user, 'Visa', 'card', '4242', '424242', 'US', 'pm_fp_4242', 'active', true)
  returning id into pm1;

  insert into public.payment_methods (user_id, provider, method_type, last4, bin, country, fingerprint, status, is_default)
  values (target_user, 'Mastercard', 'card', '5100', '510510', 'US', 'pm_fp_5100', 'active', false)
  returning id into pm2;

  insert into public.payment_methods (user_id, provider, method_type, last4, bin, country, fingerprint, status, is_default)
  values (target_user, 'ACH - Chase', 'bank', '9921', null, 'US', 'pm_fp_ach_9921', 'active', false)
  returning id into pm3;

  insert into public.payment_methods (user_id, provider, method_type, last4, bin, country, fingerprint, status, is_default)
  values (target_user, 'Apple Pay', 'wallet', '3005', null, 'US', 'pm_fp_wallet_3005', 'active', false)
  returning id into pm4;

  insert into public.payment_methods (user_id, provider, method_type, last4, bin, country, fingerprint, status, is_default)
  values (target_user, 'Virtual BIN', 'virtual_card', '8821', '482901', 'NG', 'pm_fp_virtual_8821', 'blocked', false)
  returning id into pm5;

  -- risk rules (4)
  insert into public.risk_rules (user_id, name, description, rule_type, operator, threshold, weight, is_active)
  values
    (target_user, 'High amount threshold', 'Flag transactions over $2,000', 'amount', 'gt', 2000, 28, true),
    (target_user, '1h velocity spike', 'Flag if > 4 attempts within 1 hour', 'velocity_1h', 'gt', 4, 20, true),
    (target_user, 'Risky geolocation', 'Flag non-core geographies', 'geo', 'in', null, 18, true),
    (target_user, 'New high-risk device', 'Block unknown high-risk device profile', 'device', 'eq', null, 24, true);

  -- transactions (12)
  insert into public.transactions (user_id, merchant_name, merchant_category, amount, currency, status, risk_score, payment_method, payment_method_id, ip_address, country, device_id, device_ref_id, velocity_1h, velocity_24h, chargeback_probability, occurred_at)
  values (target_user, 'AtlasPay Checkout', 'digital_goods', 1299, 'USD', 'review', 62, 'card', pm1, '35.189.12.22', 'US', 'new-device-1289', d1, 3, 9, 32.50, now() - interval '5 minutes')
  returning id into tx1;

  insert into public.transactions values (gen_random_uuid(), target_user, 'Nova Wallet', 'wallet_topup', 244, 'USD', 'approved', 24, 'wallet', pm4, '108.72.41.10', 'US', 'iphone-14-pro', d2, 1, 2, 7.20, now() - interval '12 minutes', now() - interval '12 minutes', now() - interval '12 minutes')
  returning id into tx2;

  insert into public.transactions values (gen_random_uuid(), target_user, 'CrossBorder Transfer', 'p2p', 3400, 'USD', 'blocked', 84, 'virtual_card', pm5, '156.146.53.8', 'NG', 'new-device-xy77', d4, 7, 18, 78.40, now() - interval '18 minutes', now() - interval '18 minutes', now() - interval '18 minutes')
  returning id into tx3;

  insert into public.transactions values (gen_random_uuid(), target_user, 'QuickMart', 'retail', 58, 'USD', 'approved', 11, 'card', pm2, '44.211.80.11', 'US', 'macbook-office', d1, 1, 3, 3.10, now() - interval '26 minutes', now() - interval '26 minutes', now() - interval '26 minutes')
  returning id into tx4;

  insert into public.transactions values (gen_random_uuid(), target_user, 'CloudScale', 'saas', 899, 'USD', 'review', 49, 'bank', pm3, '44.211.80.11', 'US', 'linux-api', d5, 2, 5, 25.50, now() - interval '33 minutes', now() - interval '33 minutes', now() - interval '33 minutes')
  returning id into tx5;

  insert into public.transactions values (gen_random_uuid(), target_user, 'NightOwl Bets', 'gaming', 1200, 'USD', 'blocked', 76, 'card', pm2, '102.10.18.73', 'PH', 'unknown-browser', d6, 6, 12, 66.70, now() - interval '47 minutes', now() - interval '47 minutes', now() - interval '47 minutes')
  returning id into tx6;

  insert into public.transactions values (gen_random_uuid(), target_user, 'MetroRide', 'transport', 24, 'USD', 'approved', 8, 'wallet', pm4, '108.72.41.10', 'US', 'iphone-14-pro', d2, 1, 1, 1.50, now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
  returning id into tx7;

  insert into public.transactions values (gen_random_uuid(), target_user, 'Pixel Market', 'digital_goods', 430, 'USD', 'review', 55, 'card', pm1, '35.189.12.22', 'US', 'new-device-1289', d1, 4, 10, 34.20, now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours')
  returning id into tx8;

  insert into public.transactions values (gen_random_uuid(), target_user, 'HyperComms', 'telecom', 74, 'USD', 'approved', 16, 'bank', pm3, '44.211.80.11', 'US', 'linux-api', d5, 1, 2, 4.80, now() - interval '3 hours', now() - interval '3 hours', now() - interval '3 hours')
  returning id into tx9;

  insert into public.transactions values (gen_random_uuid(), target_user, 'Global Flights', 'travel', 2180, 'USD', 'review', 68, 'card', pm2, '156.146.53.8', 'NG', 'new-device-xy77', d4, 5, 11, 52.10, now() - interval '4 hours', now() - interval '4 hours', now() - interval '4 hours')
  returning id into tx10;

  insert into public.transactions values (gen_random_uuid(), target_user, 'FoodClub', 'food', 42, 'USD', 'approved', 13, 'wallet', pm4, '108.72.41.10', 'US', 'iphone-14-pro', d2, 1, 4, 2.20, now() - interval '5 hours', now() - interval '5 hours', now() - interval '5 hours')
  returning id into tx11;

  insert into public.transactions values (gen_random_uuid(), target_user, 'CryptoSwap', 'crypto', 970, 'USD', 'blocked', 81, 'crypto', pm5, '102.10.18.73', 'PH', 'unknown-browser', d6, 8, 21, 74.90, now() - interval '6 hours', now() - interval '6 hours', now() - interval '6 hours')
  returning id into tx12;

  -- risk scores (12)
  insert into public.risk_scores (user_id, transaction_id, model_version, score, decision, reason_codes, explanation)
  values
    (target_user, tx1, 'fraud-v3.2.1', 62, 'review', array['velocity_1h', 'new_device'], '{"top_factor":"velocity","confidence":0.82}'::jsonb),
    (target_user, tx2, 'fraud-v3.2.1', 24, 'approved', array['trusted_device'], '{"top_factor":"trusted_device","confidence":0.91}'::jsonb),
    (target_user, tx3, 'fraud-v3.2.1', 84, 'blocked', array['geo_risk', 'virtual_card', 'amount'], '{"top_factor":"geo_risk","confidence":0.95}'::jsonb),
    (target_user, tx4, 'fraud-v3.2.1', 11, 'approved', array['low_amount'], '{"top_factor":"amount","confidence":0.89}'::jsonb),
    (target_user, tx5, 'fraud-v3.2.1', 49, 'review', array['amount', 'merchant_pattern'], '{"top_factor":"merchant_pattern","confidence":0.77}'::jsonb),
    (target_user, tx6, 'fraud-v3.2.1', 76, 'blocked', array['geo_risk', 'velocity_24h'], '{"top_factor":"velocity_24h","confidence":0.88}'::jsonb),
    (target_user, tx7, 'fraud-v3.2.1', 8, 'approved', array['normal_pattern'], '{"top_factor":"normal_pattern","confidence":0.93}'::jsonb),
    (target_user, tx8, 'fraud-v3.2.1', 55, 'review', array['repeat_attempt'], '{"top_factor":"repeat_attempt","confidence":0.81}'::jsonb),
    (target_user, tx9, 'fraud-v3.2.1', 16, 'approved', array['trusted_network'], '{"top_factor":"trusted_network","confidence":0.9}'::jsonb),
    (target_user, tx10, 'fraud-v3.2.1', 68, 'review', array['cross_border', 'amount'], '{"top_factor":"cross_border","confidence":0.84}'::jsonb),
    (target_user, tx11, 'fraud-v3.2.1', 13, 'approved', array['historical_good_user'], '{"top_factor":"historical_good_user","confidence":0.92}'::jsonb),
    (target_user, tx12, 'fraud-v3.2.1', 81, 'blocked', array['crypto', 'unknown_device', 'geo_risk'], '{"top_factor":"unknown_device","confidence":0.9}'::jsonb);

  -- fraud cases (5)
  insert into public.fraud_cases (user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes)
  values
    (target_user, tx1, 'Velocity spike detected', 'Three attempts in under two minutes from a new device', 'investigating', 'medium', 'analyst@aegis.com', null)
  returning id into c1;

  insert into public.fraud_cases (user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes)
  values
    (target_user, tx3, 'High-risk geo mismatch', 'High amount transaction from a risky region', 'open', 'high', 'lead@aegis.com', null)
  returning id into c2;

  insert into public.fraud_cases (user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes)
  values
    (target_user, tx6, 'Gaming abuse pattern', 'Multiple high-value attempts from unfamiliar network', 'investigating', 'high', 'analyst2@aegis.com', null)
  returning id into c3;

  insert into public.fraud_cases (user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes)
  values
    (target_user, tx8, 'Digital goods anomaly', 'Unexpected spend pattern for digital goods SKU', 'resolved', 'medium', 'analyst@aegis.com', 'Customer verified through step-up auth')
  returning id into c4;

  insert into public.fraud_cases (user_id, transaction_id, title, reason, status, severity, assigned_to, resolution_notes)
  values
    (target_user, tx12, 'Crypto payout risk', 'Unknown device and risky location for crypto transaction', 'open', 'high', 'lead@aegis.com', null)
  returning id into c5;

  -- alerts (6)
  insert into public.alerts (user_id, transaction_id, case_id, channel, severity, status, title, message, sent_at, acknowledged_at)
  values
    (target_user, tx1, c1, 'in_app', 'medium', 'sent', 'Review required: AtlasPay Checkout', 'Transaction entered manual review queue.', now() - interval '4 minutes', null),
    (target_user, tx3, c2, 'email', 'high', 'acknowledged', 'Blocked transaction alert', 'CrossBorder Transfer was blocked automatically.', now() - interval '16 minutes', now() - interval '10 minutes'),
    (target_user, tx6, c3, 'slack', 'high', 'sent', 'Potential fraud ring behavior', 'NightOwl Bets activity matched prior abuse signatures.', now() - interval '42 minutes', null),
    (target_user, tx8, c4, 'webhook', 'medium', 'closed', 'Case resolved notification', 'Digital goods anomaly case was resolved.', now() - interval '90 minutes', now() - interval '88 minutes'),
    (target_user, tx10, null, 'in_app', 'medium', 'new', 'Cross-border payment review', 'Global Flights payment exceeded threshold.', null, null),
    (target_user, tx12, c5, 'email', 'high', 'new', 'Critical crypto risk event', 'Manual intervention required for CryptoSwap payment.', null, null);

  -- chargebacks (2)
  insert into public.chargebacks (user_id, transaction_id, case_id, reason_code, amount, currency, status, reported_at)
  values
    (target_user, tx3, c2, '10.4', 3400, 'USD', 'disputed', now() - interval '2 days'),
    (target_user, tx6, c3, '13.1', 1200, 'USD', 'received', now() - interval '20 hours');

  perform public.seed_core_feature_data_for_user(target_user);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', split_part(new.email, '@', 1)),
    null,
    new.email
  )
  on conflict (id) do update
  set first_name = excluded.first_name,
      email = excluded.email,
      updated_at = now();

  perform public.seed_demo_data_for_user(new.id);
  perform public.seed_core_feature_data_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
