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
import { buildSystemPrompt } from "~/server/assistant/prompt";
import { mockChatResponse } from "~/server/assistant/mock";
import {
  modelFor,
  providersToTry,
} from "~/server/assistant/providers";
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
 * The assistant's streaming endpoint.
 *
 * Every call rebuilds the account snapshot server-side, so the model never
 * relies on data the browser could have edited. Tools are bound to the signed-in
 * user; write tools only execute after the owner approves them in the UI.
 */
/**
 * A streamed error, so the chat shows our sentence rather than a raw HTTP
 * status with an empty body.
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
      parts.push(typeof current === "string" ? current : JSON.stringify(current).slice(0, 200));
      break;
    }
  }
  return parts.join(" | ");
}

/** Turns provider noise into something a person can act on. */
function friendlyError(error: unknown): string {
  const message = describeError(error);
  if (/quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Gemini's limit for this key is reached. Wait a minute and try again, or enable billing on the key.";
  }
  if (/high demand|503|UNAVAILABLE/i.test(message)) {
    return "Gemini is busy right now. Try again in a moment.";
  }
  if (/credit balance|billing|insufficient_quota/i.test(message)) {
    return "The provider account has no credit. Add funds, or change the provider order.";
  }
  if (/invalid x-api-key|authentication_error|API key|401|403/i.test(message)) {
    return "A provider key was rejected. Check GEMINI_API_KEY and ANTHROPIC_API_KEY.";
  }
  if (/overloaded_error|529/i.test(message)) {
    return "The model is overloaded right now. Try again in a moment.";
  }
  if (/safety|blocked/i.test(message)) {
    return "Gemini declined to answer that. Try rephrasing it.";
  }
  return "The assistant could not answer. Try again.";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  if (!env.GEMINI_API_KEY) {
    return new Response("The assistant is not configured.", { status: 503 });
  }

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
  const preferred = (json as { provider?: unknown } | null)?.provider;

  try {
    const context = await loadAssistantContext(session.user.id);

    if (env.ASSISTANT_MOCK === "true" && env.NODE_ENV !== "production") {
      return mockChatResponse(
        parsed.data.messages as UIMessage[],
        context,
      );
    }

    const system = buildSystemPrompt(renderContext(context), todayPK());
    const accountTools = createAssistantTools({ userId: session.user.id });
    const providers = providersToTry(preferred);

    if (providers.length === 0) {
      return errorStream(
        "No assistant provider is configured. Add GEMINI_API_KEY or ANTHROPIC_API_KEY.",
      );
    }

    const messages = await convertToModelMessages(
      parsed.data.messages as UIMessage[],
      {},
    );

    let lastError: unknown;
    for (const provider of providers) {
      const tools = { ...accountTools, ...provider.searchTool };
      try {
        const result = streamText({
          model: provider.model as never,
          providerOptions: provider.providerOptions as never,
          system,
          messages,
          tools,
          stopWhen: stepCountIs(8),
          temperature: 0.3,
          maxOutputTokens: 2500,
          maxRetries: 1,
          abortSignal: request.signal,
        });

        // Wait for the provider's first HTTP response: a quota or auth failure
        // arrives here, before any token, so the next provider can take over.
        await result.response;

        const response = result.toUIMessageStreamResponse({
          onError: friendlyError,
        });
        response.headers.set("x-assistant-provider", provider.id);
        response.headers.set("x-assistant-model", modelFor(provider.id));
        return response;
      } catch (error) {
        lastError = error;
        console.warn(
          `[assistant] ${provider.id} failed, trying the next provider:`,
          error instanceof Error ? error.message.slice(0, 160) : error,
        );
      }
    }

    console.error("[assistant] every provider failed", lastError);
    return errorStream(friendlyError(lastError));
  } catch (error) {
    console.error("[assistant] request failed", error);
    return new Response("The assistant is unavailable right now.", {
      status: 500,
    });
  }
}
