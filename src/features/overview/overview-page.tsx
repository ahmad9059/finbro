"use client";

import {
  ArrowRight,
  CalendarClock,
  Check,
  Lightbulb,
  Layers,
  LineChart,
  PieChart,
  ReceiptText,
  Sparkles,
  Trophy,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";

import { CompanyLogo } from "~/components/shared/company-logo";
import { HiddenChart } from "~/components/shared/hidden-chart";
import { MASK, usePrivacy } from "~/components/shared/privacy-context";
import { PrivacyToggle } from "~/components/shared/privacy-toggle";
import { KpiCard, KpiGrid, KpiSkeleton } from "~/components/shared/kpi-card";
import { Delta, Masked, Money } from "~/components/shared/money";
import { Section } from "~/components/shared/section";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { currentMonthPK, formatMonth, todayPK } from "~/lib/dates";
import { formatDate, formatPercent } from "~/lib/format";
import type { AssetKind } from "~/lib/portfolio";
import { api } from "~/trpc/react";

import { useExpenseDialog } from "~/features/expenses/expense-dialog-provider";

import { AllocationDonut } from "./allocation-donut";
import { NetWorthChart } from "./net-worth-chart";
import { OverviewBanner } from "./overview-banner";
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
  const { hidden } = usePrivacy();
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

  const bannerShell = "-mx-4 -mt-6 lg:-mx-8 lg:-mt-8";

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-8">
        <div className={bannerShell}>
          <OverviewBanner
            loading
            month={formatMonth(currentMonthPK())}
            netWorth={0}
            updated={todayPK()}
          />
        </div>
        <KpiSkeleton count={3} />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data.hasAnything) {
    return (
      <div className="flex flex-col gap-8">
        <div className={bannerShell}>
          <OverviewBanner
            month={formatMonth(data.month)}
            netWorth={0}
            updated={data.today}
            onAddExpense={() => open()}
          />
        </div>
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
      <div className={bannerShell}>
        <OverviewBanner
          month={formatMonth(data.month)}
          netWorth={data.netWorth}
          updated={data.today}
          onAddExpense={() => open()}
        />
      </div>

      <KpiGrid className="xl:grid-cols-3">
        <KpiCard
          label="Unrealized"
          icon={TrendingUp}
          value={<Delta value={data.unrealized} />}
          footer={
            <>
              <Masked>{formatPercent(data.unrealizedPct)}</Masked> on what you paid
            </>
          }
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
        <KpiCard
          label="Due in 30 days"
          icon={CalendarClock}
          value={data.dueIn30Days}
          footer={
            data.overdueCount > 0
              ? `${data.overdueCount} overdue`
              : "Subscriptions and bills"
          }
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Allocation"
          description="Share of your net worth"
          icon={PieChart}
        >
          {hidden ? (
            <HiddenChart label="Allocation" />
          ) : (
            <AllocationDonut data={data.allocation} total={data.netWorth} />
          )}
        </Section>
        <Section
          title="Net worth"
          description="One point is added each evening"
          icon={LineChart}
        >
          {hidden ? (
            <HiddenChart label="The net-worth history" />
          ) : (
            <NetWorthChart data={data.snapshots} />
          )}
        </Section>
      </div>

      {data.byKind.length > 0 ? (
        <Section
          title="Value by kind"
          description="How each part of the portfolio moved"
          icon={Layers}
        >
          {hidden ? (
            <HiddenChart label="The split by asset kind" />
          ) : (
            <ValueByKindChart series={data.byKind} />
          )}
        </Section>
      ) : null}

      <Section
        title="Worth knowing"
        description="Plain facts from your own numbers"
        icon={Lightbulb}
      >
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Insight label="Best performer">
            {data.insights.best ? (
              <>
                <span className="block truncate">{data.insights.best.name}</span>
                <Delta
                  value={data.insights.best.unrealized}
                  ratio={data.insights.best.unrealizedPct}
                />
              </>
            ) : (
              <span className="text-muted-foreground">Needs two holdings</span>
            )}
          </Insight>
          <Insight label="Weakest performer">
            {data.insights.worst ? (
              <>
                <span className="block truncate">{data.insights.worst.name}</span>
                <Delta
                  value={data.insights.worst.unrealized}
                  ratio={data.insights.worst.unrealizedPct}
                />
              </>
            ) : (
              <span className="text-muted-foreground">Needs two holdings</span>
            )}
          </Insight>
          <Insight label="Biggest position">
            {data.insights.largest ? (
              <>
                <span className="block truncate">{data.insights.largest.name}</span>
                <span
                  className={
                    data.insights.largest.share > 0.5
                      ? "text-loss"
                      : "text-muted-foreground"
                  }
                >
                  <Masked>
                    {formatPercent(data.insights.largest.share, { signed: false })}
                  </Masked>{" "}
                  of net worth
                  {data.insights.largest.share > 0.5 ? " · concentrated" : ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Nothing yet</span>
            )}
          </Insight>
          <Insight label="Earned so far">
            <Money value={data.insights.income + data.insights.realized} />
            <span className="block text-muted-foreground">
              <Money value={data.insights.income} /> income ·{" "}
              <Money value={data.insights.realized} /> realized
            </span>
          </Insight>
        </ul>
      </Section>

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
                    className="group/top flex items-center justify-between gap-3 rounded-md outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <CompanyLogo
                        symbol={row.symbol}
                        institution={row.institution}
                        name={row.name}
                        size={28}
                      />
                      <span className="min-w-0">
                        <span className="block truncate type-ui-sm">{row.name}</span>
                        <span className="type-legal text-muted-foreground">
                          {row.symbol ?? (hidden ? MASK : formatPercent(row.unrealizedPct))}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums type-ui-sm">
                        <Money value={row.marketValue} />
                      </span>
                      <ArrowRight
                        className="size-4 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out)] group-hover/top:translate-x-0.5"
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


function Insight({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-md bg-muted/50 p-4 type-ui-sm">
      <span className="type-eyebrow text-muted-foreground">{label}</span>
      {children}
    </li>
  );
}
