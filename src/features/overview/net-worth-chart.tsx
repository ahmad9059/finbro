"use client";

import { LineChart } from "@mui/x-charts/LineChart";
import { LineChart as LineIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ChartTheme,
  useChartAxis,
  useChartColors,
} from "~/components/charts/chart-theme";
import { EmptyState } from "~/components/shared/empty-state";
import { Delta } from "~/components/shared/money";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCompact, formatDate, formatPKR } from "~/lib/format";

const RANGES = ["1M", "3M", "1Y", "All"] as const;
type Range = (typeof RANGES)[number];

const DAYS: Record<Range, number | null> = {
  "1M": 31,
  "3M": 92,
  "1Y": 366,
  All: null,
};

export type NetWorthPoint = { date: string; value: number; invested: number };

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const [range, setRange] = useState<Range>("3M");

  const points = useMemo(() => {
    const days = DAYS[range];
    if (!days || data.length === 0) return data;
    const last = data[data.length - 1]!.date;
    const cutoff = new Date(`${last}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const from = cutoff.toISOString().slice(0, 10);
    return data.filter((point) => point.date >= from);
  }, [data, range]);

  if (data.length < 2) {
    return (
      <EmptyState
        icon={LineIcon}
        title="Your net-worth history builds up from today. One point is added each evening."
      />
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last ? last.value - first.value : 0;
  const ratio = first && first.value > 0 ? change / first.value : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Delta value={change} ratio={ratio} className="type-ui-sm" />
          <span className="type-legal text-muted-foreground">
            {first && last
              ? `${formatDate(first.date)} to ${formatDate(last.date)}`
              : ""}
          </span>
        </div>
        <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
          <TabsList>
            {RANGES.map((option) => (
              <TabsTrigger key={option} value={option}>
                {option}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <ChartTheme>
        <Inner points={points} />
      </ChartTheme>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 type-legal text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-chart-1" aria-hidden="true" />
          Value
        </li>
        <li className="flex items-center gap-2">
          <span
            className="h-0 w-4 border-t-2 border-dashed border-muted-foreground"
            aria-hidden="true"
          />
          Invested
        </li>
      </ul>
    </div>
  );
}

function Inner({ points }: { points: NetWorthPoint[] }) {
  const colors = useChartColors();
  const axis = useChartAxis();

  // Start the axis near the data instead of at zero, so a 2% move is visible.
  const values = points.flatMap((p) => [p.value, p.invested]).filter((v) => v > 0);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max((high - low) * 0.15, high * 0.01);

  return (
    <LineChart
      height={260}
      margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
      hideLegend
      grid={{ horizontal: true }}
      series={[
        {
          id: "value",
          data: points.map((point) => point.value),
          label: "Value",
          color: colors[0],
          area: true,
          curve: "monotoneX",
          showMark: false,
          valueFormatter: (value: number | null) => formatPKR(value ?? 0),
        },
        {
          id: "invested",
          data: points.map((point) => point.invested),
          label: "Invested",
          color: colors[3],
          curve: "stepAfter",
          showMark: false,
          valueFormatter: (value: number | null) => formatPKR(value ?? 0),
        },
      ]}
      xAxis={[
        {
          scaleType: "point",
          data: points.map((point) => point.date),
          tickInterval: (_value: string, index: number) =>
            index % Math.max(1, Math.ceil(points.length / 5)) === 0,
          valueFormatter: (date: string) => formatDate(date).replace(/ \d{4}$/, ""),
          ...axis,
        },
      ]}
      yAxis={[
        {
          width: 52,
          min: Math.max(0, Math.floor((low - pad) / 1000) * 1000),
          max: Math.ceil((high + pad) / 1000) * 1000,
          valueFormatter: (value: number) => formatCompact(value),
          ...axis,
        },
      ]}
      sx={{
        "& .MuiLineChart-area": { opacity: 0.16 },
        "& .MuiChartsGrid-line": { strokeDasharray: "3 3" },
        "& .MuiLineChart-line": { strokeWidth: 2 },
        '& [data-series-id="invested"]': {
          strokeDasharray: "5 5",
          strokeWidth: 1.5,
        },
      }}
    />
  );
}
