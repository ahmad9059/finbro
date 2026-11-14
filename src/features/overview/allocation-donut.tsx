"use client";

import { PieChart } from "@mui/x-charts/PieChart";

import { Money } from "~/components/shared/money";
import { ChartTheme, useKindColors } from "~/components/charts/chart-theme";
import { formatPKR, formatPercent } from "~/lib/format";
import type { AssetKind } from "~/lib/portfolio";

const LABELS: Record<AssetKind, string> = {
  stock: "PSX Stocks",
  mutual_fund: "Mutual Funds",
  money_market: "Money Market",
  savings: "Savings",
};

export type AllocationSlice = {
  kind: AssetKind;
  marketValue: number;
  share: number;
  count: number;
};

export function AllocationDonut({
  data,
  total,
}: {
  data: AllocationSlice[];
  total: number;
}) {
  return (
    <ChartTheme>
      <Inner data={data} total={total} />
    </ChartTheme>
  );
}

function Inner({ data, total }: { data: AllocationSlice[]; total: number }) {
  const colors = useKindColors();
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const colorFor = (kind: AssetKind) => colors[kind];

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-[190px] shrink-0">
        <PieChart
          height={190}
          width={190}
          hideLegend
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
          series={[
            {
              data: data.map((slice) => ({
                id: slice.kind,
                value: slice.marketValue,
                label: LABELS[slice.kind],
                color: colorFor(slice.kind),
              })),
              innerRadius: 62,
              outerRadius: 90,
              paddingAngle: 2,
              cornerRadius: 3,
              valueFormatter: (item) => formatPKR(item.value),
              highlightScope: { fade: "global", highlight: "item" },
              faded: { additionalRadius: -4 },
            },
          ]}
          sx={{
            "& .MuiChartsTooltip-cell": { paddingRight: 2 },
            "& .MuiPieArc-root": {
              transition: "opacity 150ms ease, transform 150ms ease",
            },
            // A hairline in the card colour separates the arcs.
            "& .MuiPieArc-root path, & .MuiPieArc-root": {
              stroke: isDark ? "#1e1e2a" : "#ffffff",
              strokeWidth: 2,
            },
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="type-eyebrow text-muted-foreground">Total</span>
          <span className="type-ui-sm tabular-nums">
            <Money value={total} />
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-3">
        {data.length === 0 ? (
          <li className="type-ui-sm text-muted-foreground">Nothing to show yet.</li>
        ) : null}
        {data.map((slice) => (
          <li
            key={slice.kind}
            className="flex items-center justify-between gap-3 rounded-sm px-1 py-0.5 transition-colors hover:bg-accent"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: colorFor(slice.kind) }}
                aria-hidden="true"
              />
              <span className="truncate type-ui-sm">{LABELS[slice.kind]}</span>
            </span>
            <span className="shrink-0 tabular-nums type-legal text-muted-foreground">
              <Money value={slice.marketValue} /> ·{" "}
              {formatPercent(slice.share, { signed: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
