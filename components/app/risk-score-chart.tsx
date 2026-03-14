"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ScorePoint } from "@/lib/chart-utils";

export function RiskScoreChart({ data }: { data: ScorePoint[] }) {
  if (data.length === 0) {
    return <p className="chart-empty">No data to display.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "#6E7681", fontFamily: "ui-monospace,monospace" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
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
          cursor={{ stroke: "#30363D" }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#F97316"
          strokeWidth={2}
          fill="url(#scoreGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#F97316", stroke: "#0D1117", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
