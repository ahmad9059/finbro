"use client";

import {
  CalendarClock,
  Check,
  CircleDollarSign,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";

import { ConfirmDialog } from "~/components/shared/confirm-dialog";
import { EmptyState } from "~/components/shared/empty-state";
import { KpiCard, KpiGrid, KpiSkeleton } from "~/components/shared/kpi-card";
import { Money } from "~/components/shared/money";
import { PageHeader } from "~/components/shared/page-header";
import { TableSkeleton } from "~/components/shared/table-skeleton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatDate } from "~/lib/format";
import { api } from "~/trpc/react";

import {
  MarkPaidDialog,
  type PayableSubscription,
} from "./mark-paid-dialog";
import {
  SubscriptionDialog,
  type EditableSubscription,
} from "./subscription-dialog";

export function SubscriptionsPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.subscription.list.useQuery();
  const { data: categories } = api.category.list.useQuery(undefined, {
    staleTime: 60_000,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EditableSubscription | null>(null);
  const [paying, setPaying] = useState<PayableSubscription | null>(null);
  const [deleting, setDeleting] = useState<EditableSubscription | null>(null);
  const setStatus = api.subscription.setStatus.useMutation();
  const remove = api.subscription.delete.useMutation();

  const subscriptionsCategory = categories?.find(
    (category) => category.name === "Subscriptions",
  );

  async function toggleStatus(row: EditableSubscription & { status: string }) {
    try {
      await setStatus.mutateAsync({
        id: row.id,
        status: row.status === "active" ? "paused" : "active",
      });
      toast.success(row.status === "active" ? "Paused." : "Resumed.");
      await utils.subscription.list.invalidate();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save."));
    }
  }

  async function onDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      toast.success("Subscription deleted.");
      await Promise.all([
        utils.subscription.list.invalidate(),
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
      <PageHeader description="Recurring services. Mark one paid when the money leaves your account.">
        <Button onClick={() => setAddOpen(true)}>
          <Plus />
          Add subscription
        </Button>
      </PageHeader>

      {isLoading ? (
        <KpiSkeleton count={3} />
      ) : (
        <KpiGrid className="xl:grid-cols-3">
          <KpiCard
            label="Monthly cost"
            icon={Repeat}
            value={<Money value={data?.monthlyCost ?? 0} />}
            footer="Yearly plans divided by 12"
          />
          <KpiCard
            label="Yearly cost"
            icon={CircleDollarSign}
            value={<Money value={data?.yearlyCost ?? 0} />}
            footer="What these add up to in a year"
          />
          <KpiCard
            label="Due this month"
            icon={CalendarClock}
            value={data?.dueThisMonth ?? 0}
            footer={
              data && data.dueIn30Days > data.dueThisMonth
                ? `${data.dueIn30Days} due in the next 30 days`
                : "Including anything overdue"
            }
          />
        </KpiGrid>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : data?.items.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No subscriptions yet. Add Netflix or your internet bill and the app will keep track of what is due."
        >
          <Button onClick={() => setAddOpen(true)}>
            <Plus />
            Add subscription
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg bg-card shadow-soft">
          <div className="flex items-center justify-between px-6 pt-6">
            <h2 className="flex items-center gap-2 type-eyebrow text-muted-foreground">
              <Repeat className="size-3.5" aria-hidden="true" />
              Subscriptions
            </h2>
            {data && data.paidThisMonth > 0 ? (
              <span className="type-legal text-muted-foreground">
                <Money value={data.paidThisMonth} /> paid this month
              </span>
            ) : null}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="hidden sm:table-cell">Billed</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Next due</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((row) => (
                <TableRow
                  key={row.id}
                  className={row.status === "paused" ? "opacity-55" : undefined}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="block max-w-[42vw] truncate font-medium text-foreground sm:max-w-none">
                        {row.name}
                      </span>
                      <span className="type-legal text-muted-foreground">
                        {row.categoryName}
                        {row.status === "paused" ? " · paused" : ""}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 type-legal text-muted-foreground sm:hidden">
                        <span className="tabular-nums text-foreground">
                          <Money value={row.amount} decimals={2} />
                        </span>
                        <span>{formatDate(row.nextDueDate)}</span>
                        {row.overdue ? (
                          <Badge variant="destructive">Overdue</Badge>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">
                      {row.cycle === "monthly" ? "Monthly" : "Yearly"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    <Money value={row.amount} decimals={2} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{formatDate(row.nextDueDate)}</span>
                      {row.overdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={row.status === "paused"}
                        onClick={() =>
                          setPaying({
                            id: row.id,
                            name: row.name,
                            amount: row.amount,
                            cycle: row.cycle,
                            nextDueDate: row.nextDueDate,
                          })
                        }
                      >
                        <Check />
                        Mark paid
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`More actions for ${row.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(row)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              void toggleStatus({
                                ...row,
                              })
                            }
                          >
                            {row.status === "active" ? <Pause /> : <Play />}
                            {row.status === "active" ? "Pause" : "Resume"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(row)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SubscriptionDialog
        open={addOpen || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false);
            setEditing(null);
          }
        }}
        subscription={editing}
        defaultCategoryId={subscriptionsCategory?.id}
      />

      <MarkPaidDialog subscription={paying} onClose={() => setPaying(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this subscription"}?`}
        description="Past payments stay in your expenses. The subscription itself is removed."
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
