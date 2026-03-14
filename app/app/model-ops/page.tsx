import { TopHeader } from "@/components/app/top-header";
import { Badge } from "@/components/ui/badge";
import { getLocalModelRegistry } from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { formatDate } from "@/lib/utils";

export default async function ModelOpsPage() {
  const models = IS_LOCAL_DB_MODE ? await getLocalModelRegistry(20) : [];

  return (
    <>
      <TopHeader
        title="Model Ops"
        subtitle="Operate fraud model versions, rollout posture, and decision thresholds."
      />
      <div className="page-content stack-24">
        <section className="content-card overflow-x">
          <h3>Model Registry</h3>
          {models.length === 0 ? (
            <p>No model entries available in this mode.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Model Key</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Rollout</th>
                  <th>Review Threshold</th>
                  <th>Block Threshold</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id}>
                    <td>{model.model_key}</td>
                    <td>{model.version}</td>
                    <td>
                      <Badge
                        tone={
                          model.status === "active"
                            ? "success"
                            : model.status === "shadow"
                              ? "warning"
                              : "default"
                        }
                      >
                        {model.status}
                      </Badge>
                    </td>
                    <td>{model.rollout_percent}%</td>
                    <td>{model.review_threshold}</td>
                    <td>{model.block_threshold}</td>
                    <td>{formatDate(model.updated_at)}</td>
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
