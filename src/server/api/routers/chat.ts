import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { chatMessage, chatThread } from "~/server/db/schema";

const idInput = z.object({ id: z.number().int() });
const MAX_MESSAGES = 200;

/** A short, readable title from the first thing the user said. */
function titleFrom(messages: { role: string; parts: unknown[] }[]): string | null {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = message.parts
      .map((part) => {
        const candidate = part as { type?: string; text?: string };
        return candidate.type === "text" ? candidate.text ?? "" : "";
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  return null;
}

async function assertThread(userId: string, id: number) {
  const [thread] = await db
    .select()
    .from(chatThread)
    .where(and(eq(chatThread.id, id), eq(chatThread.userId, userId)))
    .limit(1);
  if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found." });
  return thread;
}

export const chatRouter = createTRPCRouter({
  threads: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: chatThread.id,
        title: chatThread.title,
        updatedAt: chatThread.updatedAt,
      })
      .from(chatThread)
      .where(eq(chatThread.userId, ctx.session.user.id))
      .orderBy(desc(chatThread.updatedAt))
      .limit(50);
    return rows;
  }),

  createThread: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(120).default("New chat") }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Chat rows are cheap but they add up; drop abandoned empty ones.
      await db.execute(sql`
        delete from chat_thread t
        where t.user_id = ${userId}
          and t.title = 'New chat'
          and t.created_at < now() - interval '1 hour'
          and not exists (
            select 1 from chat_message m where m.thread_id = t.id
          )
      `);

      const [row] = await db
        .insert(chatThread)
        .values({ userId, title: input.title })
        .returning({ id: chatThread.id, title: chatThread.title });
      return row!;
    }),

  renameThread: protectedProcedure
    .input(idInput.extend({ title: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await assertThread(ctx.session.user.id, input.id);
      await db
        .update(chatThread)
        .set({ title: input.title })
        .where(
          and(eq(chatThread.id, input.id), eq(chatThread.userId, ctx.session.user.id)),
        );
      return { id: input.id };
    }),

  deleteThread: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    await assertThread(ctx.session.user.id, input.id);
    await db
      .delete(chatThread)
      .where(
        and(eq(chatThread.id, input.id), eq(chatThread.userId, ctx.session.user.id)),
      );
    return { id: input.id };
  }),

  messages: protectedProcedure
    .input(z.object({ threadId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertThread(ctx.session.user.id, input.threadId);
      const rows = await db
        .select({
          id: chatMessage.id,
          role: chatMessage.role,
          parts: chatMessage.parts,
        })
        .from(chatMessage)
        .where(
          and(
            eq(chatMessage.threadId, input.threadId),
            eq(chatMessage.userId, ctx.session.user.id),
          ),
        )
        .orderBy(asc(chatMessage.createdAt));

      return rows.map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant" | "system",
        parts: row.parts as unknown[],
      }));
    }),

  /**
   * Replaces the thread's messages with the client's copy. Chat messages are a
   * document — the client always holds the truth after a stream or an approval,
   * so a replace is simpler and safer than diffing.
   */
  saveMessages: protectedProcedure
    .input(
      z.object({
        threadId: z.number().int(),
        messages: z
          .array(
            z.object({
              id: z.string().min(1).max(120),
              role: z.enum(["user", "assistant", "system"]),
              parts: z.array(z.unknown()).max(80),
            }),
          )
          .max(MAX_MESSAGES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const thread = await assertThread(userId, input.threadId);

      const ids = input.messages.map((message) => message.id);

      await db.transaction(async (tx) => {
        // Remove only what the client no longer has, then upsert the rest, so
        // two overlapping saves (finish and error) cannot collide.
        await tx
          .delete(chatMessage)
          .where(
            and(
              eq(chatMessage.threadId, thread.id),
              eq(chatMessage.userId, userId),
              ids.length > 0 ? notInArray(chatMessage.id, ids) : undefined,
            ),
          );

        if (input.messages.length > 0) {
          await tx
            .insert(chatMessage)
            .values(
              input.messages.map((message) => ({
                id: message.id,
                threadId: thread.id,
                userId,
                role: message.role,
                parts: message.parts,
              })),
            )
            .onConflictDoUpdate({
              target: chatMessage.id,
              set: {
                role: sql`excluded.role`,
                parts: sql`excluded.parts`,
              },
            });
        }

        const title =
          thread.title === "New chat" ? titleFrom(input.messages) : null;
        await tx
          .update(chatThread)
          .set({ updatedAt: new Date(), ...(title ? { title } : {}) })
          .where(eq(chatThread.id, thread.id));
      });

      return { ok: true, count: input.messages.length };
    }),
});
