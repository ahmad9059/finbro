"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "~/components/shared/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatDate, formatPKR } from "~/lib/format";
import { LineChart } from "lucide-react";

const config = {
  value: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

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
        icon={LineChart}
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

      <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="networth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value: string) => formatDate(value).slice(0, 6)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatPKR(Number(value))}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#networth)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
