import { Skeleton } from "~/components/ui/skeleton";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg bg-card shadow-soft">
      <div className="flex h-11 items-center border-b px-6">
        <Skeleton className="h-3 w-28" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex h-[52px] items-center justify-between gap-6 border-b px-6 last:border-0"
        >
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
