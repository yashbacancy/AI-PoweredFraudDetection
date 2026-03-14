import { TopHeader } from "@/components/app/top-header";
import { AlertsHubClient } from "@/components/app/alerts-hub-client";
import { getLocalAlerts, getLocalApiIntegrations } from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export default async function AlertsHubPage() {
  const [alerts, integrations] = IS_LOCAL_DB_MODE
    ? await Promise.all([getLocalAlerts(120), getLocalApiIntegrations(40)])
    : [[], []];

  return (
    <>
      <TopHeader
        title="Alerts Hub"
        subtitle="Create, update, route, and close fraud alerts with full notification channel control."
      />
      <div className="page-content">
        {IS_LOCAL_DB_MODE ? (
          <AlertsHubClient initialAlerts={alerts} initialIntegrations={integrations} />
        ) : (
          <section className="content-card">
            <p>Full Alerts Hub CRUD is currently enabled in local mode.</p>
          </section>
        )}
      </div>
    </>
  );
}
