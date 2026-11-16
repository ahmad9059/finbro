"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";
import {
  ChartTheme,
  useChartAxis,
  useChartColors,
} from "~/components/charts/chart-theme";
import { formatMonthShort } from "~/lib/dates";
import { formatCompact, formatPKR } from "~/lib/format";

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

  // The average of the finished months, so a half-spent current month does not
  // drag the line down.
  const finished = data.filter((point) => !point.isCurrent && point.total > 0);
  const average = finished.length
    ? finished.reduce((sum, point) => sum + point.total, 0) / finished.length
    : 0;

  return (
    <BarChart
      height={230}
      margin={{ top: 12, right: 8, bottom: 4, left: 4 }}
      hideLegend
      grid={{ horizontal: true }}
      borderRadius={6}
      onItemClick={(_event, item) => {
        const point = data[item.dataIndex ?? 0];
        if (point && onSelect) onSelect(point.month);
      }}
      series={[
        {
          id: "earlier",
          label: "Spent",
          stack: "month",
          data: data.map((point) => (point.isCurrent ? null : point.total)),
          color: colors[3],
          valueFormatter: (value: number | null) =>
            value === null ? "" : formatPKR(value),
        },
        {
          id: "current",
          label: "This month",
          stack: "month",
          data: data.map((point) => (point.isCurrent ? point.total : null)),
          color: colors[0],
          valueFormatter: (value: number | null) =>
            value === null ? "" : formatPKR(value),
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
          width: 48,
          valueFormatter: (value: number) => formatCompact(value),
          ...axis,
        },
      ]}
      sx={{
        cursor: "pointer",
        "& .MuiChartsGrid-line": { strokeDasharray: "3 3" },
      }}
    >
      {average > 0 ? (
        <ChartsReferenceLine
          y={average}
          label={`avg ${formatCompact(average)}`}
          labelAlign="end"
          lineStyle={{ strokeDasharray: "4 4", strokeWidth: 1, opacity: 0.7 }}
          labelStyle={{ fontSize: 10, fill: axis.tickLabelStyle.fill }}
        />
      ) : null}
    </BarChart>
  );
}
