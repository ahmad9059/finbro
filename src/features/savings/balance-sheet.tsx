"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";

import { ConfirmDialog } from "~/components/shared/confirm-dialog";
import { Money } from "~/components/shared/money";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { api } from "~/trpc/react";

import { AssetDialog } from "~/features/investments/asset-dialog";
import { savingsCopy } from "~/features/investments/config";

import { SavingsTransactions, UpdateBalanceForm } from "./savings-txns";

export function BalanceSheet({
  assetId,
  onClose,
}: {
  assetId: number | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const { data, isLoading } = api.asset.get.useQuery(
    { id: assetId ?? 0 },
    { enabled: assetId !== null },
  );
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const remove = api.asset.delete.useMutation();

  const asset = data?.asset;
  const position = data?.position;

  async function onDelete() {
    if (!asset) return;
    try {
      await remove.mutateAsync({ id: asset.id });
      toast.success("Account deleted.");
      await Promise.all([
        utils.asset.list.invalidate(),
        utils.overview.get.invalidate(),
      ]);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete."));
    } finally {
      setConfirm(false);
    }
  }

  return (
    <>
      <Sheet open={assetId !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[480px]">
          {isLoading || !asset || !position ? (
            <div className="flex flex-col gap-4 p-6">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader className="gap-1 border-b pb-6">
                <SheetTitle className="pr-10">{asset.name}</SheetTitle>
                <SheetDescription>
                  {asset.institution ?? "Savings account"}
                  {asset.profitRate === null ? "" : ` · ${asset.profitRate}% a year`}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 px-6 py-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">Balance</dt>
                    <dd className="mt-1.5 type-title tabular-nums">
                      <Money value={position.marketValue} />
                    </dd>
                  </div>
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      Net deposited
                    </dt>
                    <dd className="mt-1.5 type-title tabular-nums">
                      <Money value={position.cost} />
                    </dd>
                  </div>
                  <div>
                    <dt className="type-eyebrow text-muted-foreground">
                      Profit earned
                    </dt>
                    <dd className="mt-1.5 tabular-nums text-gain">
                      <Money value={position.income} />
                    </dd>
                  </div>
                </dl>

                <SavingsTransactions assetId={asset.id} assetName={asset.name} />
                <UpdateBalanceForm assetId={asset.id} balance={position.marketValue} />

                <div className="flex flex-wrap gap-2 border-t pt-6">
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    <Pencil />
                    Edit account
                  </Button>
                  <Button variant="destructive" onClick={() => setConfirm(true)}>
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </div>

              <AssetDialog
                kind="savings"
                copy={savingsCopy}
                asset={editOpen ? asset : null}
                open={editOpen}
                onOpenChange={setEditOpen}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${asset?.name ?? "this account"}?`}
        description="The account and all of its movements are removed. This cannot be undone."
        onConfirm={() => void onDelete()}
      />
    </>
  );
}
