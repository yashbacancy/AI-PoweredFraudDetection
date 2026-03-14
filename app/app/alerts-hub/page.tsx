import { TopHeader } from "@/components/app/top-header";
import { AlertsHubClient } from "@/components/app/alerts-hub-client";
import { getLocalAlerts, getLocalApiIntegrations } from "@/lib/local/management-repository";
import { getSupabaseAlerts, getSupabaseApiIntegrations } from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export default async function AlertsHubPage() {
  const [alerts, integrations] = await Promise.all(
    IS_LOCAL_DB_MODE
      ? [getLocalAlerts(120), getLocalApiIntegrations(40)]
      : [getSupabaseAlerts(120), getSupabaseApiIntegrations(40)],
  );

  return (
    <>
      <TopHeader
        title="Alerts Hub"
        subtitle="Create, update, route, and close fraud alerts with full notification channel control."
      />
      <div className="page-content">
        <AlertsHubClient initialAlerts={alerts} initialIntegrations={integrations} />
      </div>
    </>
  );
}
