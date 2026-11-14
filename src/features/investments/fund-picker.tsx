"use client";

import { Check, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { CompanyLogo } from "~/components/shared/company-logo";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { api } from "~/trpc/react";

export type PickedFund = {
  fundId: string;
  name: string;
  amc: string;
  category: string;
  nav: number;
};

export function FundPicker({
  moneyMarket,
  value,
  onPick,
}: {
  moneyMarket: boolean;
  value: PickedFund | null;
  onPick: (fund: PickedFund) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, isFetching } = api.price.searchFunds.useQuery(
    { query, moneyMarket },
    { enabled: open, staleTime: 60_000 },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-full justify-start rounded-md px-3 font-normal"
        >
          <Search className="text-muted-foreground" />
          <span className="truncate">
            {value ? value.name : "Search a fund"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Fund or asset manager"
            aria-label="Search funds"
            className="h-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {isFetching && !data ? (
            <p className="flex items-center gap-2 px-3 py-6 type-ui-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading funds
            </p>
          ) : null}
          {data?.length === 0 ? (
            <p className="px-3 py-6 type-ui-sm text-muted-foreground">
              No fund matches. You can add it by hand instead.
            </p>
          ) : null}
          {data?.map((fund) => {
            const selected = value?.fundId === fund.fundId;
            return (
              <button
                key={fund.fundId}
                type="button"
                onClick={() => {
                  onPick(fund);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-accent"
              >
                <CompanyLogo institution={fund.amc} name={fund.amc} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-ui-sm text-foreground">
                    {fund.name}
                  </span>
                  <span className="block truncate type-legal text-muted-foreground">
                    {fund.amc} · {fund.category}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums type-legal text-muted-foreground">
                  {fund.nav.toFixed(2)}
                </span>
                {selected ? (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
