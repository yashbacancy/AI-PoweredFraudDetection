# Core Functionality Guide

This document explains how the fraud platform core functionality works end-to-end in the current codebase.

## 1) System overview

The product has two execution modes:

- `local` mode:
  - Transaction create/update requests go through API routes:
    - `POST /api/transactions`
    - `PATCH /api/transactions/:id`
  - Backend pipeline runs full fraud logic in `lib/local/repository.ts`.
  - SQL model and seed data come from `supabase/local-full.sql` (via `supabase/local-postgres.sql`).

- `supabase` mode:
  - UI writes directly with Supabase client to `transactions`.
  - Basic score calculation is used client-side (`calculateRiskScore`).
  - Advanced artifact pipeline is currently implemented in local backend flow.

## 2) Transaction lifecycle (local mode)

When a transaction is created/updated, the backend performs:

1. Input normalization:
   - Country normalization (`US`, `NG`, etc.).
   - Channel normalization (`web`, `mobile_app`, `api`, `pos`, `call_center`).
2. Context resolution:
   - Device lookup/create (`devices`).
   - Payment method context (`payment_methods`).
   - Velocity window stats (`transactions` in 1h and 24h).
   - Active rules (`risk_rules`).
   - Chargeback ratio (`chargebacks`).
   - Identity status (`identity_verifications`).
   - Customer profile (`customer_risk_profiles`).
   - Account-takeover signal (`account_security_events`).
   - List checks (`entity_lists` whitelist/blacklist).
   - Active model thresholds/version (`model_registry`).
3. Risk evaluation:
   - `evaluateRiskSignals(...)` computes score, decision, severity, reason codes, and feature breakdown.
4. Transaction write:
   - Persists score + decision + velocity + chargeback probability into `transactions`.
5. Artifact generation:
   - Upsert `risk_scores` explanation JSON.
   - Insert `channel_events`.
   - Insert `graph_edges`.
   - Auto-open `fraud_cases` for high-risk decisions.
   - Fan-out `alerts` based on active integrations.
   - Insert `behavioral_biometrics` when biometrics payload exists.
   - Upsert monthly `compliance_reports` (`risk_audit`).
   - Refresh `customer_risk_profiles`.

## 3) Risk model logic

`lib/risk.ts` defines the scoring model:

- Primary inputs:
  - amount, country, payment method, device id
  - velocity 1h/24h
  - historical average amount
  - device/payment risk status
  - account takeover event count
  - behavioral anomaly score
  - geo mismatch
  - identity status
  - customer risk score
  - chargeback ratio
  - watchlist / allowlist hits
  - rule engine boost
  - channel
  - model thresholds

- Decision:
  - Dynamic thresholds from `model_registry`:
    - review threshold (default 40)
    - block threshold (default 70)

- Outputs:
  - `score` (1..99)
  - `status` (`approved`, `review`, `blocked`)
  - `chargeback_probability` (0..99)
  - `severity` (`low`, `medium`, `high`)
  - `reason_codes`
  - `breakdown` per signal bucket

## 4) Core features mapping (1-20)

1. Real-time transaction scoring:
   - `evaluateRiskSignals` + transaction API routes + repository pipeline.
2. Device fingerprinting:
   - `devices` table + `getOrCreateDevice`.
3. Velocity checks:
   - 1h/24h counters via `getVelocityStats`.
4. Geolocation analysis:
   - country risk list + device last-country mismatch logic.
5. Behavioral biometrics:
   - biometrics input in UI + anomaly scoring + `behavioral_biometrics` table.
6. Account takeover protection:
   - failed login/MFA signal from `account_security_events`.
7. Payment method validation:
   - method context/status lookup from `payment_methods`.
8. Risk rules engine:
   - active rule fetch from `risk_rules` + weighted boost via `evaluateRules`.
9. Fraud case management:
   - manual CRUD via `/api/cases` + auto-case creation on high-risk transactions.
10. Real-time alerts & notifications:
   - `alerts` writes with channel fan-out from `api_integrations`.
11. Machine learning model management:
   - `model_registry` stores active/shadow versions + thresholds.
12. Identity verification:
   - `identity_verifications` status contributes to risk.
13. Graph analysis:
   - relationship edges written to `graph_edges`.
14. Whitelist/blacklist management:
   - `entity_lists` evaluated during scoring.
15. API integration framework:
   - integrations in `api_integrations` drive alert channels.
16. Compliance reporting:
   - monthly report rows in `compliance_reports` + risk audit summary upsert.
17. Multi-channel fraud detection:
   - channel input + channel weighting + `channel_events`.
18. Historical transaction analysis:
   - historical avg amount and rolling velocity impact score.
19. Customer risk profiling:
   - aggregate profile in `customer_risk_profiles` refreshed after transaction changes.
