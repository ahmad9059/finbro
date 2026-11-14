"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Pencil,
  Plus,
  ReceiptText,
  Tags,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";

import { ConfirmDialog } from "~/components/shared/confirm-dialog";
import { EmptyState } from "~/components/shared/empty-state";
import { KpiCard, KpiGrid, KpiSkeleton } from "~/components/shared/kpi-card";
import { Delta, Money } from "~/components/shared/money";
import { PageHeader } from "~/components/shared/page-header";
import { Section } from "~/components/shared/section";
import { TableSkeleton } from "~/components/shared/table-skeleton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { currentMonthPK, formatMonth, shiftMonth } from "~/lib/dates";
import { formatDate, formatPercent } from "~/lib/format";
import { api } from "~/trpc/react";

import { CategoryBars } from "./category-bars";
import type { EditableExpense } from "./expense-dialog";
import { useExpenseDialog } from "./expense-dialog-provider";
import { SpendingTrend } from "./spending-trend";

export function ExpensesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const today = currentMonthPK();
  const requested = params.get("month");
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : today;

  const utils = api.useUtils();
  const { open } = useExpenseDialog();
  const summary = api.expense.summary.useQuery({ month });
  const list = api.expense.list.useQuery({ month });
  const trend = api.expense.trend.useQuery();
  const [deleting, setDeleting] = useState<EditableExpense | null>(null);
  const remove = api.expense.delete.useMutation();

  function goTo(nextMonth: string) {
    router.replace(`/expenses?month=${nextMonth}`);
  }

  const biggest = summary.data?.categories[0];

  async function onDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      toast.success("Expense deleted.");
      await Promise.all([
        utils.expense.list.invalidate(),
        utils.expense.summary.invalidate(),
        utils.expense.trend.invalidate(),
        utils.overview.get.invalidate(),
      ]);
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete."));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader description="Everything you spent, month by month. Press E to add one.">
        <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => goTo(shiftMonth(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-36 text-center type-ui-sm">
            {formatMonth(month)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={month >= today}
            onClick={() => goTo(shiftMonth(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button onClick={() => open()}>
          <Plus />
          Add expense
        </Button>
      </PageHeader>

      {summary.isLoading ? (
        <KpiSkeleton count={3} />
      ) : (
        <KpiGrid className="xl:grid-cols-3">
          <KpiCard
            label="Spent this month"
            icon={ReceiptText}
            value={<Money value={summary.data?.total ?? 0} />}
            footer={`${list.data?.length ?? 0} ${list.data?.length === 1 ? "expense" : "expenses"}`}
          />
          <KpiCard
            label="vs last month"
            icon={TrendingUp}
            value={
              <Delta
                value={summary.data?.difference ?? 0}
                invert
                className="type-title"
              />
            }
            footer={<Money value={summary.data?.previousTotal ?? 0} />}
          />
          <KpiCard
            label="Biggest category"
            icon={Tags}
            value={biggest ? biggest.name : "—"}
            footer={
              biggest ? (
                <span>
                  <Money value={biggest.total} /> ·{" "}
                  {formatPercent(biggest.share, { signed: false })}
                </span>
              ) : (
                "Nothing yet"
              )
            }
          />
        </KpiGrid>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section
          title="This month"
          description={formatMonth(month)}
          icon={CalendarDays}
          flush
        >
          {list.isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={4} />
            </div>
          ) : list.data?.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ReceiptText}
                title={`Nothing spent in ${formatMonth(month)} yet.`}
              >
                <Button onClick={() => open()}>
                  <Plus />
                  Add expense
                </Button>
              </EmptyState>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">{row.title}</span>
                      {row.notes ? (
                        <span className="block truncate type-legal text-muted-foreground">
                          {row.notes}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">
                        {row.categoryName}
                        {row.subscriptionId ? " ⟳" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Money value={row.amount} decimals={2} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${row.title}`}
                          onClick={() => open(row)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${row.title}`}
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <div className="flex flex-col gap-6">
          <Section title="Where it went" icon={PieChart}>
            <CategoryBars data={summary.data?.categories ?? []} />
          </Section>
          <Section title="Six months" icon={BarChart3}>
            <SpendingTrend
              data={trend.data ?? []}
              onSelect={(next) => goTo(next)}
            />
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(value) => !value && setDeleting(null)}
        title="Delete this expense?"
        description={
          deleting
            ? `${deleting.title}, ${formatDate(deleting.date)}. This cannot be undone.`
            : ""
        }
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
