"use client";

import { BarChart } from "@mui/x-charts/BarChart";

import {
  ChartTheme,
  useChartAxis,
  useChartColors,
} from "~/components/charts/chart-theme";
import { formatMonthShort } from "~/lib/dates";
import { formatPKR } from "~/lib/format";

export type TrendPoint = { month: string; total: number; isCurrent: boolean };

export function SpendingTrend({
  data,
  onSelect,
}: {
  data: TrendPoint[];
  onSelect?: (month: string) => void;
}) {
  return (
    <ChartTheme>
      <Inner data={data} onSelect={onSelect} />
    </ChartTheme>
  );
}

function Inner({
  data,
  onSelect,
}: {
  data: TrendPoint[];
  onSelect?: (month: string) => void;
}) {
  const colors = useChartColors();
  const axis = useChartAxis();

  return (
    <BarChart
      height={220}
      margin={{ top: 8, right: 4, bottom: 4, left: 4 }}
      hideLegend
      grid={{ horizontal: true }}
      borderRadius={6}
      onItemClick={(_event, item) => {
        const point = data[item.dataIndex ?? 0];
        if (point && onSelect) onSelect(point.month);
      }}
      series={[
        {
          label: "Spent",
          data: data.map((point) => point.total),
          color: colors[0],
          valueFormatter: (value: number | null) => formatPKR(value ?? 0),
        },
      ]}
      xAxis={[
        {
          scaleType: "band",
          data: data.map((point) => point.month),
          valueFormatter: (month: string) => formatMonthShort(month),
          ...axis,
        },
      ]}
      yAxis={[
        {
          width: 44,
          valueFormatter: (value: number) =>
            value >= 1000 ? `${Math.round(value / 1000)}k` : String(value),
          ...axis,
        },
      ]}
      sx={{ cursor: "pointer", "& .MuiChartsGrid-line": { strokeDasharray: "3 3" } }}
    />
  );
}
