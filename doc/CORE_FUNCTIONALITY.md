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

## 10) Blueprint Coverage Matrix (as of March 14, 2026)

Status legend:

- `Implemented`: available and operational for the intended scope.
- `Partial`: implemented in limited scope (for example, local-only, simplified logic, or missing operational depth).
- `Missing`: not implemented yet.

### 10.1 Core features (1-20)

| # | Core Feature | Priority | Status | Current implementation | Gap vs blueprint |
|---|---|---|---|---|---|
| 1 | Real-time Transaction Scoring | must-have | `Partial` | Full scoring pipeline exists in local mode (`lib/local/repository.ts`, `lib/risk.ts`). | Supabase mode uses simplified client-side scoring path in UI create/update flow; full backend artifact pipeline is not unified across modes. |
| 2 | Device Fingerprinting | must-have | `Partial` | Device profile table + lookup/create logic (`devices`, `getOrCreateDevice`). | No advanced browser/hardware/network fingerprint SDK collection and anti-spoof controls. |
| 3 | Velocity Checks | must-have | `Partial` | 1h/24h velocity and historical average (`getVelocityStats`). | No configurable multi-dimensional velocity engine (merchant/account/IP/device combinations) beyond current core checks. |
| 4 | Geolocation Analysis | must-have | `Partial` | Risk-country and device-country mismatch checks. | No IP geolocation enrichment, timezone inconsistency engine, or impossible-travel analysis. |
| 5 | Behavioral Biometrics | must-have | `Partial` | Biometrics fields in transaction UI, anomaly scoring, and `behavioral_biometrics` writes. | No passive live behavioral capture pipeline; currently manual input driven. |
| 6 | Account Takeover Detection | must-have | `Partial` | Uses account security events (`login_failed`, `mfa_failed`) in scoring. | No advanced login-pattern modeling, device transition scoring, or adaptive challenge flow. |
| 7 | Payment Method Validation | must-have | `Partial` | Payment method context/status lookup from local/Supabase tables. | No external validation layers (BIN intelligence, bank/wallet verification networks). |
| 8 | Risk Rules Engine | must-have | `Partial` | CRUD rules + weighted rule boost in scoring; control pages exist. | Rule evaluation depth is limited and full parity across all execution modes is not complete. |
| 9 | Fraud Case Management | must-have | `Partial` | Cases CRUD + auto-case creation for high-risk transactions. | Analyst workflow depth is basic (limited lifecycle, collaboration, SLA/escalation features). |
| 10 | Real-time Alerts & Notifications | must-have | `Partial` | Alerts + integrations CRUD; dispatch utilities for email/webhook/slack. | Auto-generated transaction alerts are stored, but pipeline-triggered external delivery is not fully wired in scoring flow. |
| 11 | Machine Learning Model Management | must-have | `Partial` | Model registry, rollout metadata, thresholds used by scoring. | No true model training/deployment pipeline, monitoring, drift management, or A/B experimentation workflow. |
| 12 | Identity Verification | must-have | `Partial` | Identity status contributes to risk; identity data visible in UI. | No full document verification orchestration, biometric matching flow, or KYC workflow engine. |
| 13 | Graph Analysis | important | `Partial` | Graph edges are generated and visualized (`graph_edges`, Graph page/canvas). | No graph analytics/ring-detection algorithms beyond edge display and simple signal counts. |
| 14 | Whitelist/Blacklist Management | must-have | `Partial` | Watchlist CRUD API + scoring usage (`entity_lists`). | Limited governance depth (bulk ops/import workflows/audit tooling) and mode parity constraints remain. |
| 15 | API Integration Framework | must-have | `Partial` | REST APIs for major entities + alert integration routing. | No SDK package layer and no broader integration framework abstractions defined in blueprint. |
| 16 | Compliance Reporting | must-have | `Partial` | Compliance report tables + risk audit upsert + compliance page. | No full automated PCI DSS/GDPR report assembly and submission workflow. |
| 17 | Multi-channel Fraud Detection | important | `Partial` | Channel normalization/weighting + channel events table. | Limited to current scoring heuristic; no full unified cross-channel orchestration at blueprint depth. |
| 18 | Historical Transaction Analysis | important | `Partial` | Historical average amount + rolling velocity included. | No dedicated batch analytics pipeline for historical backtesting/model improvement loops. |
| 19 | Customer Risk Profiling | important | `Partial` | `customer_risk_profiles` maintained and surfaced in UI. | Profile logic is aggregate/basic; no richer longitudinal behavior model features. |
| 20 | Chargeback Prevention | important | `Partial` | Chargeback ratio influences scoring + chargeback metrics pages. | No dedicated proactive prevention strategy engine/workflow beyond ratio-based risk influence. |

