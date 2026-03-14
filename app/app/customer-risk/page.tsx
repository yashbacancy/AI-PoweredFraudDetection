import { TopHeader } from "@/components/app/top-header";
import { Badge } from "@/components/ui/badge";
import {
  getLocalChannelEvents,
  getLocalCustomerRiskProfile,
  getLocalIdentityVerifications,
} from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { formatDate } from "@/lib/utils";

export default async function CustomerRiskPage() {
  const [profile, identityChecks, channelEvents] = IS_LOCAL_DB_MODE
    ? await Promise.all([getLocalCustomerRiskProfile(), getLocalIdentityVerifications(10), getLocalChannelEvents(20)])
    : [null, [], []];

  const profileStats = profile
    ? [
        { label: "Risk Score", value: profile.risk_score },
        { label: "Total Transactions", value: profile.total_transactions },
        { label: "Blocked Transactions", value: profile.blocked_transactions },
        { label: "Review Transactions", value: profile.review_transactions },
      ]
    : [];

  return (
    <>
      <TopHeader
        title="Customer Risk"
        subtitle="Manage customer-level posture, identity verification confidence, and channel activity."
      />
      <div className="page-content stack-24">
        {profile ? (
          <>
            <section className="content-card stat-inline">
              <p>
                Risk tier:{" "}
                <Badge
                  tone={
                    profile.risk_tier === "high"
                      ? "danger"
                      : profile.risk_tier === "medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {profile.risk_tier}
                </Badge>
              </p>
              <p>Profile updated {formatDate(profile.updated_at)}</p>
            </section>
            <section className="stats-grid">
              {profileStats.map((stat) => (
                <article key={stat.label} className="content-card stat-card">
                  <div className="stat-head">
                    <span>{stat.label}</span>
                  </div>
                  <h3>{stat.value}</h3>
                </article>
              ))}
            </section>
          </>
        ) : (
          <section className="content-card">
            <p>No customer risk profile available in this mode.</p>
          </section>
        )}

        <section className="content-card overflow-x">
          <h3>Identity Verification</h3>
          {identityChecks.length === 0 ? (
            <p>No identity verification records found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Verified</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {identityChecks.map((check) => (
                  <tr key={check.id}>
                    <td>{check.provider}</td>
                    <td>
                      {check.document_type ?? "n/a"}
                      {check.document_country ? ` (${check.document_country})` : ""}
                    </td>
                    <td>
                      <Badge
                        tone={
                          check.status === "verified"
                            ? "success"
                            : check.status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {check.status}
                      </Badge>
                    </td>
                    <td>{check.confidence_score}</td>
                    <td>{check.verified_at ? formatDate(check.verified_at) : "n/a"}</td>
                    <td>{formatDate(check.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="content-card overflow-x">
          <h3>Recent Channel Events</h3>
          {channelEvents.length === 0 ? (
            <p>No channel events were generated.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Event</th>
                  <th>Transaction</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {channelEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.channel}</td>
                    <td>{event.event_type}</td>
                    <td>{event.transaction_id ?? "n/a"}</td>
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
