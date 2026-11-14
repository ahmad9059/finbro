import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

/** Mercury's stat-block: eyebrow label, large numeral, optional line below. */
export function KpiCard({
  label,
  value,
  footer,
  hero = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Usually a <Delta /> or a short hint. */
  footer?: React.ReactNode;
  /** Use the largest numeral size. One per page at most. */
  hero?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg bg-tint p-6 text-tint-foreground",
        className,
      )}
    >
      <p className="type-eyebrow text-muted-foreground">{label}</p>
      <p
        className={cn(
          "truncate tabular-nums",
          hero ? "type-hero" : "type-title",
        )}
      >
        {value}
      </p>
      {footer ? (
        <div className="type-ui-sm text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}

export function KpiGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <KpiGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg bg-tint p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </KpiGrid>
  );
}
