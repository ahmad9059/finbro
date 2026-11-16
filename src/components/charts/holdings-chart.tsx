"use client";

import { BarChart } from "@mui/x-charts/BarChart";

import {
  ChartTheme,
  useChartAxis,
  useChartColors,
} from "~/components/charts/chart-theme";
import { formatCompact, formatPKR } from "~/lib/format";

export type HoldingBar = { name: string; value: number };

/**
 * Value by holding. Horizontal bars keep long company and fund names readable;
 * at most eight are shown, largest first.
 */
export function HoldingsChart({ data }: { data: HoldingBar[] }) {
  const rows = [...data].sort((a, b) => b.value - a.value).slice(0, 8);
  if (rows.length === 0) return null;

  return (
    <ChartTheme>
      <Inner rows={rows} />
    </ChartTheme>
  );
}

function Inner({ rows }: { rows: HoldingBar[] }) {
  const colors = useChartColors();
  const axis = useChartAxis();
  const height = Math.max(120, rows.length * 38 + 24);

  return (
    <BarChart
      layout="horizontal"
      height={height}
      margin={{ top: 4, right: 28, bottom: 4, left: 4 }}
      hideLegend
      grid={{ vertical: true }}
      borderRadius={4}
      series={[
        {
          label: "Value",
          data: rows.map((row) => row.value),
          color: colors[0],
          valueFormatter: (value: number | null) => formatPKR(value ?? 0),
        },
      ]}
      yAxis={[
        {
          scaleType: "band",
          data: rows.map((row) => row.name),
          width: 170,
          ...axis,
        },
      ]}
      xAxis={[
        {
          height: 24,
          valueFormatter: (value: number) => formatCompact(value),
          ...axis,
        },
      ]}
      sx={{ "& .MuiChartsGrid-line": { strokeDasharray: "3 3" } }}
    />
  );
}
