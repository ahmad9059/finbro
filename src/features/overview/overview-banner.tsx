import { Sparkles } from "lucide-react";

import { Money } from "~/components/shared/money";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDate } from "~/lib/format";

/**
 * The Overview hero.
 *
 * A full-bleed band of light with the number that matters on it. The art is a
 * small inline SVG rather than an image: it inherits the theme, costs no
 * request, and stays crisp at any width. Depth comes from two soft orbs and a
 * pair of hairline arcs, the same vocabulary as Mercury's night pages.
 */
export function OverviewBanner({
  month,
  netWorth,
  updated,
  loading = false,
  onAddExpense,
}: {
  month: string;
  netWorth: number;
  updated: string;
  loading?: boolean;
  onAddExpense?: () => void;
}) {
  return (
    <section className="relative isolate mb-8 overflow-hidden rounded-b-2xl border-b border-border/60 bg-[#f6f5fd] dark:bg-[#1a1a26]">
      <BannerArt />

      <div className="relative flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 type-eyebrow text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {month}
          </p>

          {loading ? (
            <Skeleton className="mt-1 h-11 w-64" />
          ) : (
            <p className="type-hero tabular-nums">
              <Money value={netWorth} />
            </p>
          )}

          <p className="type-ui-sm text-muted-foreground">
            Everything you hold, added up · updated {formatDate(updated)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAddExpense ? (
            <Button variant="secondary" onClick={onAddExpense}>
              Add expense
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function BannerArt() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      viewBox="0 0 1200 240"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="banner-fade-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="60%" stopColor="#f6f5fd" stopOpacity="0" />
          <stop offset="100%" stopColor="#fbfcfd" />
        </linearGradient>
        <linearGradient id="banner-fade-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="60%" stopColor="#1a1a26" stopOpacity="0" />
          <stop offset="100%" stopColor="#171721" />
        </linearGradient>
        <radialGradient id="banner-orb-indigo">
          <stop offset="0%" stopColor="#5266eb" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#5266eb" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="banner-orb-peri">
          <stop offset="0%" stopColor="#9cb4e8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#9cb4e8" stopOpacity="0" />
        </radialGradient>
        <pattern id="banner-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.1" fill="currentColor" opacity="0.35" />
        </pattern>
      </defs>

      {/* Day */}
      <g className="text-[#28253b] dark:hidden">
        <circle cx="990" cy="-30" r="320" fill="url(#banner-orb-indigo)" opacity="0.35" />
        <circle cx="700" cy="250" r="230" fill="url(#banner-orb-peri)" opacity="0.45" />
        <g fill="none" stroke="#5266eb" strokeOpacity="0.12">
          <circle cx="1010" cy="60" r="120" />
          <circle cx="1010" cy="60" r="164" />
          <circle cx="1010" cy="60" r="210" />
        </g>
        <rect width="1200" height="240" fill="url(#banner-fade-light)" />
      </g>

      {/* Night */}
      <g className="hidden text-[#ededf3] dark:inline">
        <circle cx="980" cy="-40" r="360" fill="url(#banner-orb-indigo)" opacity="0.5" />
        <circle cx="720" cy="260" r="240" fill="url(#banner-orb-peri)" opacity="0.22" />
        <g fill="none" stroke="#9cb4e8" strokeOpacity="0.14">
          <circle cx="1010" cy="50" r="120" />
          <circle cx="1010" cy="50" r="164" />
          <circle cx="1010" cy="50" r="210" />
        </g>
        <rect width="1200" height="240" fill="url(#banner-fade-dark)" />
      </g>
    </svg>
  );
}
