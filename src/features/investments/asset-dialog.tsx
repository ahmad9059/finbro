"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
  const utils = api.useUtils();
  const [fund, setFund] = useState<PickedFund | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

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
  const lookup = api.price.lookupStock.useQuery(
    { symbol: watch("symbol") ?? "" },
    { enabled: false, retry: false },
  );

  async function onLookup() {
    const symbol = (watch("symbol") ?? "").trim().toUpperCase();
    if (!symbol) return;
    setLookingUp(true);
    try {
      const result = await lookup.refetch();
      const data = result.data;
      if (!data) return;
      if (!data.ok) {
        toast.error(data.reason);
        return;
      }
      setValue("name", data.name ?? symbol);
      setValue("price", data.price);
      setValue("priceAsOf", data.asOf);
      toast.success(`${symbol}: Rs ${data.price}`);
    } finally {
      setLookingUp(false);
    }
  }

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
          priceAsOf: values.priceAsOf ?? null,
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
          priceAsOf: values.priceAsOf ?? null,
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
      toast.error(error instanceof Error ? error.message : "Could not save.");
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
              <div className="flex gap-2">
                <Input
                  id="symbol"
                  placeholder="OGDC"
                  className="uppercase"
                  autoComplete="off"
                  {...register("symbol")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void onLookup()}
                  disabled={lookingUp}
                >
                  {lookingUp ? <Loader2 className="animate-spin" /> : null}
                  Look up
                </Button>
              </div>
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
              <legend className="px-1 text-eyebrow text-muted-foreground">
                First purchase (optional)
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="openingUnits">Number of shares</FieldLabel>
                  <Input
                    id="openingUnits"
                    inputMode="decimal"
                    {...register("openingUnits", asNumber)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="openingPrice">Price per share</FieldLabel>
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
