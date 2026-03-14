import type { Transaction } from "@/lib/types";

export type ScorePoint = { date: string; score: number };
export type VolumePoint = { date: string; total: number; blocked: number; review: number };

function toDateKey(dateInput: string | Date | undefined): string {
  const d = new Date(dateInput as string);
  return isNaN(d.getTime()) ? "unknown" : d.toISOString().slice(0, 10);
}

export function toScoreSeries(transactions: Transaction[]): ScorePoint[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime(),
  );
  return sorted.map((t) => ({
    date: toDateKey(t.created_at as string),
    score: t.risk_score,
  }));
}

export function bucketByDay(transactions: Transaction[]): VolumePoint[] {
  const map = new Map<string, VolumePoint>();

  for (const t of transactions) {
    const key = toDateKey(t.created_at as string);
    const existing = map.get(key) ?? { date: key, total: 0, blocked: 0, review: 0 };
    existing.total += 1;
    if (t.status === "blocked") existing.blocked += 1;
    if (t.status === "review") existing.review += 1;
    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
