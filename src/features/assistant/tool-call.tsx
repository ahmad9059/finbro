"use client";

import {
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  Globe,
  Loader2,
  Minus,
  PencilLine,
  ReceiptText,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/** Readable labels for every tool the assistant can call. */
const TOOL_META: Record<
  string,
  { label: string; icon: LucideIcon; write?: boolean }
> = {
  portfolio_summary: { label: "Portfolio summary", icon: Wallet },
  list_holdings: { label: "Holdings", icon: Wallet },
  list_transactions: { label: "Transactions", icon: ReceiptText },
  expense_report: { label: "Spending report", icon: ReceiptText },
  search_expenses: { label: "Expense search", icon: Search },
  list_subscriptions: { label: "Subscriptions", icon: CalendarClock },
  market_quote: { label: "Market quote", icon: TrendingUp },
  search_symbols: { label: "Symbol search", icon: Search },
  spending_trend: { label: "Spending trend", icon: ReceiptText },
  category_share: { label: "Allocation", icon: Wallet },
  add_expense: { label: "Add expense", icon: ReceiptText, write: true },
  delete_expense: { label: "Delete expense", icon: Trash2, write: true },
  add_transaction: { label: "Add transaction", icon: PencilLine, write: true },
  add_holding: { label: "Add holding", icon: Wallet, write: true },
  set_price: { label: "Set price", icon: TrendingUp, write: true },
  mark_subscription_paid: {
    label: "Mark subscription paid",
    icon: Check,
    write: true,
  },
  add_subscription: { label: "Add subscription", icon: CalendarClock, write: true },
  google_search: { label: "Web search", icon: Globe },
};

export type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  /** Present only on parts that stop for approval. */
  approval?: { id?: string; approved?: boolean; isAutomatic?: boolean };
};

export function toolNameOf(partType: string) {
  return partType.startsWith("tool-") ? partType.slice(5) : partType;
}

/** A printable scalar, or an empty string for objects and null. */
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** Short, human lines describing a write before it runs. */
function describeInput(name: string, input: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const money = (value: unknown) =>
    typeof value === "number"
      ? `Rs ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : null;

  if (name === "add_expense") {
    if (input.title) lines.push(`For: ${text(input.title)}`);
    const amount = money(input.amount);
    if (amount) lines.push(`Amount: ${amount}`);
    if (input.category) lines.push(`Category: ${text(input.category)}`);
    if (input.date) lines.push(`Date: ${text(input.date)}`);
  } else if (name === "delete_expense") {
    lines.push(`Expense id: ${text(input.id ?? "")}`);
  } else if (name === "add_transaction") {
    if (input.holding) lines.push(`Holding: ${text(input.holding)}`);
    if (input.kind) lines.push(`Kind: ${text(input.kind)}`);
    if (input.units) lines.push(`Units: ${text(input.units)}`);
    const amount = money(input.amount);
    if (input.price) lines.push(`Price: ${text(input.price)}`);
    if (amount) lines.push(`Amount: ${amount}`);
    if (input.date) lines.push(`Date: ${text(input.date)}`);
  } else if (name === "add_holding") {
    if (input.name || input.symbol)
      lines.push(`Holding: ${text(input.symbol ?? "")} ${text(input.name ?? "")}`.trim());
    if (input.units) lines.push(`Units: ${text(input.units)}`);
    if (input.openingBalance) lines.push(`Opening balance: ${money(input.openingBalance)}`);
  } else if (name === "set_price") {
    if (input.holding) lines.push(`Holding: ${text(input.holding)}`);
    if (input.price) lines.push(`New price: ${text(input.price)}`);
  } else if (name === "mark_subscription_paid") {
    if (input.subscription) lines.push(`Subscription: ${text(input.subscription)}`);
    const amount = money(input.amount);
    if (amount) lines.push(`Amount: ${amount}`);
  } else if (name === "add_subscription") {
    if (input.name) lines.push(`Subscription: ${text(input.name)}`);
    const amount = money(input.amount);
    if (amount) lines.push(`Amount: ${amount}`);
    if (input.cycle) lines.push(`Cycle: ${text(input.cycle)}`);
  }

  return lines;
}

/**
 * One tool call. Reads are a quiet line the user can expand; writes block on
 * an approval card showing exactly what will change.
 */
export function ToolCall({
  part,
  onApprove,
}: {
  part: ToolPart;
  onApprove: (approvalId: string, approved: boolean) => void;
}) {
  const name = toolNameOf(part.type);
  const meta = TOOL_META[name] ?? { label: name, icon: Search };
  const Icon = meta.icon;
  const [open, setOpen] = useState(false);

  const state = part.state ?? "input-available";
  const pendingApproval =
    state === "approval-requested" && part.approval?.id
      ? part.approval.id
      : null;
  const running = state === "input-available" || state === "input-streaming";
  const failed = state === "output-error";
  const denied = state === "output-denied" || part.approval?.approved === false;
  const done = state === "output-available";
  const input =
    part.input && typeof part.input === "object"
      ? (part.input as Record<string, unknown>)
      : {};

  if (pendingApproval) {
    return (
      <div className="my-3 overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          <span className="type-ui-sm font-medium">{meta.label}</span>
          <span className="ml-auto type-legal text-muted-foreground">
            needs your approval
          </span>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <p className="type-ui-sm text-muted-foreground">
            The assistant wants to change your data:
          </p>
          <ul className="flex flex-col gap-1">
            {describeInput(name, input).map((line) => (
              <li key={line} className="type-ui-sm">
                {line}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onApprove(pendingApproval, true)}>
              <Check />
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onApprove(pendingApproval, false)}
            >
              <X />
              Deny
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full",
            failed || denied
              ? "bg-loss/10 text-loss"
              : done
                ? "bg-gain/10 text-gain"
                : "bg-muted text-muted-foreground",
          )}
        >
          {running ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : failed || denied ? (
            <CircleAlert className="size-3" aria-hidden="true" />
          ) : done ? (
            <Check className="size-3" aria-hidden="true" />
          ) : (
            <Minus className="size-3" aria-hidden="true" />
          )}
        </span>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="type-legal text-muted-foreground">
          {meta.label}
          {state === "approval-requested"
            ? " · waiting"
            : denied
              ? " · denied"
              : done && meta.write
                ? " · approved"
                : ""}
        </span>
        {done && typeof part.output === "object" && part.output && "summary" in part.output ? (
          <span className="min-w-0 flex-1 truncate type-legal text-foreground">
            {(part.output as { summary?: string }).summary}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-muted/50 p-3 type-legal text-muted-foreground">
          {JSON.stringify({ input, output: part.output ?? part.errorText }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export { TOOL_META };
