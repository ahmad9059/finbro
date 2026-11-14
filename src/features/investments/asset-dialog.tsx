"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { errorMessage } from "~/lib/errors";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { Asset } from "~/server/db/schema";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import type { PositionsCopy, PositionsKind } from "./config";
import { FundPicker, type PickedFund } from "./fund-picker";

const optionalNumber = (min: number, message?: string) =>
  z
    .number()
    .min(min, message)
    .optional();

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  symbol: z.string().trim().max(20).optional(),
  institution: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  price: optionalNumber(0.0001, "Enter a price."),
  priceAsOf: z.string().optional(),
  profitRate: optionalNumber(0, "A rate cannot be negative."),
  openingUnits: optionalNumber(0.0001),
  openingPrice: optionalNumber(0.0001),
  openingAmount: optionalNumber(0.01),
  openingDate: z.string(),
  openingFees: optionalNumber(0, "Fees cannot be negative."),
});

type Values = z.infer<typeof schema>;

const numeric = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const asNumber = { setValueAs: numeric } as const;

export function AssetDialog({
  kind,
  copy,
  open,
  onOpenChange,
  asset,
}: {
  kind: PositionsKind | "savings";
  copy: Pick<PositionsCopy, "nameLabel" | "namePlaceholder" | "institutionLabel" | "lookup" | "moneyMarket">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  asset?: Asset | null;
}) {
  const editing = !!asset;
  const isSavings = kind === "savings";
  const isStock = kind === "stock";
  const unitWord = isStock ? "share" : "unit";
  const utils = api.useUtils();
  const [fund, setFund] = useState<PickedFund | null>(null);
  const [debouncedSymbol, setDebouncedSymbol] = useState("");
  // Which symbol last filled the name and price, so a miss can clear them.
  const filledSymbol = useRef<string | null>(null);

  const defaults: Values = {
    name: asset?.name ?? "",
    symbol: asset?.symbol ?? "",
    institution: asset?.institution ?? "",
    notes: asset?.notes ?? "",
    price: asset?.lastPrice ?? undefined,
    priceAsOf: asset?.priceAsOf ?? "",
    profitRate: asset?.profitRate ?? undefined,
    openingUnits: undefined,
    openingPrice: undefined,
    openingAmount: undefined,
    openingDate: new Date().toISOString().slice(0, 10),
    openingFees: undefined,
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const create = api.asset.create.useMutation();
  const update = api.asset.update.useMutation();

  // Look the symbol up as it is typed, so there is no button to press.
  const symbolInput = watch("symbol") ?? "";
  useEffect(() => {
    if (!isStock || !open) return;
    const next = symbolInput.trim().toUpperCase();
    const timer = setTimeout(() => setDebouncedSymbol(next), 450);
    return () => clearTimeout(timer);
  }, [symbolInput, isStock, open]);

  const symbolReady = /^[A-Z0-9]{2,12}$/.test(debouncedSymbol);
  const lookup = api.price.lookupStock.useQuery(
    { symbol: debouncedSymbol },
    {
      enabled: isStock && symbolReady && !editing,
      retry: false,
      staleTime: 5 * 60_000,
    },
  );

  // Fill the name and price the moment a match comes back; clear them again
  // when the symbol changes to one PSX does not know.
  useEffect(() => {
    const result = lookup.data;
    if (!result) return;
    if (result.ok) {
      if (result.name) setValue("name", result.name);
      setValue("price", result.price);
      setValue("priceAsOf", result.asOf);
      filledSymbol.current = debouncedSymbol;
      return;
    }
    if (filledSymbol.current) {
      setValue("name", "");
      setValue("price", undefined);
      setValue("priceAsOf", "");
      filledSymbol.current = null;
    }
  }, [lookup.data, debouncedSymbol, setValue]);

  const lookupStatus = !isStock
    ? null
    : !symbolReady
      ? "Type a symbol; the company and price fill in automatically."
      : lookup.isFetching
        ? `Checking ${debouncedSymbol} on PSX…`
        : lookup.data?.ok
          ? `${lookup.data.name ?? debouncedSymbol} · Rs ${lookup.data.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
          : lookup.data
            ? lookup.data.reason
            : null;

  function onPickFund(picked: PickedFund) {
    setFund(picked);
    setValue("name", picked.name);
    setValue("institution", picked.amc);
    setValue("price", picked.nav);
  }

  async function onSubmit(values: Values) {
    const payload = {
      name: values.name,
      symbol: isStock ? (values.symbol?.toUpperCase() ?? null) : null,
      fundId: fund?.fundId ?? asset?.fundId ?? null,
      institution: values.institution ?? null,
      category: fund?.category ?? asset?.category ?? null,
      profitRate: isSavings ? (values.profitRate ?? null) : null,
      notes: values.notes ?? null,
    };

    try {
      if (editing && asset) {
        await update.mutateAsync({
          id: asset.id,
          ...payload,
          price: values.price ?? null,
          priceAsOf: values.priceAsOf?.trim() ? values.priceAsOf : null,
          priceSource: "manual",
        });
        toast.success("Saved.");
      } else {
        const opening = isSavings
          ? values.openingAmount
            ? {
                kind: "deposit" as const,
                date: values.openingDate,
                units: null,
                unitPrice: null,
                amount: values.openingAmount,
                fees: 0,
                notes: null,
              }
            : null
          : values.openingUnits && values.openingPrice
            ? {
                kind: "buy" as const,
                date: values.openingDate,
                units: values.openingUnits,
                unitPrice: values.openingPrice,
                amount: values.openingUnits * values.openingPrice,
                fees: values.openingFees ?? 0,
                notes: null,
              }
            : null;

        await create.mutateAsync({
          kind,
          ...payload,
          price: values.price ?? null,
          priceAsOf: values.priceAsOf?.trim() ? values.priceAsOf : null,
          priceSource: "manual",
          opening,
        });
        toast.success("Added.");
        reset(defaults);
        setFund(null);
      }
      await Promise.all([
        utils.asset.list.invalidate(),
        utils.overview.get.invalidate(),
      ]);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${asset.name}` : isSavings ? "Add account" : copy.nameLabel === "Company" ? "Add holding" : "Add fund"}
          </DialogTitle>
          <DialogDescription>
            {isSavings
              ? "An account's balance is what you deposited plus profit, minus withdrawals."
              : "You can add more transactions from the holding's page."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          {isStock ? (
            <Field data-invalid={!!errors.symbol}>
              <FieldLabel htmlFor="symbol">PSX symbol</FieldLabel>
              <Input
                id="symbol"
                placeholder="OGDC"
                className="uppercase"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                {...register("symbol")}
              />
              {lookupStatus ? (
                <p
                  className={cn(
                    "flex items-center gap-1.5 type-legal",
                    lookup.data && !lookup.data.ok
                      ? "text-loss"
                      : lookup.data?.ok
                        ? "text-gain"
                        : "text-muted-foreground",
                  )}
                >
                  {lookup.isFetching ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : lookup.data?.ok ? (
                    <CircleCheck className="size-3" aria-hidden="true" />
                  ) : lookup.data ? (
                    <CircleAlert className="size-3" aria-hidden="true" />
                  ) : null}
                  {lookupStatus}
                </p>
              ) : null}
              <FieldError errors={[errors.symbol]} />
            </Field>
          ) : null}

          {copy.lookup === "fund" && !editing ? (
            <Field>
              <FieldLabel>Fund</FieldLabel>
              <FundPicker
                moneyMarket={copy.moneyMarket}
                value={fund}
                onPick={onPickFund}
              />
            </Field>
          ) : null}

          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">{copy.nameLabel}</FieldLabel>
            <Input
              id="name"
              placeholder={copy.namePlaceholder}
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="institution">{copy.institutionLabel}</FieldLabel>
              <Input id="institution" {...register("institution")} />
            </Field>

            {isSavings ? (
              <Field>
                <FieldLabel htmlFor="profitRate">Profit rate (% a year)</FieldLabel>
                <Input
                  id="profitRate"
                  inputMode="decimal"
                  placeholder="e.g. 11.5"
                  {...register("profitRate", asNumber)}
                />
              </Field>
            ) : (
              <Field data-invalid={!!errors.price}>
                <FieldLabel htmlFor="price">
                  {editing ? "Price override" : "Current price"}
                </FieldLabel>
                <Input
                  id="price"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register("price", asNumber)}
                />
                <FieldError errors={[errors.price]} />
              </Field>
            )}
          </div>

          {!editing && !isSavings ? (
            <fieldset className="flex flex-col gap-4 rounded-md bg-muted/60 p-4">
              <legend className="px-1 type-eyebrow text-muted-foreground">
                First purchase (optional)
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="openingUnits">Number of {unitWord}s</FieldLabel>
                  <Input
                    id="openingUnits"
                    inputMode="decimal"
                    {...register("openingUnits", asNumber)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="openingPrice">Price per {unitWord}</FieldLabel>
                  <Input
                    id="openingPrice"
                    inputMode="decimal"
                    {...register("openingPrice", asNumber)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="openingDate">Date</FieldLabel>
                  <Input
                    id="openingDate"
                    type="date"
                    {...register("openingDate")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="openingFees">Fees</FieldLabel>
                  <Input
                    id="openingFees"
                    inputMode="decimal"
                    {...register("openingFees", asNumber)}
                  />
                </Field>
              </div>
            </fieldset>
          ) : null}

          {!editing && isSavings ? (
            <div className="grid gap-4 rounded-md bg-muted/60 p-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="openingAmount">Opening balance</FieldLabel>
                <Input
                  id="openingAmount"
                  inputMode="decimal"
                  {...register("openingAmount", asNumber)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="openingDate">Date</FieldLabel>
                <Input id="openingDate" type="date" {...register("openingDate")} />
              </Field>
            </div>
          ) : null}

          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
