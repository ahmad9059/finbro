"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  ArrowUp,
  CircleAlert,
  CornerDownLeft,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LogoMark } from "~/components/shared/logo";
import { usePrivacy } from "~/components/shared/privacy-context";
import { Button } from "~/components/ui/button";
import { errorMessage } from "~/lib/errors";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import { Markdown } from "./markdown";
import { ToolCall } from "./tool-call";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown[];
};

const SUGGESTIONS = [
  "How is my portfolio doing this month?",
  "Where did my money go in November?",
  "What's due in the next two weeks?",
  "Compare my mutual funds",
  "Add Rs 2,500 for groceries",
];

export function ChatWindow({
  threadId,
  initialMessages,
  onSaved,
}: {
  threadId: number;
  initialMessages: ChatMessage[];
  onSaved?: () => void;
}) {
  const [input, setInput] = useState("");
  const { hidden } = usePrivacy();


  const save = api.chat.saveMessages.useMutation();
  const savedRef = useRef<string>("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    regenerate,
    addToolApprovalResponse,
  } = useChat({
    id: String(threadId),
    messages: initialMessages as UIMessage[],
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ messages: finished }) => {
      persist(finished);
    },
    onError: () => {
      void persist(messages);
    },
  });

  /** One save at a time; a later one always supersedes an earlier one. */
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback(
    (list: ChatMessage[]) => {
      const fingerprint = `${list.length}:${list[list.length - 1]?.id ?? ""}`;
      if (savedRef.current === fingerprint) return;
      savedRef.current = fingerprint;
      saveQueue.current = saveQueue.current
        .then(async () => {
          await save.mutateAsync({ threadId, messages: list });
          onSaved?.();
        })
        .catch(() => {
          // A later save catches up; the chat itself is unaffected.
        });
    },
    [onSaved, save, threadId],
  );

  const streaming = status === "streaming" || status === "submitted";
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    void sendMessage({ text: trimmed });
  }

  function approve(approvalId: string, approved: boolean) {
    void addToolApprovalResponse({ id: approvalId, approved });
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[920px] 2xl:max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-2">
          {isEmpty ? (
            <div className="flex flex-col items-center gap-6 pt-10 text-center sm:pt-16">
              <div className="flex size-14 items-center justify-center rounded-full bg-tint">
                <Sparkles className="size-6 text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="type-lead">Ask about your money</h2>
                <p className="max-w-md type-body text-muted-foreground">
                  I can read every holding, expense and subscription. I can also
                  change them — with your approval.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="rounded-full bg-secondary px-4 py-2 type-ui-sm text-secondary-foreground transition-colors hover:bg-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <Message
              key={message.id}
              message={message as unknown as ChatMessage}
              streaming={streaming && message.id === messages[messages.length - 1]?.id}
              onApprove={approve}
            />
          ))}

          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <LogoMark className="size-6" />
              <span className="flex gap-1" aria-label="Thinking">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="flex flex-col gap-3 rounded-lg border border-loss/30 bg-loss/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 type-ui-sm text-loss">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {errorMessage(error, "The assistant could not answer. Try again.")}
              </p>
              <Button size="sm" variant="secondary" onClick={() => void regenerate()}>
                <RotateCcw />
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border/70 bg-background">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
          className="mx-auto flex w-full max-w-[920px] 2xl:max-w-[1180px] flex-col gap-2 px-4 py-4 lg:px-2"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-soft focus-within:ring-2 focus-within:ring-ring/30">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              placeholder="Ask about holdings, spending, or ask for a change…"
              aria-label="Message the assistant"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 type-body outline-none placeholder:text-muted-foreground"
              style={{ fieldSizing: "content" }}
            />
            {streaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={stop}
                aria-label="Stop"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 type-legal text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CornerDownLeft className="size-3" aria-hidden="true" />
              Enter to send · Shift+Enter for a new line
            </span>
            <span aria-hidden="true">·</span>
            <span>Changes need your approval</span>
            {hidden ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-loss">
                  Answers show amounts even while privacy mode is on
                </span>
              </>
            ) : null}
          </p>
        </form>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: delay }}
    />
  );
}

function Message({
  message,
  streaming,
  onApprove,
}: {
  message: ChatMessage;
  streaming: boolean;
  onApprove: (approvalId: string, approved: boolean) => void;
}) {
  const parts = message.parts as {
    type: string;
    text?: string;
    url?: string;
    title?: string;
    toolCallId?: string;
    state?: string;
    input?: unknown;
    output?: unknown;
    approval?: { id?: string; approved?: boolean };
  }[];

  if (message.role === "user") {
    const text = parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 type-body whitespace-pre-wrap text-secondary-foreground">
          {text}
        </div>
      </div>
    );
  }

  const sources = parts.filter(
    (part) => part.type === "source-url" && typeof part.url === "string",
  );

  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 size-7 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {parts.map((part, index) => {
          if (part.type === "text") {
            if (!part.text) return null;
            return (
              <Markdown key={index} className={cn(streaming && index === parts.length - 1 && "chat-caret")}>
                {part.text}
              </Markdown>
            );
          }
          if (part.type.startsWith("tool-")) {
            return (
              <ToolCall
                key={part.toolCallId ?? index}
                part={part}
                onApprove={onApprove}
              />
            );
          }
          if (part.type === "reasoning" && part.text) {
            return (
              <p key={index} className="type-legal text-muted-foreground">
                {part.text}
              </p>
            );
          }
          return null;
        })}

        {sources.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sources.slice(0, 5).map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="max-w-[240px] truncate rounded-full bg-muted px-2.5 py-1 type-legal text-muted-foreground transition-colors hover:text-foreground"
              >
                {source.title ?? new URL(source.url!).hostname}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type { ChatMessage };
