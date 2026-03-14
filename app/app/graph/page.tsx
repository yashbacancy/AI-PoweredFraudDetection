import { TopHeader } from "@/components/app/top-header";
import { GraphCanvas } from "@/components/app/graph-canvas";
import { getLocalGraphEdges, getLocalGraphSignalMetrics } from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export default async function GraphPage() {
  const [signalMetrics, edges] = IS_LOCAL_DB_MODE
    ? await Promise.all([getLocalGraphSignalMetrics(), getLocalGraphEdges(80)])
    : [[], []];

  return (
    <>
      <TopHeader
        title="Graph Intelligence"
        subtitle="Analyze linked entities and suspicious relationship signals across transactions."
      />
      <div className="page-content stack-24">
        {edges.length > 0 ? (
          <section className="content-card">
            <div className="chart-head">
              <h3>Fraud Ring Visualization</h3>
              <p>Click a node to highlight its connections. Node size reflects degree centrality.</p>
            </div>
            <div className="graph-canvas-wrap">
              <GraphCanvas edges={edges} />
            </div>
          </section>
        ) : (
          <section className="content-card">
            <p>No graph data available. Create transactions to generate relationship edges.</p>
          </section>
        )}

        {signalMetrics.length > 0 && (
          <section className="content-card overflow-x">
            <h3>Top Graph Signals</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Edges</th>
                </tr>
              </thead>
              <tbody>
                {signalMetrics.map((row) => (
                  <tr key={row.signal}>
                    <td>{row.signal}</td>
                    <td>{row.edge_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
