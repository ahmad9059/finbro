import { Clock } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { daysBetween, todayPK } from "~/lib/dates";
import { formatDate } from "~/lib/format";
import { cn } from "~/lib/utils";

const STALE_AFTER_DAYS = 3;

/** Shows how old a price is, and flags it when it is getting old. */
export function PriceTag({
  asOf,
  source,
  className,
}: {
  asOf: string | null;
  source: "auto" | "manual" | null;
  className?: string;
}) {
  if (!asOf) {
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        No price
      </Badge>
    );
  }

  const age = daysBetween(asOf, todayPK());
  const stale = age > STALE_AFTER_DAYS;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 type-legal text-muted-foreground",
        stale && "text-loss",
        className,
      )}
      title={`${source === "manual" ? "Entered by hand" : "Fetched automatically"} · ${formatDate(asOf)}`}
    >
      <Clock className="size-3" aria-hidden="true" />
      {stale ? "Stale · " : ""}
      {formatDate(asOf).replace(/ \d{4}$/, "")}
    </span>
  );
}
