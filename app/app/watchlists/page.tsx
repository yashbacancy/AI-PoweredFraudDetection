import { TopHeader } from "@/components/app/top-header";
import { Badge } from "@/components/ui/badge";
import { getLocalSecurityEvents, getLocalWatchlist } from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { formatDate } from "@/lib/utils";

export default async function WatchlistsPage() {
  const [entries, securityEvents] = IS_LOCAL_DB_MODE
    ? await Promise.all([getLocalWatchlist(), getLocalSecurityEvents(15)])
    : [[], []];

  return (
    <>
      <TopHeader
        title="Watchlists"
        subtitle="Control trusted and blocked entities, then monitor account-security activity in one place."
      />
      <div className="page-content stack-24">
        <section className="content-card overflow-x">
          <h3>Whitelist / Blacklist Entries</h3>
          {entries.length === 0 ? (
            <p>No watchlist entries available in this mode.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>List</th>
                  <th>Entity</th>
                  <th>Value</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <Badge tone={entry.list_type === "blacklist" ? "danger" : "success"}>
                        {entry.list_type}
                      </Badge>
                    </td>
                    <td>{entry.entity_type}</td>
                    <td>{entry.entity_value}</td>
                    <td>{entry.reason ?? "n/a"}</td>
                    <td>
                      <Badge tone={entry.is_active ? "warning" : "default"}>
                        {entry.is_active ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td>{entry.expires_at ? formatDate(entry.expires_at) : "no expiry"}</td>
                    <td>{formatDate(entry.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="content-card overflow-x">
          <h3>Recent Account Security Events</h3>
          {securityEvents.length === 0 ? (
            <p>No account security events were found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Channel</th>
                  <th>IP</th>
                  <th>Country</th>
                  <th>Device</th>
                  <th>Risk Hint</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.event_type}</td>
                    <td>{event.channel}</td>
                    <td>{event.ip_address || "n/a"}</td>
                    <td>{event.country || "n/a"}</td>
                    <td>{event.device_id || "n/a"}</td>
                    <td>{event.risk_hint}</td>
                    <td>{formatDate(event.occurred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
