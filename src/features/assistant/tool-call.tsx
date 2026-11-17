"use client";

import {
  CalendarClock,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Globe,
  HeartPulse,
  Landmark,
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
  portfolio_health: { label: "Health check", icon: HeartPulse },
  simulate_trade: { label: "Trade check", icon: Search },
  fund_search: { label: "Fund search", icon: Landmark },
  search_knowledge: { label: "Background notes", icon: BookOpen },
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
  update_expense: { label: "Update expense", icon: PencilLine, write: true },
  delete_expense: { label: "Delete expense", icon: Trash2, write: true },
  delete_transaction: {
    label: "Delete transaction",
    icon: Trash2,
    write: true,
  },
  update_subscription: {
    label: "Update subscription",
    icon: CalendarClock,
    write: true,
  },
  add_transaction: { label: "Add transaction", icon: PencilLine, write: true },
  add_holding: { label: "Add holding", icon: Wallet, write: true },
  set_price: { label: "Set price", icon: TrendingUp, write: true },
  mark_subscription_paid: {
    label: "Mark subscription paid",
    icon: Check,
    write: true,
  },
  add_subscription: {
    label: "Add subscription",
    icon: CalendarClock,
    write: true,
  },
  google_search: { label: "Web search", icon: Globe },
  web_search: { label: "Web search", icon: Globe },
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
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

/** Short, human lines describing a write before it runs. */
function describeInput(name: string, input: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const money = (value: unknown) =>
    typeof value === "number"
      ? `Rs ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : null;
  const add = (label: string, value: unknown) => {
    const shown = typeof value === "string" ? value : text(value);
    if (shown !== "") lines.push(`${label}: ${shown}`);
  };
  const holding = () =>
    add(
      "Holding",
      input.holding ?? (input.holdingId ? `id ${text(input.holdingId)}` : ""),
    );

  switch (name) {
    case "add_expense":
      add("For", input.title);
      add("Amount", money(input.amount));
      add("Category", input.category);
      add("Date", input.date);
      break;
    case "update_expense":
      add("Expense id", input.id);
      add("Title", input.title);
      add("Amount", money(input.amount));
      add("Category", input.category);
      add("Date", input.date);
      break;
    case "delete_expense":
      add("Expense id", input.id);
      break;
    case "add_transaction":
      holding();
      add("Kind", input.kind);
      add("Units", input.units);
      add("Price", input.price);
      add("Amount", money(input.amount));
      add(
        "Fees",
        typeof input.fees === "number" && input.fees > 0
          ? money(input.fees)
          : "",
      );
      add("Date", input.date);
      break;
    case "delete_transaction":
      add("Transaction id", input.id);
      break;
    case "add_holding":
      add("Holding", `${text(input.symbol)} ${text(input.name)}`.trim());
      add("Kind", input.kind);
      add("Units", input.units);
      add("Bought at", input.price);
      add("Opening balance", money(input.openingBalance));
      add(
        "Fees",
        typeof input.fees === "number" && input.fees > 0
          ? money(input.fees)
          : "",
      );
      add("Date", input.date);
      break;
    case "set_price":
      holding();
      add("New price", input.price);
      add("As of", input.date);
      break;
    case "add_subscription":
      add("Subscription", input.name);
      add("Amount", money(input.amount));
      add("Cycle", input.cycle);
      add("Next due", input.nextDueDate);
      break;
    case "update_subscription":
      add(
        "Subscription",
        input.subscription ??
          (input.subscriptionId ? `id ${text(input.subscriptionId)}` : ""),
      );
      add("Amount", money(input.amount));
      add("Next due", input.nextDueDate);
      add("Status", input.status);
      break;
    case "mark_subscription_paid":
      add(
        "Subscription",
        input.subscription ??
          (input.subscriptionId ? `id ${text(input.subscriptionId)}` : ""),
      );
      add("Amount", money(input.amount));
      add("Date", input.date);
      break;
  }

  const confirm = Array.isArray(input.confirm)
    ? (input.confirm as unknown[]).map(text).filter(Boolean)
    : [];
  if (confirm.length > 0)
    lines.push(`You confirmed: ${confirm.join(", ").replaceAll("_", " ")}`);
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
  const denied = state === "output-denied" || part.approval?.approved === false;
  const done = state === "output-available";
  // A tool can complete and still refuse: the rules said no, nothing was written.
  const refused =
    done &&
    typeof part.output === "object" &&
    part.output !== null &&
    (part.output as { ok?: unknown }).ok === false;
  const failed = state === "output-error" || refused;
  const refusal = refused ? (part.output as { error?: unknown }).error : null;
  const input =
    part.input && typeof part.input === "object"
      ? (part.input as Record<string, unknown>)
      : {};

  if (pendingApproval) {
    return (
      <div className="border-border bg-card shadow-soft my-3 overflow-hidden rounded-lg border">
        <div className="border-border/70 flex items-center gap-2 border-b px-4 py-2.5">
          <Icon className="text-primary size-4" aria-hidden="true" />
          <span className="type-ui-sm font-medium">{meta.label}</span>
          <span className="type-legal text-muted-foreground ml-auto">
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
        className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors"
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
        <Icon
          className="text-muted-foreground size-3.5 shrink-0"
          aria-hidden="true"
        />
        <span className="type-legal text-muted-foreground">
          {meta.label}
          {state === "approval-requested"
            ? " · waiting"
            : denied
              ? " · denied"
              : refused && meta.write
                ? " · not recorded"
                : done && meta.write
                  ? " · approved"
                  : ""}
        </span>
        {refused && typeof refusal === "string" ? (
          <span className="type-legal text-loss min-w-0 flex-1 truncate">
            {refusal}
          </span>
        ) : done &&
          typeof part.output === "object" &&
          part.output &&
          "summary" in part.output ? (
          <span className="type-legal text-foreground min-w-0 flex-1 truncate">
            {(part.output as { summary?: string }).summary}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "text-muted-foreground ml-auto size-3.5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <pre className="bg-muted/50 type-legal text-muted-foreground mt-1 max-h-56 overflow-auto rounded-md p-3">
          {JSON.stringify(
            { input, output: part.output ?? part.errorText },
            null,
            2,
          )}
        </pre>
      ) : null}
    </div>
  );
}

export { TOOL_META };
