import { notFound } from "next/navigation";

import { RiskBreakdown } from "@/components/app/risk-breakdown";
import { TopHeader } from "@/components/app/top-header";
import { Badge } from "@/components/ui/badge";
import { getLocalTransactionDetail } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import { currency, formatDate } from "@/lib/utils";
import type { TransactionDetail } from "@/lib/local/repository";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail: TransactionDetail | null = null;

  if (IS_LOCAL_DB_MODE) {
    detail = await getLocalTransactionDetail(id);
  } else {
    const supabase = await createClient();
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (tx) {
      const { data: rs } = await supabase
        .from("risk_scores" as never)
        .select("model_version, reason_codes, explanation")
        .eq("transaction_id" as never, id)
        .maybeSingle();

      const rsData = rs as { model_version?: string; reason_codes?: string[]; explanation?: Record<string, unknown> } | null;
      const breakdown = rsData?.explanation?.["feature_breakdown"] as Record<string, number> | null ?? null;

      detail = {
        ...tx,
        model_version: rsData?.model_version ?? null,
        reason_codes: rsData?.reason_codes ?? null,
        breakdown,
        explanation: rsData?.explanation ?? null,
      } as TransactionDetail;
    }
  }

  if (!detail) notFound();

  const statusTone =
    detail.status === "blocked" ? "danger" : detail.status === "review" ? "warning" : "success";

  const fields = [
    { label: "Transaction ID", value: detail.id },
    { label: "Merchant", value: detail.merchant_name },
    { label: "Amount", value: currency(Number(detail.amount)) },
    { label: "Payment Method", value: detail.payment_method },
    { label: "Country", value: detail.country },
    { label: "IP Address", value: detail.ip_address || "n/a" },
    { label: "Device ID", value: detail.device_id },
    { label: "Model Version", value: detail.model_version ?? "n/a" },
    { label: "Created", value: formatDate(detail.created_at) },
  ];

  return (
    <>
      <TopHeader
        title="Transaction Detail"
        subtitle={`Risk analysis for ${detail.merchant_name}`}
      />

      <div className="page-content stack-24">
        <section className="content-card">
          <div className="txn-detail-head">
            <div>
              <h3 className="txn-detail-title">{detail.merchant_name}</h3>
              <p className="txn-detail-sub">{formatDate(detail.created_at)}</p>
            </div>
            <div className="txn-detail-badges">
              <span className="txn-risk-score">Risk {detail.risk_score}</span>
              <Badge tone={statusTone}>{detail.status}</Badge>
            </div>
          </div>

          <dl className="txn-field-grid">
            {fields.map(({ label, value }) => (
              <div key={label} className="txn-field">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {detail.breakdown && Object.keys(detail.breakdown).length > 0 ? (
          <section className="content-card">
            <div className="chart-head">
              <h3>XAI Score Breakdown</h3>
              <p>Feature contributions to the final risk score of {detail.risk_score}</p>
            </div>
            <RiskBreakdown
              breakdown={detail.breakdown}
              reasonCodes={detail.reason_codes ?? []}
              score={detail.risk_score}
            />
          </section>
        ) : (
          <section className="content-card">
            <p>No score breakdown available for this transaction.</p>
          </section>
        )}

        {detail.explanation && (
          <section className="content-card">
            <div className="chart-head">
              <h3>Signal Context</h3>
              <p>Raw signals used during scoring</p>
            </div>
            <dl className="txn-field-grid">
              {Object.entries(detail.explanation)
                .filter(([k]) => k !== "feature_breakdown")
                .map(([key, val]) => (
                  <div key={key} className="txn-field">
                    <dt>{key.replace(/_/g, " ")}</dt>
                    <dd>{String(val ?? "n/a")}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}
      </div>
    </>
  );
}
