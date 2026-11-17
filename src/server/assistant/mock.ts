import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";

import type { AssistantContext } from "./context";

type Part = {
  type: string;
  text?: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  approval?: { approved?: boolean; id?: string };
};

function partsOf(message: UIMessage): Part[] {
  // The SDK's part union is wider than the fields this mock reads.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return (message.parts ?? []) as Part[];
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function lastUserText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message?.role !== "user") continue;
    return partsOf(message)
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join(" ")
      .trim();
  }
  return "";
}

/** A write tool the user has just decided on, if any. */
function decidedApproval(messages: UIMessage[]) {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return null;
  for (const part of partsOf(last)) {
    if (!part.type.startsWith("tool-")) continue;
    const approved = part.approval?.approved;
    if (approved === undefined) continue;
    return { part, approved, toolName: part.type.slice(5) };
  }
  return null;
}

/**
 * A scripted assistant used only when `ASSISTANT_MOCK=true` in development.
 *
 * It streams the same chunk shapes the real route produces — text, a tool
 * call, an approval request and its result — so the chat UI, approval flow,
 * persistence and error handling can be exercised without spending Anthropic
 * credit. It never writes to the database.
 */
export function mockChatResponse(messages: UIMessage[], context: AssistantContext) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });

      const decision = decidedApproval(messages);
      if (decision) {
        const input = (decision.part.input ?? {}) as Record<string, unknown>;
        if (decision.approved) {
          writer.write({
            type: "tool-output-available",
            toolCallId: decision.part.toolCallId ?? "mock-call",
            output: {
              ok: true,
              summary: `Recorded Rs ${Number(input.amount ?? 0).toLocaleString("en-US")} for ${text(input.title ?? "the expense")} under ${text(input.category ?? "Other")}. (Mock mode: nothing was saved.)`,
            },
          });
          writeText(
            writer,
            `Done — I would have recorded **Rs ${Number(input.amount ?? 0).toLocaleString("en-US")}** for *${text(input.title ?? "the expense")}* under ${text(input.category ?? "Other")}. This is mock mode, so nothing was saved.`,
          );
        } else {
          writer.write({
            type: "tool-output-denied",
            toolCallId: decision.part.toolCallId ?? "mock-call",
          });
          writeText(writer, "Understood — I did not make that change.");
        }
        writer.write({ type: "finish" });
        return;
      }

      const question = lastUserText(messages);

      const amount = /(\d[\d,]*)/.exec(question)?.[1]?.replace(/,/g, "");
      const wantsWrite =
        /add|record|log|create/i.test(question) &&
        amount &&
        /expense|spent|grocery|groceries|fuel|bill/i.test(question);

      if (wantsWrite) {
        const toolCallId = `mock-${Date.now()}`;
        const approvalId = `mock-approval-${Date.now()}`;
        const title = /grocer/i.test(question) ? "Groceries" : "Expense";
        const input = {
          title,
          amount: Number(amount),
          category: /grocer/i.test(question) ? "Food" : "Other",
        };
        writeText(writer, "I can record that. Please approve the change:");
        writer.write({
          type: "tool-input-start",
          toolCallId,
          toolName: "add_expense",
        });
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: "add_expense",
          input,
        });
        writer.write({
          type: "tool-approval-request",
          approvalId,
          toolCallId,
        });
        writer.write({ type: "finish" });
        return;
      }

      if (/net worth|portfolio|doing/i.test(question)) {
        writeText(
          writer,
          `Your net worth is **Rs ${context.netWorth.toLocaleString("en-US")}** across ${context.holdings.length} holdings.\n\n- ${context.byKind
            .map(
              (row) =>
                `${row.kind.replace("_", " ")}: Rs ${row.value.toLocaleString("en-US")}`,
            )
            .join("\n- ")}\n\nThis is a mock reply; the numbers come from your real account.`,
        );
        writer.write({
          type: "source-url",
          sourceId: "mock-source",
          url: "https://dps.psx.com.pk/",
          title: "PSX data portal",
        });
      } else {
        writeText(
          writer,
          "Mock mode is on, so I will not call Anthropic. Ask about your net worth, or try *add 2,500 for groceries* to see the approval flow.",
        );
      }

      writer.write({ type: "finish" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function writeText(writer: UIMessageStreamWriter, text: string) {
  const id = `text-${Date.now()}`;
  writer.write({ type: "text-start", id });
  for (const piece of text.match(/.{1,24}/gs) ?? [text]) {
    writer.write({ type: "text-delta", id, delta: piece });
  }
  writer.write({ type: "text-end", id });
}
