"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CompanyLogo } from "~/components/shared/company-logo";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export type PickedStock = {
  symbol: string;
  name: string;
  sector: string;
};

/**
 * A searchable PSX combobox: type a symbol ("ogdc") or part of a company name
 * ("oil gas") and pick from the ranked list. Arrow keys and Enter work.
 */
export function StockPicker({
  value,
  onPick,
}: {
  value: { symbol: string; name: string } | null;
  onPick: (stock: PickedStock) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  /** null means "show the chosen company"; a string means "being edited". */
  const [draft, setDraft] = useState<string | null>(null);

  const label = value ? `${value.symbol} · ${value.name}` : "";
  const text = draft ?? label;
  const searching = open && query.trim().length > 0;

  const { data = [], isFetching } = api.price.searchStocks.useQuery(
    { query },
    { enabled: searching, staleTime: 5 * 60_000 },
  );

  const results = useMemo(() => data.slice(0, 20), [data]);

  function choose(stock: PickedStock) {
    onPick(stock);
    setQuery("");
    setDraft(null);
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const match = results[active];
      if (match) {
        event.preventDefault();
        choose(match);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover open={open && searching} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={text}
            placeholder="Search a company name or symbol"
            className="pl-9"
            aria-label="Search the PSX for a company"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls="psx-symbol-list"
            aria-autocomplete="list"
            onFocus={() => {
              // Clear the chosen label so a new search can start straight away.
              setDraft("");
              setOpen(true);
            }}
            onChange={(event) => {
              setDraft(event.target.value);
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Let a click on the list land before the field gives up focus.
              setTimeout(() => {
                setOpen(false);
                setDraft(null);
              }, 150);
            }}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ul id="psx-symbol-list" role="listbox" className="max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center type-ui-sm text-muted-foreground">
              {isFetching
                ? "Searching…"
                : query.trim().length === 0
                  ? "Type a symbol or company name."
                  : "No listed company matches that. Check the spelling, or add it with a manual price."}
            </li>
          ) : null}
          {results.map((stock, index) => {
            const selected = value?.symbol === stock.symbol;
            return (
              <li key={stock.symbol}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(stock)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                    index === active ? "bg-accent" : "hover:bg-accent",
                  )}
                >
                  <CompanyLogo symbol={stock.symbol} name={stock.name} size={28} />
                  <span className="w-14 shrink-0 font-mono tabular-nums text-ui-sm text-foreground">
                    {stock.symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-ui-sm text-foreground">
                      {stock.name}
                    </span>
                    <span className="flex items-center gap-1.5 type-legal text-muted-foreground">
                      <span className="truncate">{stock.sector}</span>
                      {stock.type === "etf" ? (
                        <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] font-medium tracking-[0.3px] text-secondary-foreground">
                          ETF
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
