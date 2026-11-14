import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { formatPKR, formatPercent } from "~/lib/format";
import { cn } from "~/lib/utils";

/** A PKR amount in tabular figures. */
export function Money({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatPKR(value, { decimals })}
    </span>
  );
}

/**
 * A gain or loss. Direction is carried by the sign and the arrow as well as
 * the colour, so it never depends on colour alone.
 */
export function Delta({
  value,
  ratio,
  decimals = 0,
  invert = false,
  className,
}: {
  value: number;
  /** Optional ratio shown in brackets, e.g. 0.07 → (+7.0%). */
  ratio?: number;
  decimals?: number;
  /** Treat an increase as bad (used for spending). */
  invert?: boolean;
  className?: string;
}) {
  const up = value > 0;
  const flat = value === 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        flat ? "text-muted-foreground" : good ? "text-gain" : "text-loss",
        className,
      )}
    >
      {flat ? null : <Icon className="size-4 shrink-0" aria-hidden="true" />}
      <span>
        {formatPKR(value, { decimals, signed: true })}
        {ratio === undefined ? null : ` (${formatPercent(ratio)})`}
      </span>
    </span>
  );
}
