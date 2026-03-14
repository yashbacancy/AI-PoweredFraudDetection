import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingTransactions() {
  return (
    <div className="page-content stack-24">
      <Skeleton className="skeleton-card" />
      <Skeleton className="skeleton-table" />
    </div>
  );
}
