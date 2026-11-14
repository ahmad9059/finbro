"use client";

import {
  ArrowRight,
  CalendarClock,
  Check,
  Layers,
  LineChart,
  PieChart,
  ReceiptText,
  Sparkles,
  Trophy,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";

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
import { ValueByKindChart } from "./value-by-kind-chart";

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
      toast.error(errorMessage(error, "Could not save."));
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
            <p className="type-lead">Start with one number.</p>
            <p className="max-w-md type-body-lg text-muted-foreground">
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
          icon={Wallet}
          hero
          className="sm:col-span-2"
          value={<Money value={data.netWorth} />}
          footer="Everything you hold, added up"
        />
        <KpiCard
          label="Unrealized"
          icon={TrendingUp}
          value={<Delta value={data.unrealized} />}
          footer={`${formatPercent(data.unrealizedPct)} on what you paid`}
        />
        <KpiCard
          label="Spent this month"
          icon={ReceiptText}
          value={<Money value={data.spentThisMonth} />}
          footer={
            <Link href="/expenses" className="text-link hover:underline">
              See the month
            </Link>
          }
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Allocation"
          description="Share of your net worth"
          icon={PieChart}
        >
          <AllocationDonut data={data.allocation} total={data.netWorth} />
        </Section>
        <Section
          title="Net worth"
          description="One point is added each evening"
          icon={LineChart}
        >
          <NetWorthChart data={data.snapshots} />
        </Section>
      </div>

      {data.byKind.length > 0 ? (
        <Section
          title="Value by kind"
          description="How each part of the portfolio moved"
          icon={Layers}
        >
          <ValueByKindChart series={data.byKind} />
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          icon={CalendarClock}
          title="Due soon"
          description={
            data.overdueCount > 0
              ? `${data.dueIn30Days} due in 30 days · ${data.overdueCount} overdue`
              : `${data.dueIn30Days} due in 30 days`
          }
        >
          {data.upcoming.length === 0 ? (
            <p className="type-ui-sm text-muted-foreground">
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
                    <p className="truncate type-ui-sm">{row.name}</p>
                    <p className="type-legal text-muted-foreground">
                      {formatDate(row.nextDueDate)}
                      {row.overdue ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums type-ui-sm">
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

        <Section
          title="Top holdings"
          description="By market value"
          icon={Trophy}
        >
          {data.topHoldings.length === 0 ? (
            <p className="type-ui-sm text-muted-foreground">
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
                      <span className="block truncate type-ui-sm">{row.name}</span>
                      <span className="type-legal text-muted-foreground">
                        {row.symbol ?? formatPercent(row.unrealizedPct)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums type-ui-sm">
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

      <p className="flex flex-wrap items-center gap-2 type-legal text-muted-foreground">
        <Badge variant="secondary">Next</Badge>
        Prices refresh each evening after the market closes. You can also refresh
        them by hand on any investments page.
      </p>
    </div>
  );
}

