import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
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
/** Turns provider noise into something a person can act on. */
function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Gemini's limit for this key is reached. Wait a minute and try again, or enable billing on the key.";
  }
  if (/high demand|503|UNAVAILABLE/i.test(message)) {
    return "Gemini is busy right now. Try again in a moment.";
  }
  if (/API key|401|403/i.test(message)) {
    return "The Gemini API key is missing or not accepted.";
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

  try {
    const context = await loadAssistantContext(session.user.id);

    if (env.ASSISTANT_MOCK === "true" && env.NODE_ENV !== "production") {
      return mockChatResponse(
        parsed.data.messages as UIMessage[],
        context,
      );
    }

    const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
    const system = buildSystemPrompt(renderContext(context), todayPK());
    const accountTools = createAssistantTools({ userId: session.user.id });

    const tools = {
      ...accountTools,
      // Grounding through Gemini's own search: no extra key, sources come back
      // as citations the UI renders under the answer.
      google_search: google.tools.googleSearch({}),
    };

    const result = streamText({
      model: google(env.GEMINI_MODEL ?? "gemini-3.5-flash"),
      system,
      messages: await convertToModelMessages(
        parsed.data.messages as UIMessage[],
        { tools },
      ),
      tools,
      stopWhen: stepCountIs(8),
      temperature: 0.3,
      maxOutputTokens: 2500,
      maxRetries: 1,
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({ onError: friendlyError });
  } catch (error) {
    console.error("[assistant] request failed", error);
    return new Response("The assistant is unavailable right now.", {
      status: 500,
    });
  }
}
