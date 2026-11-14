"use client";

import { Money } from "~/components/shared/money";
import { formatPercent } from "~/lib/format";

export type CategoryTotal = {
  categoryId: number;
  name: string;
  total: number;
  share: number;
};

/** Horizontal bars, largest first. One colour, so nothing depends on hue. */
export function CategoryBars({ data }: { data: CategoryTotal[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center type-ui-sm text-muted-foreground">
        Nothing spent in this month.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {data.map((row) => (
        <li key={row.categoryId} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate type-ui-sm">{row.name}</span>
            <span className="shrink-0 tabular-nums type-legal text-muted-foreground">
              <Money value={row.total} /> · {formatPercent(row.share, { signed: false })}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${Math.max(row.share * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
