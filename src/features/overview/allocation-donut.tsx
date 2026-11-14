"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Money } from "~/components/shared/money";
import { formatPKR, formatPercent } from "~/lib/format";
import type { AssetKind } from "~/lib/portfolio";

const LABELS: Record<AssetKind, string> = {
  stock: "PSX Stocks",
  mutual_fund: "Mutual Funds",
  money_market: "Money Market",
  savings: "Savings",
};

const COLORS: Record<AssetKind, string> = {
  stock: "var(--chart-1)",
  mutual_fund: "var(--chart-2)",
  money_market: "var(--chart-4)",
  savings: "var(--chart-3)",
};

export type AllocationSlice = {
  kind: AssetKind;
  marketValue: number;
  share: number;
  count: number;
};

const config = {
  stock: { label: LABELS.stock, color: COLORS.stock },
  mutual_fund: { label: LABELS.mutual_fund, color: COLORS.mutual_fund },
  money_market: { label: LABELS.money_market, color: COLORS.money_market },
  savings: { label: LABELS.savings, color: COLORS.savings },
} satisfies ChartConfig;

export function AllocationDonut({
  data,
  total,
}: {
  data: AllocationSlice[];
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative w-[180px] shrink-0">
        <ChartContainer config={config} className="aspect-square h-[180px] w-[180px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value) => formatPKR(Number(value))}
                />
              }
            />
            <Pie
              data={data}
              dataKey="marketValue"
              nameKey="kind"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((slice) => (
                <Cell key={slice.kind} fill={COLORS[slice.kind]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-eyebrow text-muted-foreground">Total</span>
          <span className="mt-1 text-ui-sm tabular-nums">
            <Money value={total} />
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-3">
        {data.length === 0 ? (
          <li className="text-ui-sm text-muted-foreground">Nothing to show yet.</li>
        ) : null}
        {data.map((slice) => (
          <li key={slice.kind} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: COLORS[slice.kind] }}
                aria-hidden="true"
              />
              <span className="truncate text-ui-sm">{LABELS[slice.kind]}</span>
            </span>
            <span className="shrink-0 tabular-nums text-legal text-muted-foreground">
              <Money value={slice.marketValue} /> ·{" "}
              {formatPercent(slice.share, { signed: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
