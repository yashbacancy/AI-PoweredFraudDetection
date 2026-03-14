"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VolumePoint } from "@/lib/chart-utils";

export function TransactionVolumeChart({ data }: { data: VolumePoint[] }) {
  if (data.length === 0) {
    return <p className="chart-empty">No data to display.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "#6E7681", fontFamily: "ui-monospace,monospace" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 9, fill: "#6E7681", fontFamily: "ui-monospace,monospace" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#161B22",
            border: "1px solid #30363D",
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "ui-monospace,monospace",
            color: "#E6EDF3",
          }}
          labelStyle={{ color: "#8B949E" }}
          cursor={{ fill: "#21262D" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: "ui-monospace,monospace", color: "#6E7681" }}
        />
        <Bar dataKey="total" name="Total" fill="#58A6FF" radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar dataKey="review" name="Review" fill="#D29922" radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar dataKey="blocked" name="Blocked" fill="#F78166" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
