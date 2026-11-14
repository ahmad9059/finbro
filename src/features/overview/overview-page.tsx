"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { KpiCard, KpiGrid, KpiSkeleton } from "~/components/shared/kpi-card";
import { Delta, Money } from "~/components/shared/money";
import { PageHeader } from "~/components/shared/page-header";
import { Section } from "~/components/shared/section";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { formatMonth, todayPK } from "~/lib/dates";
import { formatDate, formatPercent } from "~/lib/format";
import type { AssetKind } from "~/lib/portfolio";
import { api } from "~/trpc/react";

import { useExpenseDialog } from "~/features/expenses/expense-dialog-provider";

import { AllocationDonut } from "./allocation-donut";
import { NetWorthChart } from "./net-worth-chart";

const KIND_PATHS: Record<AssetKind, string> = {
  stock: "/stocks",
  mutual_fund: "/mutual-funds",
  money_market: "/money-market",
  savings: "/savings",
};

export function OverviewPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.overview.get.useQuery();
  const { open } = useExpenseDialog();
  const [paying, setPaying] = useState<number | null>(null);
  const markPaid = api.subscription.markPaid.useMutation();

  async function onMarkPaid(id: number, name: string, amount: number) {
    setPaying(id);
    try {
      const result = await markPaid.mutateAsync({
        id,
        amount,
        date: todayPK(),
      });
      await Promise.all([
        utils.overview.get.invalidate(),
        utils.subscription.list.invalidate(),
        utils.expense.list.invalidate(),
      ]);
      toast.success(
        `${name} recorded. Next due ${formatDate(result.nextDueDate)}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setPaying(null);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader description="Your portfolio and this month, in one place." />
        <KpiSkeleton />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data.hasAnything) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader description="Your portfolio and this month, in one place." />
        <div className="flex flex-col items-center gap-6 rounded-lg bg-tint px-6 py-16 text-center">
          <Sparkles
            className="size-10 text-muted-foreground"
            strokeWidth={1.25}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-2">
            <p className="text-lead">Start with one number.</p>
            <p className="max-w-md text-body-lg text-muted-foreground">
              Add a holding or an expense and this page fills in: net worth,
              allocation, and what is due next.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/stocks">Add a holding</Link>
            </Button>
            <Button variant="secondary" onClick={() => open()}>
              Add an expense
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader description={`${formatMonth(data.month)} · updated ${formatDate(data.today)}`}>
        <Button variant="secondary" onClick={() => open()}>
          Add expense
        </Button>
      </PageHeader>

      <KpiGrid>
        <KpiCard
          label="Net worth"
          hero
          value={<Money value={data.netWorth} />}
          footer="Everything you hold, added up"
        />
        <KpiCard
          label="Unrealized"
          value={<Delta value={data.unrealized} ratio={data.unrealizedPct} />}
          footer="Investments only"
        />
        <KpiCard
          label="Spent this month"
          value={<Money value={data.spentThisMonth} />}
          footer={
            <Link href="/expenses" className="text-link hover:underline">
              See the month
            </Link>
          }
        />
        <KpiCard
          label="Due in 30 days"
          value={data.dueIn30Days}
          footer={
            data.overdueCount > 0 ? (
              <span className="flex items-center gap-1 text-loss">
                <CircleAlert className="size-3.5" aria-hidden="true" />
                {data.overdueCount} overdue
              </span>
            ) : (
              "Subscriptions and bills"
            )
          }
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Allocation" description="Share of your net worth">
          <AllocationDonut data={data.allocation} total={data.netWorth} />
        </Section>
        <Section title="Net worth" description="One point is added each evening">
          <NetWorthChart data={data.snapshots} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Due soon" description="Next 30 days, overdue first">
          {data.upcoming.length === 0 ? (
            <p className="text-ui-sm text-muted-foreground">
              Nothing due in the next month.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.upcoming.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ui-sm">{row.name}</p>
                    <p className="text-legal text-muted-foreground">
                      {formatDate(row.nextDueDate)}
                      {row.overdue ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-ui-sm">
                      <Money value={row.amount} />
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={paying === row.id}
                      onClick={() => void onMarkPaid(row.id, row.name, row.amount)}
                    >
                      <Check />
                      Mark paid
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Top holdings" description="By market value">
          {data.topHoldings.length === 0 ? (
            <p className="text-ui-sm text-muted-foreground">
              No investments yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.topHoldings.map((row) => (
                <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={KIND_PATHS[row.kind]}
                    className="flex items-center justify-between gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-ui-sm">{row.name}</span>
                      <span className="text-legal text-muted-foreground">
                        {row.symbol ?? formatPercent(row.unrealizedPct)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums text-ui-sm">
                        <Money value={row.marketValue} />
                      </span>
                      <ArrowRight
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-legal text-muted-foreground">
        <Badge variant="secondary">Next</Badge>
        Prices refresh each evening after the market closes. You can also refresh
        them by hand on any investments page.
      </p>
    </div>
  );
}

