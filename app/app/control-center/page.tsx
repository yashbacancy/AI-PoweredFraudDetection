import Link from "next/link";
import { ArrowRight, BellRing, BrainCircuit, FileCheck, ListFilter, Network, SlidersHorizontal, UsersRound } from "lucide-react";

import { AlertsHubClient } from "@/components/app/alerts-hub-client";
import { RiskRulesClient } from "@/components/app/risk-rules-client";
import { TopHeader } from "@/components/app/top-header";
import {
  getLocalAlerts,
  getLocalApiIntegrations,
  getLocalFeatureMetrics,
  getLocalModelRegistry,
  getLocalRiskRules,
} from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import {
  getSupabaseAlerts,
  getSupabaseApiIntegrations,
  getSupabaseFeatureMetrics,
  getSupabaseModelRegistry,
  getSupabaseRiskRules,
} from "@/lib/supabase/management-repository";

const menus = [
  {
    title: "Risk Rules",
    description: "Tune threshold and velocity controls.",
    href: "/app/risk-rules",
    icon: SlidersHorizontal,
  },
  {
    title: "Watchlists",
    description: "Manage whitelist and blacklist entities.",
    href: "/app/watchlists",
    icon: ListFilter,
  },
  {
    title: "Model Ops",
    description: "Track active and shadow model versions.",
    href: "/app/model-ops",
    icon: BrainCircuit,
  },
  {
    title: "Alerts Hub",
    description: "Review alert traffic and routing channels.",
    href: "/app/alerts-hub",
    icon: BellRing,
  },
  {
    title: "Compliance",
    description: "Inspect report health and chargeback posture.",
    href: "/app/compliance",
    icon: FileCheck,
  },
  {
    title: "Graph",
    description: "Explore relationship and ring signals.",
    href: "/app/graph",
    icon: Network,
  },
  {
    title: "Customer Risk",
    description: "Monitor risk tiers and channel activity.",
    href: "/app/customer-risk",
    icon: UsersRound,
  },
];

export default async function ControlCenterPage() {
  const [metrics, rules, models, alerts, integrations] = await Promise.all(
    IS_LOCAL_DB_MODE
      ? [
          getLocalFeatureMetrics(),
          getLocalRiskRules(24),
          getLocalModelRegistry(10),
          getLocalAlerts(20),
          getLocalApiIntegrations(20),
        ]
      : [
          getSupabaseFeatureMetrics(),
          getSupabaseRiskRules(24),
          getSupabaseModelRegistry(10),
          getSupabaseAlerts(20),
          getSupabaseApiIntegrations(20),
        ],
  );

  return (
    <>
      <TopHeader
        title="Feature Control Center"
        subtitle="Smart menus for operating fraud controls, models, alerts, and governance workflows."
      />
      <div className="page-content stack-24">
        <section className="menu-grid">
          {menus.map((menu) => {
            const Icon = menu.icon;
            return (
              <Link key={menu.href} href={menu.href} className="menu-link">
                <div className="menu-link-head">
                  <Icon size={16} />
                  <ArrowRight size={16} />
                </div>
                <h3>{menu.title}</h3>
                <p>{menu.description}</p>
              </Link>
            );
          })}
        </section>

        <section className="content-card">
          <h3>Feature Health Snapshot</h3>
          {metrics.length === 0 ? (
            <p>No feature metrics available yet.</p>
          ) : (
            <div className="stats-grid" style={{ marginTop: 12 }}>
              {metrics.map((metric) => (
                <article key={metric.feature} className="content-card stat-card">
                  <div className="stat-head">
                    <span>{metric.feature}</span>
                  </div>
                  <h3>{metric.count}</h3>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-card">
          <h3>Control Center CRUD: Risk Rules</h3>
          <p style={{ marginTop: 6, marginBottom: 12 }}>
            Manage rules directly here or use the dedicated Risk Rules page for expanded operations.
          </p>
          <RiskRulesClient initialRules={rules} initialModels={models} compact />
        </section>

        <section className="content-card">
          <h3>Control Center CRUD: Alerts + Integrations</h3>
          <p style={{ marginTop: 6, marginBottom: 12 }}>
            Operate alert queue and routing integrations from the central control console.
          </p>
          <AlertsHubClient initialAlerts={alerts} initialIntegrations={integrations} compact />
        </section>
      </div>
    </>
  );
}
