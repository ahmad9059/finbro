"use client";

import { LineChart } from "@mui/x-charts/LineChart";

import {
  ChartTheme,
  useChartAxis,
  useKindColors,
} from "~/components/charts/chart-theme";
import { Money } from "~/components/shared/money";
import { formatCompact, formatDate, formatPKR } from "~/lib/format";
import type { AssetKind } from "~/lib/portfolio";

const LABELS: Record<AssetKind, string> = {
  stock: "PSX Stocks",
  mutual_fund: "Mutual Funds",
  money_market: "Money Market",
  savings: "Savings",
};

export type KindSeries = {
  kind: AssetKind;
  points: { date: string; value: number }[];
};

/**
 * Where the value sat over time, stacked by asset kind. The donut answers
 * "what share today"; this answers "which share grew".
 */
export function ValueByKindChart({ series }: { series: KindSeries[] }) {
  const dates = [
    ...new Set(series.flatMap((item) => item.points.map((point) => point.date))),
  ].sort((a, b) => a.localeCompare(b));

  if (dates.length < 2) {
    return (
      <p className="py-10 text-center type-ui-sm text-muted-foreground">
        The split builds up from today, one point each evening.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
        <ChartTheme>
        <Inner series={series} dates={dates} />
      </ChartTheme>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {series.map((item) => (
          <LegendEntry key={item.kind} item={item} />
        ))}
      </ul>
    </div>
  );
}

function Inner({ series, dates }: { series: KindSeries[]; dates: string[] }) {
  const colors = useKindColors();
  const axis = useChartAxis();

  return (
    <LineChart
      height={230}
      margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
      hideLegend
      grid={{ horizontal: true }}
      series={series.map((item) => ({
        label: LABELS[item.kind],
        color: colors[item.kind],
        area: true,
        stack: "total",
        curve: "monotoneX",
        showMark: false,
        data: dates.map(
          (date) => item.points.find((point) => point.date === date)?.value ?? 0,
        ),
        valueFormatter: (value: number | null) => formatPKR(value ?? 0),
      }))}
      xAxis={[
        {
          scaleType: "point",
          data: dates,
          tickInterval: (_value: string, index: number) =>
            index % Math.max(1, Math.ceil(dates.length / 6)) === 0,
          valueFormatter: (date: string) => formatDate(date).replace(/ \d{4}$/, ""),
          ...axis,
        },
      ]}
      yAxis={[
        {
          width: 50,
          valueFormatter: (value: number) => formatCompact(value),
          ...axis,
        },
      ]}
      sx={{
        "& .MuiLineChart-area": { opacity: 0.2 },
        "& .MuiChartsGrid-line": { strokeDasharray: "3 3" },
        "& .MuiLineChart-line": { strokeWidth: 1.5 },
      }}
    />
  );
}

function LegendEntry({ item }: { item: KindSeries }) {
  const colors = useKindColors();
  const last = item.points[item.points.length - 1]?.value ?? 0;

  return (
    <li className="flex items-center gap-2 type-legal text-muted-foreground">
      <span
        className="size-2 rounded-full"
        style={{ background: colors[item.kind] }}
        aria-hidden="true"
      />
      {LABELS[item.kind]}
      <span className="tabular-nums text-foreground">
        <Money value={last} />
      </span>
    </li>
  );
}
