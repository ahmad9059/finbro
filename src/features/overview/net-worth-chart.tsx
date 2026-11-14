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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatDate, formatPKR } from "~/lib/format";

const RANGES = ["1M", "3M", "1Y", "All"] as const;
type Range = (typeof RANGES)[number];

const DAYS: Record<Range, number | null> = {
  "1M": 31,
  "3M": 92,
  "1Y": 366,
  All: null,
};

export function NetWorthChart({
  data,
}: {
  data: { date: string; value: number }[];
}) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
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
    </div>
  );
}

function Inner({ points }: { points: { date: string; value: number }[] }) {
  const colors = useChartColors();
  const axis = useChartAxis();

  return (
    <LineChart
      height={240}
      margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
      hideLegend
      grid={{ horizontal: true }}
      series={[
        {
          data: points.map((point) => point.value),
          label: "Net worth",
          color: colors[0],
          area: true,
          curve: "monotoneX",
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
          width: 46,
          valueFormatter: (value: number) =>
            value >= 1000 ? `${Math.round(value / 1000)}k` : String(value),
          ...axis,
        },
      ]}
      sx={{
        "& .MuiLineChart-area": { opacity: 0.18 },
        "& .MuiChartsGrid-line": { strokeDasharray: "3 3" },
        "& .MuiLineChart-line": { strokeWidth: 2 },
      }}
    />
  );
}
