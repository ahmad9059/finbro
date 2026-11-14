"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useTheme } from "next-themes";
import { useMemo, useSyncExternalStore } from "react";

export const CHART_COLORS = {
  light: ["#5266eb", "#8b7cf0", "#554e7b", "#9cb4e8", "#28253b"],
  dark: ["#5266eb", "#9cb4e8", "#8b7cf0", "#c3c3cc", "#ededf3"],
} as const;

/** One colour per asset kind, held steady across both themes. */
export const KIND_COLORS = {
  light: {
    stock: "#5266eb",
    mutual_fund: "#8b7cf0",
    money_market: "#9cb4e8",
    savings: "#554e7b",
  },
  dark: {
    stock: "#5266eb",
    mutual_fund: "#9cb4e8",
    money_market: "#8b7cf0",
    // A deep slate, so the largest band recedes instead of glowing.
    savings: "#4b4b5c",
  },
} as const;

export const GAIN = { light: "#17794e", dark: "#5fcf9f" } as const;
export const LOSS = { light: "#c0364a", dark: "#f08a97" } as const;

const subscribe = () => () => undefined;

/**
 * MUI charts need concrete colours for their internals (tooltip, axis text,
 * grid). This maps our Mercury tokens onto a small MUI theme so charts sit in
 * the same two worlds as the rest of the app without pulling in MUI's reset.
 */
export function ChartTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const dark = resolvedTheme === "dark";

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: dark ? "dark" : "light",
          primary: { main: "#5266eb" },
          background: {
            default: "transparent",
            paper: dark ? "#262635" : "#ffffff",
          },
          text: {
            primary: dark ? "#ededf3" : "#28253b",
            secondary: dark ? "#c3c3cc" : "#554e7b",
          },
          divider: dark ? "rgba(112,112,125,0.45)" : "rgba(195,195,204,0.7)",
        },
        typography: {
          fontFamily:
            "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
          fontSize: 12,
        },
        shape: { borderRadius: 8 },
        components: {
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                backgroundColor: dark ? "#262635" : "#ffffff",
                color: dark ? "#ededf3" : "#28253b",
                border: `1px solid ${dark ? "rgba(112,112,125,0.45)" : "rgba(195,195,204,0.7)"}`,
                boxShadow: dark
                  ? "0 16px 40px rgb(0 0 0 / 0.35)"
                  : "0 2px 4px rgb(40 37 59 / 0.05), 0 16px 40px rgb(40 37 59 / 0.09)",
                fontSize: 12,
                padding: "8px 10px",
                borderRadius: 8,
              },
            },
          },
        },
      }),
    [dark],
  );

  // The theme is only known in the browser; render nothing until it is.
  if (!mounted) return <div className="h-full w-full" aria-hidden="true" />;

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

/** Series colours for the current theme. */
export function useChartColors() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? CHART_COLORS.dark : CHART_COLORS.light;
}

/** Kind colours for the current theme. */
export function useKindColors() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? KIND_COLORS.dark : KIND_COLORS.light;
}

/** The common axis/tick styling for every chart. */
export function useChartAxis() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    tickLabelStyle: {
      fill: dark ? "#c3c3cc" : "#554e7b",
      fontSize: 11,
    },
    labelStyle: {
      fill: dark ? "#c3c3cc" : "#554e7b",
      fontSize: 11,
    },
    tickSize: 0,
  } as const;
}
