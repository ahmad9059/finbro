import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { env } from "~/env";
import { todayPK } from "~/lib/dates";
import { loadAssistantContext, renderContext } from "~/server/assistant/context";
import { mockChatResponse } from "~/server/assistant/mock";
import { buildSystemPrompt } from "~/server/assistant/prompt";
import { resolveApiKey, resolveModel } from "~/server/assistant/settings";
import { createAssistantTools } from "~/server/assistant/tools";
import { getSession } from "~/server/better-auth/server";

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.unknown()).max(80),
      }),
    )
    .min(1)
    .max(120),
});

/**
 * Streamed errors, so the chat shows a sentence rather than a bare HTTP status.
 */
function errorStream(message: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "start" });
        writer.write({ type: "error", errorText: message });
        writer.write({ type: "finish" });
      },
    }),
  });
}

/** Every message in an error's cause chain, plus its HTTP status. */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      const status = (current as { statusCode?: number }).statusCode;
      if (status) parts.push(`status ${status}`);
      const data = (current as { data?: unknown }).data;
      if (data) parts.push(JSON.stringify(data).slice(0, 400));
      current = (current as { cause?: unknown }).cause;
    } else {
      parts.push(
        typeof current === "string" ? current : JSON.stringify(current).slice(0, 200),
      );
      break;
    }
  }
  return parts.join(" | ");
}

/** Turns provider noise into something a person can act on. */
function friendlyError(error: unknown): string {
  const message = describeError(error);
  if (/credit balance|billing|insufficient quota/i.test(message)) {
    return "Your Anthropic account has no credit. Add funds in the console, or use a different key in Settings.";
  }
  if (/quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return "The model's rate limit is reached. Wait a moment and try again, or pick a smaller model.";
  }
  if (/invalid x-api-key|authentication_error|API key|401|403/i.test(message)) {
    return "Anthropic rejected the API key. Check it in Settings.";
  }
  if (/overloaded_error|529/i.test(message)) {
    return "Anthropic is overloaded right now. Try again in a moment.";
  }
  if (/safety|blocked/i.test(message)) {
    return "The model declined to answer that. Try rephrasing it.";
  }
  return "The assistant could not answer. Try again.";
}

/**
 * The assistant's streaming endpoint.
 *
 * Every call rebuilds the account snapshot server-side, so the model never
 * relies on data the browser could have edited. Tools are bound to the
 * signed-in user; write tools only execute after the owner approves them.
 * The model and key come from the user's settings: their own key (BYOK) when
 * present, the server key otherwise.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response("Invalid chat payload.", { status: 400 });
  }

  try {
    const context = await loadAssistantContext(session.user.id);

    if (env.ASSISTANT_MOCK === "true" && env.NODE_ENV !== "production") {
      return mockChatResponse(parsed.data.messages as UIMessage[], context);
    }

    const key = await resolveApiKey(session.user.id);
    if (!key) {
      return errorStream(
        "No Anthropic key is available. Add yours in Settings → Assistant, or set ANTHROPIC_API_KEY on the server.",
      );
    }

    const model = await resolveModel(session.user.id);
    const anthropic = createAnthropic({ apiKey: key.apiKey });

    const system = buildSystemPrompt(renderContext(context), todayPK());
    const tools = {
      ...createAssistantTools({ userId: session.user.id }),
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
    };

    const messages = await convertToModelMessages(
      parsed.data.messages as UIMessage[],
      { tools },
    );

    const result = streamText({
      model: anthropic(model),
      system,
      messages,
      tools,
      stopWhen: stepCountIs(8),
      temperature: 0.3,
      maxOutputTokens: 2500,
      maxRetries: 1,
      abortSignal: request.signal,
    });

    const response = result.toUIMessageStreamResponse({ onError: friendlyError });
    response.headers.set("x-assistant-model", model);
    return response;
  } catch (error) {
    console.error("[assistant] request failed", error);
    return errorStream(friendlyError(error));
  }
}
