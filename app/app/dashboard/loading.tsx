import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingDashboard() {
  return (
    <div className="page-content stack-24">
      <div className="stats-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="skeleton-card" />
        ))}
      </div>
      <Skeleton className="skeleton-table" />
    </div>
  );
}
