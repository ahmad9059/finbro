"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { todayPK } from "~/lib/dates";
import { formatPKR } from "~/lib/format";
import { api } from "~/trpc/react";

const schema = z.object({
  amount: z.number().positive("Enter an amount."),
  date: z.string().min(1, "Choose a date."),
  categoryId: z.string().min(1, "Choose a category."),
  title: z.string().trim().min(1, "What was it for?").max(120),
  notes: z.string().trim().max(500).optional(),
});

type Values = z.infer<typeof schema>;

export type EditableExpense = {
  id: number;
  amount: number;
  date: string;
  categoryId: number;
  title: string;
  notes: string | null;
};

const asNumber = {
  /** Empty input means "not given"; anything else is parsed as a number. */
  setValueAs: (value: unknown) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isNaN(parsed) ? undefined : parsed;
  },
};

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  keepOpenAfterSave = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: EditableExpense | null;
  keepOpenAfterSave?: boolean;
}) {
  const utils = api.useUtils();
  // Only when the popup is open: the category list should not cost the page a
  // cold database round trip just because the provider is mounted.
  const { data: categories } = api.category.list.useQuery(undefined, {
    enabled: open,
    staleTime: 60_000,
  });
  const create = api.expense.create.useMutation();
  // Remember the category you used last, so most entries are one keystroke.
  const [lastCategory, setLastCategory] = useState<string>("");
  const update = api.expense.update.useMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: expense?.amount ?? undefined,
      date: expense?.date ?? todayPK(),
      categoryId: expense ? String(expense.categoryId) : "",
      title: expense?.title ?? "",
      notes: expense?.notes ?? "",
    },
  });

  // Focus the amount the moment the dialog opens: type, Tab, Enter.
  useEffect(() => {
    if (!open) return;
    if (!expense) {
      const remembered = window.localStorage.getItem("finbro:lastCategory");
      if (remembered) setValue("categoryId", remembered);
    }
    setTimeout(() => setFocus("amount"), 50);
  }, [open, expense, setFocus, setValue]);

  const typedCategory = watch("categoryId");
  const categoryId =
    typedCategory || lastCategory || (categories?.[0] ? String(categories[0].id) : "");

  // The category list loads after the dialog mounts; fill the default then.
  useEffect(() => {
    if (open && !typedCategory && categoryId) {
      setValue("categoryId", categoryId);
    }
  }, [open, typedCategory, categoryId, setValue]);

  async function onSubmit(values: Values) {
    const payload = {
      amount: values.amount,
      date: values.date,
      categoryId: Number(values.categoryId),
      title: values.title,
      notes: values.notes ?? null,
    };
    try {
      if (expense) {
        await update.mutateAsync({ id: expense.id, ...payload });
        toast.success("Expense updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success(`Saved ${formatPKR(values.amount, { decimals: 2 })}.`);
      }
      await Promise.all([
        utils.expense.list.invalidate(),
        utils.expense.summary.invalidate(),
        utils.expense.trend.invalidate(),
        utils.overview.get.invalidate(),
      ]);

      if (keepOpenAfterSave && !expense) {
        reset({
          amount: undefined,
          date: values.date,
          categoryId: values.categoryId,
          title: "",
          notes: "",
        });
        setTimeout(() => setFocus("amount"), 50);
        return;
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            {expense ? "Change anything and save." : "Takes a few seconds. Enter saves."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          <Field data-invalid={!!errors.amount}>
            <FieldLabel htmlFor="amount">Amount</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center type-ui text-muted-foreground">
                Rs
              </span>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                aria-invalid={!!errors.amount}
                className="h-14 pl-11 type-lead tabular-nums"
                {...register("amount", asNumber)}
              />
            </div>
            <FieldError errors={[errors.amount]} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="date">Date</FieldLabel>
              <Input id="date" type="date" {...register("date")} />
              <FieldError errors={[errors.date]} />
            </Field>

            <Field data-invalid={!!errors.categoryId}>
              <FieldLabel htmlFor="categoryId">Category</FieldLabel>
              <Select
                value={categoryId}
                onValueChange={(value) => setValue("categoryId", value, { shouldValidate: true })}
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
          </div>

          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="title">What was it for?</FieldLabel>
            <Input
              id="title"
              placeholder="e.g. Groceries"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            <FieldError errors={[errors.title]} />
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
            {!expense ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleSubmit((values) => onSubmit(values))}
                disabled={isSubmitting}
              >
                Save and add another
              </Button>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

