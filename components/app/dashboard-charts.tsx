"use client";

import dynamic from "next/dynamic";
import type { ScorePoint, VolumePoint } from "@/lib/chart-utils";

const RiskScoreChart = dynamic(
  () => import("@/components/app/risk-score-chart").then((m) => m.RiskScoreChart),
  { ssr: false },
);

const TransactionVolumeChart = dynamic(
  () => import("@/components/app/transaction-volume-chart").then((m) => m.TransactionVolumeChart),
  { ssr: false },
);

type Props = {
  scoreSeries: ScorePoint[];
  volumeSeries: VolumePoint[];
};

export function DashboardCharts({ scoreSeries, volumeSeries }: Props) {
  return (
    <section className="dash-dual-grid chart-row">
      <article className="content-card">
        <div className="chart-head">
          <h3>Risk score over time</h3>
          <p>Score trend across the recent transaction window</p>
        </div>
        <RiskScoreChart data={scoreSeries} />
      </article>
      <article className="content-card">
        <div className="chart-head">
          <h3>Transaction volume by day</h3>
          <p>Total, review, and blocked counts per day</p>
        </div>
        <TransactionVolumeChart data={volumeSeries} />
      </article>
    </section>
  );
}
