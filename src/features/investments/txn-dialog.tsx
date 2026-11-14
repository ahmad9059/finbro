"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
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
import { todayPK } from "~/lib/dates";
import { formatPKR } from "~/lib/format";
import type { TxnKind } from "~/lib/portfolio";
import type { Asset, AssetTxn } from "~/server/db/schema";
import { api } from "~/trpc/react";

import { asNumber } from "./asset-dialog";
import type { PositionsCopy } from "./config";

const schema = z.object({
  kind: z.string(),
  date: z.string().min(1, "Choose a date."),
  units: z.number().positive("Enter the quantity.").optional(),
  unitPrice: z.number().min(0, "A price cannot be negative.").optional(),
  amount: z.number().min(0, "An amount cannot be negative.").optional(),
  fees: z.number().min(0, "Fees cannot be negative.").optional(),
  notes: z.string().trim().max(500).optional(),
});

type Values = z.infer<typeof schema>;

const needsUnits = (kind: TxnKind) =>
  kind === "buy" || kind === "sell" || kind === "bonus";

export function TxnDialog({
  asset,
  copy,
  open,
  onOpenChange,
  editing,
}: {
  asset: Asset;
  copy: Pick<PositionsCopy, "units" | "txns">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: AssetTxn | null;
}) {
  const utils = api.useUtils();
  const create = api.assetTxn.create.useMutation();
  const update = api.assetTxn.update.useMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          kind: editing.kind,
          date: editing.date,
          units: editing.units ?? undefined,
          unitPrice: editing.unitPrice ?? undefined,
          amount: editing.amount,
          fees: editing.fees,
          notes: editing.notes ?? "",
        }
      : {
          kind: copy.txns[0]?.kind ?? "buy",
          date: todayPK(),
          fees: 0,
        },
  });

  const kind = (watch("kind") ?? "buy") as TxnKind;
  const units = watch("units");
  const unitPrice = watch("unitPrice");
  const amount = watch("amount");
  const unitKind = needsUnits(kind);

  // Keep the amount in step with units × price for buys and sells.
  useEffect(() => {
    if (!unitKind || !units || unitPrice === undefined) return;
    setValue("amount", Math.round(units * unitPrice * 100) / 100);
  }, [unitKind, units, unitPrice, setValue]);

  const hint = copy.txns.find((t) => t.kind === kind)?.description;

  async function onSubmit(values: Values) {
    const payload = {
      assetId: asset.id,
      kind: values.kind as TxnKind,
      date: values.date,
      units: needsUnits(values.kind as TxnKind) ? (values.units ?? null) : null,
      unitPrice:
        needsUnits(values.kind as TxnKind) ? (values.unitPrice ?? null) : null,
      amount: values.amount ?? 0,
      fees: values.fees ?? 0,
      notes: values.notes ?? null,
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success("Transaction saved.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Transaction added.");
      }
      await Promise.all([
        utils.asset.get.invalidate({ id: asset.id }),
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
            {editing ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
          <DialogDescription>{asset.name}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-muted-foreground">
              Type
            </legend>
            <div className="flex flex-wrap gap-2">
              {copy.txns.map((option) => {
                const active = kind === option.kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setValue("kind", option.kind)}
                    className={
                      active
                        ? "h-8 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
                        : "h-8 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-accent"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {hint ? (
              <p className="text-legal text-muted-foreground">{hint}</p>
            ) : null}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="date">Date</FieldLabel>
              <Input id="date" type="date" {...register("date")} />
              <FieldError errors={[errors.date]} />
            </Field>

            {unitKind ? (
              <Field data-invalid={!!errors.units}>
                <FieldLabel htmlFor="units">{copy.units}</FieldLabel>
                <Input
                  id="units"
                  inputMode="decimal"
                  aria-invalid={!!errors.units}
                  {...register("units", asNumber)}
                />
                <FieldError errors={[errors.units]} />
              </Field>
            ) : null}
          </div>

          {unitKind ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.unitPrice}>
                <FieldLabel htmlFor="unitPrice">Price per unit</FieldLabel>
                <Input
                  id="unitPrice"
                  inputMode="decimal"
                  aria-invalid={!!errors.unitPrice}
                  {...register("unitPrice", asNumber)}
                />
                <FieldError errors={[errors.unitPrice]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="fees">Fees</FieldLabel>
                <Input
                  id="fees"
                  inputMode="decimal"
                  {...register("fees", asNumber)}
                />
                <FieldError errors={[errors.fees]} />
              </Field>
            </div>
          ) : null}

          <Field data-invalid={!!errors.amount}>
            <FieldLabel htmlFor="amount">
              {unitKind ? "Total amount" : "Amount received"}
            </FieldLabel>
            <Input
              id="amount"
              inputMode="decimal"
              aria-invalid={!!errors.amount}
              readOnly={unitKind}
              className={unitKind ? "bg-muted/60" : undefined}
              {...register("amount", asNumber)}
            />
            <p className="text-legal text-muted-foreground">
              {amount ? formatPKR(amount, { decimals: 2 }) : " "}
            </p>
            <FieldError errors={[errors.amount]} />
          </Field>

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
