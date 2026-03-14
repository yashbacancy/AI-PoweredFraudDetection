"use client";

type Props = {
  breakdown: Record<string, number>;
  reasonCodes: string[];
  score: number;
};

const BUCKET_TONE: Record<string, string> = {
  base: "neutral",
  watchlist: "danger",
  account_takeover: "danger",
  velocity: "warning",
  geolocation: "warning",
  amount: "warning",
  rules: "warning",
  device: "warning",
  payment: "neutral",
  behavior: "warning",
  identity: "success",
  customer: "neutral",
  chargeback: "danger",
  channel: "neutral",
  allowlist: "success",
};

function toneColor(tone: string) {
  if (tone === "danger") return "var(--danger, #F78166)";
  if (tone === "warning") return "var(--warning, #D29922)";
  if (tone === "success") return "var(--success, #3FB950)";
  return "var(--text-muted, #8B949E)";
}

export function RiskBreakdown({ breakdown, reasonCodes, score }: Props) {
  const total = Math.max(score, 1);
  const entries = Object.entries(breakdown).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  return (
    <div className="risk-breakdown">
      <div className="risk-breakdown-bars">
        {entries.map(([bucket, points]) => {
          const tone = BUCKET_TONE[bucket] ?? "neutral";
          const pct = Math.min(100, Math.max(4, (Math.abs(points) / total) * 100));
          return (
            <div key={bucket} className="risk-breakdown-row">
              <div className="risk-breakdown-meta">
                <span className="risk-breakdown-label">{bucket.replace(/_/g, " ")}</span>
                <span className="risk-breakdown-pts" style={{ color: toneColor(tone) }}>
                  {points > 0 ? "+" : ""}
                  {points} pts
                </span>
              </div>
              <div className="risk-breakdown-track">
                <div
                  className="risk-breakdown-fill"
                  style={{ width: `${pct}%`, background: toneColor(tone) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {reasonCodes.length > 0 && (
        <div className="risk-reason-codes">
          <p className="risk-reason-title">Reason codes</p>
          <div className="risk-reason-chips">
            {reasonCodes.map((code) => (
              <span key={code} className="risk-reason-chip">
                {code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