### 10.2 Advanced / differentiating features

| # | Advanced Feature | Priority | Status | Notes |
|---|---|---|---|---|
| 1 | Federated Learning | innovative | `Missing` | Not present in model pipeline. |
| 2 | Synthetic Fraud Generation | innovative | `Missing` | No synthetic data generation framework. |
| 3 | Explainable AI Dashboard | important | `Partial` | Transaction detail includes score breakdown/context, but no full explanation dashboard suite. |
| 4 | Cross-merchant Intelligence | innovative | `Missing` | No cross-tenant/shared intel architecture. |
| 5 | Adversarial Attack Detection | innovative | `Missing` | No adversarial-defense subsystem. |
| 6 | Dynamic Risk Thresholds | important | `Partial` | Thresholds are configurable in model registry, but not self-adjusting based on feedback/business metrics. |
| 7 | Multi-modal Fraud Detection | innovative | `Missing` | No text/image/voice multimodal inference. |
| 8 | Fraud Simulation Environment | important | `Missing` | No sandbox simulation harness for fraud scenario replay/testing. |
| 9 | Quantum-resistant Cryptography | innovative | `Missing` | Not in current crypto stack. |
| 10 | Blockchain Fraud Verification | innovative | `Missing` | Not implemented. |
| 11 | AutoML for Fraud Models | important | `Missing` | No automated model discovery/retraining pipeline. |
| 12 | Contextual Authentication | important | `Missing` | No adaptive authentication challenge orchestration. |

### 10.3 Blueprint API group coverage

| Blueprint API Group | Status | Current coverage | Gap |
|---|---|---|---|
| `/auth` | `Implemented` | Login/signup/callback flows are present. | None significant for MVP scope. |
| `/transactions` | `Implemented` | Transaction APIs and UI flow exist. | Advanced mode parity and full backend scoring in Supabase mode still pending. |
| `/users` | `Missing` | No dedicated users API surface. | Add user management and profile/risk endpoints. |
| `/devices` | `Missing` | Device data exists in DB only. | Add device management and device-risk endpoints. |
| `/rules` | `Partial` | Implemented as `/api/risk-rules`. | Naming and expanded policy operations can be standardized. |
| `/models` | `Missing` | Model registry is read via pages/repos. | Add model management APIs (version lifecycle, rollout, thresholds). |
| `/cases` | `Implemented` | Cases CRUD APIs exist. | Deeper analyst workflow capabilities still limited. |
| `/alerts` | `Implemented` | Alerts CRUD APIs exist. | Auto-dispatch consistency from scoring pipeline can be expanded. |
| `/reports` | `Missing` | Compliance reports surfaced in UI via repository queries. | Add dedicated reporting API group. |
| `/webhooks` | `Missing` | Outbound webhook integration exists via alerts dispatch helpers. | No dedicated webhook endpoint group and governance APIs. |
| `/compliance` | `Missing` | Compliance page exists. | No dedicated compliance API endpoints for report generation/export. |

## 11) Highest-priority implementation gaps

1. Unify the full transaction scoring + artifact pipeline for both local and Supabase modes.
2. Implement robust geolocation intelligence (IP geo, timezone mismatch, impossible travel).
3. Wire automatic external dispatch for pipeline-generated alerts (not only manual alert API creation).
4. Add model-ops runtime workflows: model lifecycle APIs, evaluation, drift tracking, and experiment controls.
5. Expand dedicated API groups (`/users`, `/devices`, `/models`, `/reports`, `/webhooks`, `/compliance`) to match blueprint architecture.
