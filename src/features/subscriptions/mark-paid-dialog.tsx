"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { addCycle, formatMonth, todayPK } from "~/lib/dates";
import { formatDate, formatPKR } from "~/lib/format";
import { api } from "~/trpc/react";

export type PayableSubscription = {
  id: number;
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  nextDueDate: string;
};

export function MarkPaidDialog({
  subscription,
  onClose,
}: {
  subscription: PayableSubscription | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const markPaid = api.subscription.markPaid.useMutation();
  const undo = api.subscription.undoMarkPaid.useMutation();
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState(todayPK());
  const [pending, setPending] = useState(false);

  const value = amount === "" ? (subscription?.amount ?? 0) : Number(amount);

  async function invalidate() {
    await Promise.all([
      utils.subscription.list.invalidate(),
      utils.expense.list.invalidate(),
      utils.expense.summary.invalidate(),
      utils.expense.trend.invalidate(),
      utils.overview.get.invalidate(),
    ]);
  }

  async function onConfirm() {
    if (!subscription) return;
    setPending(true);
    try {
      const result = await markPaid.mutateAsync({
        id: subscription.id,
        amount: value,
        date,
      });
      await invalidate();
      onClose();
      toast.success(
        `Recorded ${formatPKR(value, { decimals: 2 })}. Next due ${formatDate(result.nextDueDate)}.`,
        {
          action: {
            label: "Undo",
            onClick: () => {
              void (async () => {
                try {
                  await undo.mutateAsync({
                    expenseId: result.expenseId ?? 0,
                    previousDueDate: result.previousDueDate,
                  });
                  await invalidate();
                  toast.success("Undone.");
                } catch {
                  toast.error("That expense has already changed. Remove it from Expenses.");
                }
              })();
            },
          },
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  const next =
    subscription === null
      ? ""
      : formatMonth(
          addCycle(subscription.nextDueDate, subscription.cycle).slice(0, 7),
        );

  return (
    <Dialog
      open={subscription !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Mark {subscription?.name} paid</DialogTitle>
          <DialogDescription>
            This records an expense and moves the next due date to {next}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="paidAmount">Amount paid</FieldLabel>
            <Input
              id="paidAmount"
              inputMode="decimal"
              value={amount === "" ? String(subscription?.amount ?? "") : amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="paidDate">Date paid</FieldLabel>
            <Input
              id="paidDate"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void onConfirm()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
