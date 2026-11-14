/** Input schemas shared by the forms and the tRPC procedures. */
import { z } from "zod";

import { isIsoDate, isIsoMonth } from "~/lib/dates";
import { ASSET_KINDS, TXN_KINDS, txnNeedsUnits } from "~/lib/portfolio";

const MAX_AMOUNT = 1e13;

export const isoDate = z.string().refine(isIsoDate, "Enter a valid date.");
export const isoMonth = z.string().refine(isIsoMonth, "Invalid month.");

const positive = (label: string) =>
  z
    .number({ error: `Enter ${label}.` })
    .positive(`${label[0]!.toUpperCase()}${label.slice(1)} must be more than zero.`)
    .max(MAX_AMOUNT, "That number is too large.");

const nonNegative = z
  .number({ error: "Enter a number." })
  .min(0, "This cannot be negative.")
  .max(MAX_AMOUNT, "That number is too large.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .max(max, `Keep this under ${max} characters.`);

export const assetKindSchema = z.enum(ASSET_KINDS);
export const txnKindSchema = z.enum(TXN_KINDS);

/* ------------------------------- Assets ---------------------------------- */

export const assetInput = z.object({
  kind: assetKindSchema,
  name: requiredText("a name"),
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  fundId: optionalText(40),
  institution: optionalText(120),
  category: optionalText(120),
  profitRate: z.number().min(0).max(100).nullable(),
  notes: optionalText(500),
});
export type AssetInput = z.input<typeof assetInput>;

export const assetUpdateInput = assetInput.omit({ kind: true }).extend({
  id: z.number().int(),
});

export const manualPriceInput = z.object({
  assetId: z.number().int(),
  price: positive("a price"),
  date: isoDate,
});

/* ----------------------------- Transactions ------------------------------ */

export const txnInput = z
  .object({
    assetId: z.number().int(),
    kind: txnKindSchema,
    date: isoDate,
    units: positive("the quantity").nullable(),
    unitPrice: nonNegative.nullable(),
    amount: nonNegative,
    fees: nonNegative,
    notes: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (txnNeedsUnits(value.kind) && value.units === null) {
      ctx.addIssue({
        code: "custom",
        path: ["units"],
        message: "Enter the quantity.",
      });
    }
    if (value.kind !== "bonus" && value.amount <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "The amount must be more than zero.",
      });
    }
  });
export type TxnInput = z.input<typeof txnInput>;

/* ------------------------------- Expenses -------------------------------- */

export const categoryInput = z.object({
  name: requiredText("a category name", 40),
});

export const expenseInput = z.object({
  date: isoDate,
  amount: positive("an amount"),
  categoryId: z.number({ error: "Choose a category." }).int(),
  title: requiredText("what it was for"),
  notes: optionalText(500),
});
export type ExpenseInput = z.input<typeof expenseInput>;

/* ----------------------------- Subscriptions ----------------------------- */

export const cycleSchema = z.enum(["monthly", "yearly"]);

export const subscriptionInput = z.object({
  name: requiredText("a name"),
  amount: positive("an amount"),
  categoryId: z.number({ error: "Choose a category." }).int(),
  cycle: cycleSchema,
  nextDueDate: isoDate,
  notes: optionalText(500),
});
export type SubscriptionInput = z.input<typeof subscriptionInput>;

export const markPaidInput = z.object({
  id: z.number().int(),
  amount: positive("an amount"),
  date: isoDate,
});
