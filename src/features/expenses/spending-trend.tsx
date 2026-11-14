"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { formatMonthShort } from "~/lib/dates";
import { formatPKR } from "~/lib/format";

const config = {
  total: { label: "Spent", color: "var(--chart-1)" },
} satisfies ChartConfig;

export type TrendPoint = { month: string; total: number; isCurrent: boolean };

export function SpendingTrend({
  data,
  onSelect,
}: {
  data: TrendPoint[];
  onSelect?: (month: string) => void;
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => formatMonthShort(value)}
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
              labelFormatter={(_, payload) => {
                const month = payload?.[0]?.payload as TrendPoint | undefined;
                return month?.month ?? "";
              }}
              formatter={(value) => formatPKR(Number(value))}
            />
          }
        />
        <Bar
          dataKey="total"
          radius={[6, 6, 0, 0]}
          maxBarSize={44}
          isAnimationActive={false}
          onClick={(point) => {
            const month = (point as unknown as TrendPoint)?.month;
            if (month && onSelect) onSelect(month);
          }}
          className="cursor-pointer"
        />
      </BarChart>
    </ChartContainer>
  );
}
