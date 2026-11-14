"use client";

import {
  ArrowDown,
  ArrowUp,
  CandlestickChart,
  CircleAlert,
  Landmark,
  PieChart,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";

import { EmptyState } from "~/components/shared/empty-state";
import { KpiCard, KpiGrid, KpiSkeleton } from "~/components/shared/kpi-card";
import { Delta, Money } from "~/components/shared/money";
import { PageHeader } from "~/components/shared/page-header";
import { TableSkeleton } from "~/components/shared/table-skeleton";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatPercent, formatUnits } from "~/lib/format";
import { api } from "~/trpc/react";

import { AssetDialog } from "./asset-dialog";
import type { PositionsCopy, PositionsKind } from "./config";
import { HoldingSheet } from "./holding-sheet";
import { PriceTag } from "./price-tag";

type SortKey = "value" | "pnl";

const ICONS = {
  stock: CandlestickChart,
  mutual_fund: PieChart,
  money_market: Landmark,
} as const;

export function PositionsPage({
  kind,
  copy,
  title,
}: {
  kind: PositionsKind;
  copy: PositionsCopy;
  title: string;
}) {
  const Icon = ICONS[kind];
  const utils = api.useUtils();
  const { data, isLoading, isError, refetch } = api.asset.list.useQuery({ kind });
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState<SortKey>("value");
  const refresh = api.price.refresh.useMutation();

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    return items
      .filter(({ position }) => showClosed || position.units > 0)
      .sort((a, b) =>
        sort === "value"
          ? b.position.marketValue - a.position.marketValue
          : b.position.unrealized - a.position.unrealized,
      );
  }, [data, showClosed, sort]);

  async function onRefresh() {
    try {
      const result = await refresh.mutateAsync({ kind });
      await Promise.all([
        utils.asset.list.invalidate(),
        utils.asset.get.invalidate(),
        utils.overview.get.invalidate(),
      ]);
      if (result.failed.length > 0) {
        toast.warning(
          `${result.updated} updated, ${result.failed.length} failed: ${result.failed[0]?.name ?? ""}`,
        );
      } else if (result.updated === 0) {
        toast.info("Prices were checked a moment ago. Try again in a few minutes.");
      } else {
        toast.success(`${result.updated} price${result.updated === 1 ? "" : "s"} updated.`);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Could not refresh."));
    }
  }

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader description={`${copy.hint}`}>
        <Button
          variant="secondary"
          onClick={() => void onRefresh()}
          disabled={refresh.isPending}
        >
          <RefreshCw className={refresh.isPending ? "animate-spin" : undefined} />
          Refresh prices
        </Button>
        <Button onClick={() => setAddOpen(true)}>
          <Plus />
          {copy.addLabel}
        </Button>
      </PageHeader>

      {isLoading ? (
        <KpiSkeleton />
      ) : (
        <KpiGrid>
          <KpiCard
            label="Market value"
            value={<Money value={totals?.marketValue ?? 0} />}
            footer={`${totals?.count ?? 0} ${totals?.count === 1 ? "holding" : "holdings"}`}
          />
          <KpiCard
            label="Invested"
            value={<Money value={totals?.cost ?? 0} />}
            footer="Cost of what you still hold"
          />
          <KpiCard
            label="Unrealized"
            value={<Delta value={totals?.unrealized ?? 0} />}
            footer={
              totals && totals.cost > 0
                ? `${formatPercent(totals.unrealized / totals.cost)} on what you paid`
                : "Value minus what you paid"
            }
          />
          <KpiCard
            label="Realized + income"
            value={<Money value={(totals?.realized ?? 0) + (totals?.income ?? 0)} />}
            footer="Locked-in gains and dividends"
          />
        </KpiGrid>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-10 text-center shadow-soft">
          <CircleAlert className="size-8 text-loss" aria-hidden="true" />
          <p className="type-body-lg">Could not load your holdings.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : data?.items.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`Nothing here yet. Add your first ${kind === "stock" ? "holding" : "fund"} and it will show up with its value and gain.`}
        >
          <Button onClick={() => setAddOpen(true)}>
            <Plus />
            {copy.addLabel}
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg bg-card shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <h2 className="type-eyebrow text-muted-foreground">{title}</h2>
            <label className="flex items-center gap-2 type-ui-sm text-muted-foreground">
              <Switch
                checked={showClosed}
                onCheckedChange={setShowClosed}
                aria-label="Show closed holdings"
              />
              Show closed
            </label>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">{copy.units}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  {copy.avgCost}
                </TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  {copy.price}
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => setSort("value")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    aria-label="Sort by market value"
                  >
                    Value
                    {sort === "value" ? (
                      <ArrowDown className="size-3" aria-hidden="true" />
                    ) : null}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => setSort("pnl")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    aria-label="Sort by profit and loss"
                  >
                    P&amp;L
                    {sort === "pnl" ? (
                      <ArrowUp className="size-3" aria-hidden="true" />
                    ) : null}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ asset, position }) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(asset.id)}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">
                        {asset.name}
                      </span>
                      <span className="type-legal text-muted-foreground">
                        {asset.symbol ?? asset.institution ?? asset.category ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnits(position.units)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {position.avgCost.toLocaleString("en-US", {
                      minimumFractionDigits: copy.priceDecimals,
                      maximumFractionDigits: copy.priceDecimals,
                    })}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="tabular-nums">
                        {asset.lastPrice === null
                          ? "—"
                          : asset.lastPrice.toLocaleString("en-US", {
                              minimumFractionDigits: copy.priceDecimals,
                              maximumFractionDigits: copy.priceDecimals,
                            })}
                      </span>
                      <PriceTag asOf={asset.priceAsOf} source={asset.priceSource} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Money value={position.marketValue} />
                  </TableCell>
                  <TableCell className="text-right">
                    {position.units === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Delta
                        value={position.unrealized}
                        ratio={position.unrealizedPct}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AssetDialog
        kind={kind}
        copy={copy}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <HoldingSheet
        kind={kind}
        copy={copy}
        assetId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
