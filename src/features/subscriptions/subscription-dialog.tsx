"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { todayPK } from "~/lib/dates";
import { api } from "~/trpc/react";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  amount: z.number().positive("Enter an amount."),
  cycle: z.string(),
  nextDueDate: z.string().min(1, "Choose a date."),
  categoryId: z.string().min(1, "Choose a category."),
  notes: z.string().trim().max(500).optional(),
});

type Values = z.infer<typeof schema>;

const asNumber = {
  /** Empty input means "not given"; anything else is parsed as a number. */
  setValueAs: (value: unknown) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isNaN(parsed) ? undefined : parsed;
  },
};

export type EditableSubscription = {
  id: number;
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  nextDueDate: string;
  categoryId: number;
  notes: string | null;
};

export function SubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  defaultCategoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: EditableSubscription | null;
  defaultCategoryId?: number;
}) {
  const utils = api.useUtils();
  const { data: categories } = api.category.list.useQuery(undefined, {
    staleTime: 60_000,
  });
  const create = api.subscription.create.useMutation();
  const update = api.subscription.update.useMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: subscription?.name ?? "",
      amount: subscription?.amount ?? undefined,
      cycle: subscription?.cycle ?? "monthly",
      nextDueDate: subscription?.nextDueDate ?? todayPK(),
      categoryId: String(subscription?.categoryId ?? defaultCategoryId ?? ""),
      notes: subscription?.notes ?? "",
    },
  });

  const cycle = watch("cycle");
  const categoryId = watch("categoryId");

  async function onSubmit(values: Values) {
    const payload = {
      name: values.name,
      amount: values.amount,
      cycle: values.cycle === "yearly" ? ("yearly" as const) : ("monthly" as const),
      nextDueDate: values.nextDueDate,
      categoryId: Number(values.categoryId),
      notes: values.notes ?? null,
    };
    try {
      if (subscription) {
        await update.mutateAsync({ id: subscription.id, ...payload });
        toast.success("Subscription saved.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Subscription added.");
      }
      await Promise.all([
        utils.subscription.list.invalidate(),
        utils.expense.list.invalidate(),
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
            {subscription ? "Edit subscription" : "Add subscription"}
          </DialogTitle>
          <DialogDescription>
            Nothing is charged automatically. Mark it paid when the money leaves.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Service</FieldLabel>
              <Input
                id="name"
                placeholder="e.g. Netflix"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                aria-invalid={!!errors.amount}
                {...register("amount", asNumber)}
              />
              <FieldError errors={[errors.amount]} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cycle">Billed</FieldLabel>
              <Select
                value={cycle}
                onValueChange={(value) => setValue("cycle", value)}
              >
                <SelectTrigger id="cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Every month</SelectItem>
                  <SelectItem value="yearly">Every year</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={!!errors.nextDueDate}>
              <FieldLabel htmlFor="nextDueDate">Next due</FieldLabel>
              <Input
                id="nextDueDate"
                type="date"
                aria-invalid={!!errors.nextDueDate}
                {...register("nextDueDate")}
              />
              <FieldError errors={[errors.nextDueDate]} />
            </Field>
          </div>

          <Field data-invalid={!!errors.categoryId}>
            <FieldLabel htmlFor="categoryId">Category</FieldLabel>
            <Select
              value={categoryId}
              onValueChange={(value) =>
                setValue("categoryId", value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="categoryId" aria-invalid={!!errors.categoryId}>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[errors.categoryId]} />
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
              {subscription ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
