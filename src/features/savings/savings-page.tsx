"use client";

import { Banknote, Landmark, PiggyBank, Plus, Wallet } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "~/components/shared/empty-state";
import { KpiCard, KpiGrid, KpiSkeleton } from "~/components/shared/kpi-card";
import { Money } from "~/components/shared/money";
import { PageHeader } from "~/components/shared/page-header";
import { TableSkeleton } from "~/components/shared/table-skeleton";
import { CompanyLogo } from "~/components/shared/company-logo";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";

import { AssetDialog } from "~/features/investments/asset-dialog";
import { savingsCopy } from "~/features/investments/config";

import { BalanceSheet } from "./balance-sheet";

export function SavingsPage() {
  const { data, isLoading } = api.asset.list.useQuery({ kind: "savings" });
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader description={savingsCopy.hint}>
        <Button onClick={() => setAddOpen(true)}>
          <Plus />
          Add account
        </Button>
      </PageHeader>

      {isLoading ? (
        <KpiSkeleton count={3} />
      ) : (
        <KpiGrid className="xl:grid-cols-3">
          <KpiCard
            label="Total balance"
            icon={Wallet}
            value={<Money value={totals?.marketValue ?? 0} />}
            footer={`${totals?.count ?? 0} ${totals?.count === 1 ? "account" : "accounts"}`}
          />
          <KpiCard
            label="Net deposited"
            icon={PiggyBank}
            value={<Money value={totals?.cost ?? 0} />}
            footer="Deposits minus withdrawals"
          />
          <KpiCard
            label="Profit earned"
            icon={Banknote}
            value={<Money value={totals?.income ?? 0} />}
            footer="Credited by the banks"
          />
        </KpiGrid>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : data?.items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet. Add a savings account and it will track its balance and the profit it earns."
        >
          <Button onClick={() => setAddOpen(true)}>
            <Plus />
            Add account
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg bg-card shadow-soft">
          <div className="px-6 pt-6">
            <h2 className="flex items-center gap-2 type-eyebrow text-muted-foreground">
              <Landmark className="size-3.5" aria-hidden="true" />
              Accounts
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Rate</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Net deposited
                </TableHead>
                <TableHead className="hidden text-right sm:table-cell">Profit</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map(({ asset, position }) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(asset.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CompanyLogo institution={asset.institution} name={asset.name} />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-foreground">
                          {asset.name}
                        </span>
                        <span className="truncate type-legal text-muted-foreground">
                          {asset.institution ?? "—"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {asset.profitRate === null ? "—" : `${asset.profitRate}%`}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    <Money value={position.cost} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-gain sm:table-cell">
                    <Money value={position.income} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    <Money value={position.marketValue} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AssetDialog
        kind="savings"
        copy={savingsCopy}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <BalanceSheet assetId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
