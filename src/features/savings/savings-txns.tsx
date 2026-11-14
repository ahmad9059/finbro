"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "~/components/shared/confirm-dialog";
import { Money } from "~/components/shared/money";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDate } from "~/lib/format";
import { todayPK } from "~/lib/dates";
import type { AssetTxn } from "~/server/db/schema";
import { api } from "~/trpc/react";

import { savingsCopy } from "~/features/investments/config";
import { TxnDialog } from "~/features/investments/txn-dialog";

const KIND_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  profit: "Profit",
};

export function SavingsTransactions({
  assetId,
  assetName,
}: {
  assetId: number;
  assetName: string;
}) {
  const utils = api.useUtils();
  const { data } = api.asset.get.useQuery({ id: assetId });
  const [txnOpen, setTxnOpen] = useState(false);
  const [editing, setEditing] = useState<AssetTxn | null>(null);
  const [confirm, setConfirm] = useState<AssetTxn | null>(null);
  const remove = api.assetTxn.delete.useMutation();

  async function onDelete() {
    if (!confirm) return;
    try {
      await remove.mutateAsync({ id: confirm.id, assetId });
      toast.success("Transaction deleted.");
      await Promise.all([
        utils.asset.get.invalidate({ id: assetId }),
        utils.asset.list.invalidate(),
        utils.overview.get.invalidate(),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-eyebrow text-muted-foreground">Transactions</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditing(null);
            setTxnOpen(true);
          }}
        >
          <Plus />
          Add
        </Button>
      </div>

      {data?.txns.length === 0 ? (
        <p className="rounded-md bg-muted/60 px-4 py-6 text-center text-ui-sm text-muted-foreground">
          No movements yet.
        </p>
      ) : (
        <ul className="divide-y">
          {data?.txns.map((txn) => (
            <li key={txn.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-ui-sm">
                  <Badge variant="secondary">
                    {KIND_LABELS[txn.kind] ?? txn.kind}
                  </Badge>
                  <span className="text-muted-foreground">{formatDate(txn.date)}</span>
                </p>
                {txn.notes ? (
                  <p className="mt-1 truncate text-legal text-muted-foreground">
                    {txn.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={
                    txn.kind === "withdrawal"
                      ? "tabular-nums text-ui-sm text-loss"
                      : "tabular-nums text-ui-sm"
                  }
                >
                  <Money value={txn.kind === "withdrawal" ? -txn.amount : txn.amount} />
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit transaction"
                  onClick={() => {
                    setEditing(txn);
                    setTxnOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete transaction"
                  onClick={() => setConfirm(txn)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data ? (
        <TxnDialog
          key={editing?.id ?? "new"}
          asset={data.asset}
          copy={savingsCopy}
          editing={editing}
          open={txnOpen}
          onOpenChange={(open) => {
            setTxnOpen(open);
            if (!open) setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this transaction?"
        description={`${assetName} will be recalculated straight away.`}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}

/** Reconciles an account with the balance the bank app shows. */
export function UpdateBalanceForm({
  assetId,
  balance,
}: {
  assetId: number;
  balance: number;
}) {
  const utils = api.useUtils();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const create = api.assetTxn.create.useMutation();

  const target = Number(value.replace(/,/g, ""));
  const difference =
    value === "" || Number.isNaN(target)
      ? 0
      : Math.round((target - balance) * 100) / 100;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (difference === 0) return;
    setPending(true);
    try {
      await create.mutateAsync({
        assetId,
        kind: difference > 0 ? "profit" : "withdrawal",
        date: todayPK(),
        units: null,
        unitPrice: null,
        amount: Math.abs(difference),
        fees: 0,
        notes: "Balance correction",
      });
      toast.success("Balance updated.");
      setValue("");
      await Promise.all([
        utils.asset.get.invalidate({ id: assetId }),
        utils.asset.list.invalidate(),
        utils.overview.get.invalidate(),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
      <h3 className="text-eyebrow text-muted-foreground">Update balance</h3>
      <p className="text-ui-sm text-muted-foreground">
        Type the balance your bank shows. The difference is recorded as{" "}
        {difference >= 0 ? "profit" : "a withdrawal"}.
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          placeholder="Balance"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-40"
          aria-label="Balance from your bank"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={pending || difference === 0}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Apply
          {difference === 0 ? null : <Money value={difference} />}
        </Button>
      </div>
    </form>
  );
}
