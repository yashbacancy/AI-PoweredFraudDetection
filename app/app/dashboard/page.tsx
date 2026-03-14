import { Activity, AlertTriangle, Gauge, Shield } from "lucide-react";

import { TopHeader } from "@/components/app/top-header";
import { Badge } from "@/components/ui/badge";
import { DashboardCharts } from "@/components/app/dashboard-charts";
import { getLocalCases, getLocalProfile, getLocalTransactions } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import { bucketByDay, toScoreSeries } from "@/lib/chart-utils";
import type { FraudCase, Transaction } from "@/lib/types";
import { currency, formatDate } from "@/lib/utils";

type MeterTone = "success" | "warning" | "danger" | "neutral";
type MeterRow = {
  label: string;
  value: number;
  tone: MeterTone;
};

function meterWidth(value: number, total: number) {
  if (value <= 0 || total <= 0) return "0%";
  return `${Math.max((value / total) * 100, 8)}%`;
}

function toPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export default async function DashboardPage() {
  const analyticsSampleSize = 40;
  let firstName = "there";
  let transactions: Transaction[] = [];
  let cases: FraudCase[] = [];

  if (IS_LOCAL_DB_MODE) {
    const [profile, tx, cs] = await Promise.all([
      getLocalProfile(),
      getLocalTransactions(analyticsSampleSize),
      getLocalCases(6),
    ]);
    firstName = profile?.first_name ?? "Local";
    transactions = tx;
    cases = cs;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [profileResult, txResult, caseResult] = await Promise.all([
      supabase.from("profiles").select("first_name").eq("id", user!.id).maybeSingle(),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(analyticsSampleSize),
      supabase.from("fraud_cases").select("*").order("created_at", { ascending: false }).limit(6),
    ]);

    firstName = profileResult.data?.first_name ?? "there";
    transactions = txResult.data ?? [];
    cases = caseResult.data ?? [];
  }

  const latestTransactions = transactions.slice(0, 5);
  const avgRiskScore =
    transactions.length === 0
      ? 0
      : Math.round(transactions.reduce((acc, item) => acc + item.risk_score, 0) / transactions.length);
  const openCases = cases.filter((item) => item.status !== "resolved").length;
  const statusCounts: Record<Transaction["status"], number> = {
    approved: 0,
    review: 0,
    blocked: 0,
  };
  const riskBuckets = { low: 0, medium: 0, high: 0 };
  const countryCounts = new Map<string, number>();

  for (const item of transactions) {
    statusCounts[item.status] += 1;

    if (item.risk_score >= 70) riskBuckets.high += 1;
    else if (item.risk_score >= 40) riskBuckets.medium += 1;
    else riskBuckets.low += 1;

    const country = item.country?.trim().toUpperCase() || "N/A";
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }

  const statusDistribution: MeterRow[] = [
    { label: "Approved", value: statusCounts.approved, tone: "success" },
    { label: "Review", value: statusCounts.review, tone: "warning" },
    { label: "Blocked", value: statusCounts.blocked, tone: "danger" },
  ];

  const riskDistribution: MeterRow[] = [
    { label: "Low (0-39)", value: riskBuckets.low, tone: "success" },
    { label: "Medium (40-69)", value: riskBuckets.medium, tone: "warning" },
    { label: "High (70+)", value: riskBuckets.high, tone: "danger" },
  ];

  const topCountryEntry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCountry = topCountryEntry?.[0] ?? "N/A";
  const topCountryCount = topCountryEntry?.[1] ?? 0;
  const priorityTransactions = [...transactions]
    .filter((item) => item.status !== "approved" || item.risk_score >= 70)
    .sort(
      (a, b) =>
        b.risk_score - a.risk_score ||
        new Date(b.created_at as string | Date).getTime() - new Date(a.created_at as string | Date).getTime(),
    )
    .slice(0, 5);

  const metrics = [
    {
      label: "Transactions",
      value: transactions.length,
      note: "Recent sample window",
      icon: Activity,
    },
    {
      label: "Avg risk score",
      value: avgRiskScore,
      note: `High-risk share ${toPercent(riskBuckets.high, transactions.length)}%`,
      icon: Gauge,
    },
    {
      label: "Review queue",
      value: statusCounts.review,
      note: `${toPercent(statusCounts.review, transactions.length)}% pending`,
      icon: Shield,
    },
    {
      label: "Open cases",
      value: openCases,
      note: "Requires investigation",
      icon: AlertTriangle,
    },
  ];

  return (
    <>
      <TopHeader title={`Welcome, ${firstName}`} subtitle="Focused risk dashboard with the most important signals." />

      <div className="page-content dash-smart">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <h3>No transaction data yet</h3>
            <p>Create transactions from the Transactions page to view live fraud analytics.</p>
          </div>
        ) : (
          <>
            <section className="content-card dash-hero">
              <div className="dash-hero-copy">
                <h3>Fraud posture</h3>
                <p>
                  Monitoring the last {transactions.length} transactions. Prioritize high-risk attempts and the active
                  review queue.
                </p>
              </div>
              <div className="dash-chip-row">
                <span className="dash-chip dash-chip-danger">High risk: {riskBuckets.high}</span>
                <span className="dash-chip dash-chip-warning">Review: {statusCounts.review}</span>
                <span className="dash-chip dash-chip-neutral">Top geo: {topCountry} ({topCountryCount})</span>
                <span className="dash-chip dash-chip-success">Approved: {statusCounts.approved}</span>
              </div>
            </section>

            <section className="dash-kpi-grid">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <article key={metric.label} className="content-card dash-kpi-card">
                    <div className="dash-kpi-head">
                      <span>{metric.label}</span>
                      <Icon size={15} />
                    </div>
                    <h3>{metric.value}</h3>
                    <p>{metric.note}</p>
                  </article>
                );
              })}
            </section>

            <section className="content-card chart-card">
              <div className="chart-head">
                <h3>Decision split</h3>
                <p>Current status + risk distribution</p>
              </div>
              <div className="dash-decision-grid">
                <div className="dash-decision-col">
                  <p className="dash-decision-label">By status</p>
                  <div className="dash-meter-stack">
                    {statusDistribution.map((item) => (
                      <div key={item.label} className="dash-meter-row">
                        <div className="dash-meter-head">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                        <div className="dash-meter-track">
                          <div
                            className={`dash-meter-fill dash-meter-fill-${item.tone}`}
                            style={{ width: meterWidth(item.value, transactions.length) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="dash-decision-col">
                  <p className="dash-decision-label">By risk band</p>
                  <div className="dash-meter-stack">
                    {riskDistribution.map((item) => (
                      <div key={item.label} className="dash-meter-row">
                        <div className="dash-meter-head">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                        <div className="dash-meter-track">
                          <div
                            className={`dash-meter-fill dash-meter-fill-${item.tone}`}
                            style={{ width: meterWidth(item.value, transactions.length) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <DashboardCharts
              scoreSeries={toScoreSeries(transactions)}
              volumeSeries={bucketByDay(transactions)}
            />

            <section className="dash-dual-grid">
              <article className="content-card">
                <div className="chart-head">
                  <h3>Priority queue</h3>
                  <p>Items that need immediate attention</p>
                </div>
                {priorityTransactions.length === 0 ? (
                  <p>No high-priority activity in the recent sample.</p>
                ) : (
                  <div className="dash-priority-list">
                    {priorityTransactions.map((item) => (
                      <article key={item.id} className="dash-priority-item">
                        <div>
                          <p className="dash-priority-title">
                            {item.merchant_name} • {currency(Number(item.amount))}
                          </p>
                          <p className="dash-priority-meta">
                            {formatDate(item.created_at)} • {item.country}
                          </p>
                        </div>
                        <div className="dash-priority-badges">
                          <span className="dash-risk-pill">Risk {item.risk_score}</span>
                          <Badge
                            tone={
                              item.status === "blocked"
                                ? "danger"
                                : item.status === "review"
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>

              <article className="content-card overflow-x">
                <div className="chart-head">
                  <h3>Latest transactions</h3>
                  <p>Showing most recent 5 records</p>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Merchant</th>
                      <th>Amount</th>
                      <th>Risk</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestTransactions.map((item) => (
                      <tr key={item.id}>
                        <td>{item.merchant_name}</td>
                        <td>{currency(Number(item.amount))}</td>
                        <td>{item.risk_score}</td>
                        <td>
                          <Badge
                            tone={
                              item.status === "blocked"
                                ? "danger"
                                : item.status === "review"
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td>{formatDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </section>
          </>
        )}
      </div>
    </>
  );
}