20. Chargeback management:
   - `chargebacks` table + chargeback ratio feature impacts risk.

## 5) Database model (core tables)

Existing core tables:

- `profiles`, `devices`, `payment_methods`, `risk_rules`
- `transactions`, `risk_scores`
- `fraud_cases`, `alerts`, `chargebacks`

Added feature tables:

- `behavioral_biometrics`
- `account_security_events`
- `identity_verifications`
- `entity_lists`
- `model_registry`
- `graph_edges`
- `api_integrations`
- `compliance_reports`
- `channel_events`
- `customer_risk_profiles`

All added tables include indexes, RLS policies, and (where applicable) `updated_at` triggers.

## 6) Seed data behavior

Seed flow now has two levels:

- `seed_demo_data_for_user(...)`:
  - baseline product data (transactions, cases, alerts, chargebacks, etc.)
- `seed_core_feature_data_for_user(...)`:
  - model registry rows
  - identity verification sample
  - whitelist/blacklist entries
  - integration channels
  - account security events
  - channel events
  - behavioral biometrics
  - graph edges
  - compliance reports
  - customer risk profile

This is run for local demo user and for new Supabase auth users.

## 7) API and UI touchpoints

- Transaction APIs:
  - `app/api/transactions/route.ts`
  - `app/api/transactions/[id]/route.ts`
- Local backend intelligence:
  - `lib/local/repository.ts`
- Scoring model:
  - `lib/risk.ts`
- UI capture for channel + biometrics:
  - `components/app/transactions-client.tsx`

## 8) Operational notes

- For local setup, always run:
  - `psql ... -f supabase/local-postgres.sql`
  - This wrapper includes `local-full.sql`.
- `npm run lint` and `npx tsc --noEmit` are passing for current implementation.
- `next build` may fail in restricted network environments due to Google Fonts fetch restrictions, not due to TypeScript or lint errors.

## 9) Client demo runbook

Use these exact steps before presenting to a client.

### 9.1 One-time setup

```bash
cd /Users/apple/code/ai-powered-fraud-detection-prevention-platform
npm install
cp .env.example .env.local
```

Set `.env.local`:

```env
APP_DB_MODE=local
NEXT_PUBLIC_APP_DB_MODE=local
DATABASE_URL=postgres://postgres:postgres@localhost:5432/aegis
```

### 9.2 Start local Postgres

```bash
docker run --name aegis-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aegis -p 5432:5432 -d postgres:16
```

If the container already exists:

```bash
docker start aegis-postgres
```

### 9.3 Reset + seed before every demo

```bash
psql postgres://postgres:postgres@localhost:5432/aegis -c "drop schema public cascade; create schema public;"
psql postgres://postgres:postgres@localhost:5432/aegis -f supabase/local-postgres.sql
```

### 9.4 Start app

```bash
source ~/.nvm/nvm.sh
nvm use 20.20.1
npm run dev
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/app/dashboard`
- `http://localhost:3000/app/transactions`
- `http://localhost:3000/app/cases`

In `local` mode, login is not required.

### 9.5 Suggested live walkthrough

1. Dashboard:
   - Show seeded KPIs and latest transaction mix.
2. Transactions:
   - Show approved/review/blocked pre-seeded rows.
3. Create a low-risk transaction:
   - channel `web`, country `US`, payment `card`, known-looking device id.
   - Expected outcome: `approved`.
4. Create a high-risk transaction:
   - payment `crypto` or `virtual_card`
   - country `PH` or `NG`
   - device id like `new-device-attack-01`
   - IP `102.10.18.73`
   - channel `api`
   - biometrics example:
     - typing cadence: `70`
     - pointer velocity: `950`
     - touch pressure: `0.95`
     - scroll speed: `900`
   - Expected outcome: `blocked` with automatic downstream artifacts.
5. Cases:
   - Show the auto-generated case for the risky transaction.

### 9.6 Optional proof queries during demo

```bash
psql postgres://postgres:postgres@localhost:5432/aegis -c "select merchant_name,status,risk_score,chargeback_probability,velocity_1h,velocity_24h,occurred_at from public.transactions where user_id='local-demo-user' order by occurred_at desc limit 5;"

psql postgres://postgres:postgres@localhost:5432/aegis -c "select rs.score,rs.decision,rs.reason_codes,rs.explanation->>'channel' as channel,rs.explanation->>'model_version' as model from public.risk_scores rs join public.transactions t on t.id=rs.transaction_id where t.user_id='local-demo-user' order by rs.created_at desc limit 5;"

psql postgres://postgres:postgres@localhost:5432/aegis -c "select risk_score,risk_tier,total_transactions,blocked_transactions,review_transactions,avg_chargeback_probability from public.customer_risk_profiles where user_id='local-demo-user';"
```
