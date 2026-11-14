"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";

import { CompanyLogo } from "~/components/shared/company-logo";
import { ConfirmDialog } from "~/components/shared/confirm-dialog";
import { Delta, Money } from "~/components/shared/money";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { formatDate, formatPercent, formatUnits } from "~/lib/format";
import type { TxnKind } from "~/lib/portfolio";
import type { AssetTxn } from "~/server/db/schema";
import { api } from "~/trpc/react";

import { AssetDialog } from "./asset-dialog";
import type { PositionsCopy, PositionsKind } from "./config";
import { PriceTag } from "./price-tag";
import { TxnDialog } from "./txn-dialog";

const KIND_LABELS: Record<TxnKind, string> = {
  buy: "Buy",
  sell: "Sell",
  bonus: "Bonus units",
  dividend: "Dividend",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  profit: "Profit",
};

export function HoldingSheet({
  kind,
  copy,
  assetId,
  onClose,
}: {
  kind: PositionsKind;
  copy: PositionsCopy;
  assetId: number | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const { data, isLoading } = api.asset.get.useQuery(
    { id: assetId ?? 0 },
    { enabled: assetId !== null },
  );
  const [txnOpen, setTxnOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<AssetTxn | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmTxn, setConfirmTxn] = useState<AssetTxn | null>(null);
  const [confirmAsset, setConfirmAsset] = useState(false);

  const removeTxn = api.assetTxn.delete.useMutation();
  const removeAsset = api.asset.delete.useMutation();

  async function afterTxnChange() {
    if (!assetId) return;
    await Promise.all([
      utils.asset.get.invalidate({ id: assetId }),
      utils.asset.list.invalidate(),
      utils.overview.get.invalidate(),
    ]);
  }

  async function onDeleteTxn() {
    if (!confirmTxn || !assetId) return;
    try {
      await removeTxn.mutateAsync({ id: confirmTxn.id, assetId });
      toast.success("Transaction deleted.");
      await afterTxnChange();
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete."));
    } finally {
      setConfirmTxn(null);
    }
  }

  async function onDeleteAsset() {
    if (!assetId) return;
    try {
      await removeAsset.mutateAsync({ id: assetId });
      toast.success("Deleted.");
      await Promise.all([
        utils.asset.list.invalidate(),
        utils.overview.get.invalidate(),
      ]);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete."));
    } finally {
      setConfirmAsset(false);
    }
  }

  const position = data?.position;
  const asset = data?.asset;

  return (
    <>
      <Sheet open={assetId !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[480px]">
          {isLoading || !asset || !position ? (
            <div className="flex flex-col gap-4 p-6">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader className="gap-1 border-b pb-6">
                <div className="flex items-center gap-3 pr-10">
                  <CompanyLogo symbol={asset.symbol} name={asset.name} size={40} />
                  <SheetTitle className="min-w-0 truncate">{asset.name}</SheetTitle>
                </div>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  {asset.symbol ? <span>{asset.symbol}</span> : null}
                  {asset.institution ? <span>· {asset.institution}</span> : null}
                  <PriceTag asOf={asset.priceAsOf} source={asset.priceSource} />
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 px-6 py-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      {copy.value}
                    </dt>
                    <dd className="mt-1.5 type-title tabular-nums">
                      <Money value={position.marketValue} />
                    </dd>
                  </div>
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      Unrealized
                    </dt>
                    <dd className="mt-1.5">
                      <Delta value={position.unrealized} className="type-title" />
                      <span className="block type-legal text-muted-foreground">
                        {formatPercent(position.unrealizedPct)} on what you paid
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      {copy.units}
                    </dt>
                    <dd className="mt-1.5 tabular-nums">
                      {formatUnits(position.units)}
                    </dd>
                  </div>
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      {copy.avgCost}
                    </dt>
                    <dd className="mt-1.5 tabular-nums">
                      {position.avgCost.toLocaleString("en-US", {
                        minimumFractionDigits: copy.priceDecimals,
                        maximumFractionDigits: copy.priceDecimals,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      Cost basis
                    </dt>
                    <dd className="mt-1.5 tabular-nums">
                      <Money value={position.cost} />
                    </dd>
                  </div>
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      Realized + income
                    </dt>
                    <dd className="mt-1.5 tabular-nums">
                      <Money
                        value={position.realized + position.income}
                      />
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="type-eyebrow text-muted-foreground">
                      Transactions
                    </h3>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingTxn(null);
                        setTxnOpen(true);
                      }}
                    >
                      <Plus />
                      Add
                    </Button>
                  </div>

                  {data.txns.length === 0 ? (
                    <p className="rounded-md bg-muted/60 px-4 py-6 text-center type-ui-sm text-muted-foreground">
                      No transactions yet.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {data.txns.map((txn) => (
                        <li
                          key={txn.id}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 type-ui-sm">
                              <Badge variant="secondary">
                                {KIND_LABELS[txn.kind]}
                              </Badge>
                              <span className="text-muted-foreground">
                                {formatDate(txn.date)}
                              </span>
                            </p>
                            <p className="mt-1 truncate type-legal text-muted-foreground">
                              {txn.units !== null
                                ? `${formatUnits(txn.units)} × ${formatUnits(Number(txn.unitPrice ?? 0), 4)}`
                                : "Cash movement"}
                              {txn.fees > 0 ? ` · fees ${txn.fees}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="tabular-nums type-ui-sm">
                              <Money value={txn.amount} />
                            </span>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Edit transaction"
                              onClick={() => {
                                setEditingTxn(txn);
                                setTxnOpen(true);
                              }}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Delete transaction"
                              onClick={() => setConfirmTxn(txn)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {asset.notes ? (
                  <p className="rounded-md bg-muted/60 p-4 type-ui-sm text-muted-foreground">
                    {asset.notes}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t pt-6">
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    <Pencil />
                    Edit holding
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmAsset(true)}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>

                {position.units === 0 ? (
                  <p className="type-legal text-muted-foreground">
                    Nothing is held here any more.
                  </p>
                ) : !position.hasPrice ? (
                  <p className="type-legal text-loss">
                    No price yet, so the value shown is what you paid.
                  </p>
                ) : null}
              </div>

              <SheetFooter className="border-t pt-6">
                <Button
                  onClick={() => {
                    setEditingTxn(null);
                    setTxnOpen(true);
                  }}
                >
                  <Plus />
                  Add transaction
                </Button>
              </SheetFooter>

              {txnOpen ? (
                <TxnDialog
                  key={editingTxn?.id ?? "new"}
                  asset={asset}
                  copy={copy}
                  editing={editingTxn}
                  open={txnOpen}
                  onOpenChange={(open) => {
                    setTxnOpen(open);
                    if (!open) setEditingTxn(null);
                  }}
                />
              ) : null}

              <AssetDialog
                kind={kind}
                copy={copy}
                asset={editOpen ? asset : null}
                open={editOpen}
                onOpenChange={setEditOpen}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmTxn !== null}
        onOpenChange={(open) => !open && setConfirmTxn(null)}
        title="Delete this transaction?"
        description="The holding's numbers are recalculated straight away. This cannot be undone."
        onConfirm={() => void onDeleteTxn()}
      />

      <ConfirmDialog
        open={confirmAsset}
        onOpenChange={setConfirmAsset}
        title={`Delete ${asset?.name ?? "this holding"}?`}
        description="The holding and all of its transactions are removed. This cannot be undone."
        onConfirm={() => void onDeleteAsset()}
      />
    </>
  );
}
