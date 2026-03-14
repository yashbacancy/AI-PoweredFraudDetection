import { TopHeader } from "@/components/app/top-header";
import { Badge } from "@/components/ui/badge";
import { getLocalChargebackStats, getLocalComplianceReports } from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { currency, formatDate } from "@/lib/utils";

export default async function CompliancePage() {
  const [reports, chargebackStats] = IS_LOCAL_DB_MODE
    ? await Promise.all([getLocalComplianceReports(20), getLocalChargebackStats()])
    : [
        [],
        {
          total_chargebacks: 0,
          disputed_chargebacks: 0,
          won_chargebacks: 0,
          lost_chargebacks: 0,
          recovered_amount: 0,
        },
      ];

  const statCards = [
    { label: "Total Chargebacks", value: chargebackStats.total_chargebacks },
    { label: "Disputed", value: chargebackStats.disputed_chargebacks },
    { label: "Won", value: chargebackStats.won_chargebacks },
    { label: "Lost", value: chargebackStats.lost_chargebacks },
  ];

  return (
    <>
      <TopHeader
        title="Compliance"
        subtitle="Track generated reports and chargeback outcomes used for audit and governance."
      />
      <div className="page-content stack-24">
        <section className="stats-grid">
          {statCards.map((card) => (
            <article key={card.label} className="content-card stat-card">
              <div className="stat-head">
                <span>{card.label}</span>
              </div>
              <h3>{card.value}</h3>
            </article>
          ))}
        </section>

        <section className="content-card stat-inline">
          <p>
            Recovered amount: <strong>{currency(chargebackStats.recovered_amount)}</strong>
          </p>
        </section>

        <section className="content-card overflow-x">
          <h3>Compliance Reports</h3>
          {reports.length === 0 ? (
            <p>No compliance reports are available in this mode.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Report Type</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.report_type}</td>
                    <td>
                      {report.period_start} to {report.period_end}
                    </td>
                    <td>
                      <Badge
                        tone={
                          report.status === "submitted"
                            ? "success"
                            : report.status === "generated"
                              ? "warning"
                              : "default"
                        }
                      >
                        {report.status}
                      </Badge>
                    </td>
                    <td>{report.generated_at ? formatDate(report.generated_at) : "n/a"}</td>
                    <td>{formatDate(report.updated_at)}</td>
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
