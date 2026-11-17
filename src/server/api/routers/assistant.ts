import { z } from "zod";

import {
  clearUserKey,
  getPreferences,
  MODEL_OPTIONS,
  savePreferences,
} from "~/server/assistant/settings";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const assistantRouter = createTRPCRouter({
  settings: protectedProcedure.query(async ({ ctx }) => {
    const preferences = await getPreferences(ctx.session.user.id);
    return { ...preferences, models: MODEL_OPTIONS };
  }),

  saveSettings: protectedProcedure
    .input(
      z.object({
        model: z.string().max(60).optional(),
        /** A new Anthropic key to store for this account. */
        apiKey: z
          .string()
          .trim()
          .min(20, "That key looks too short.")
          .max(200, "That key looks too long.")
          .regex(/^sk-ant-/, "Anthropic keys start with sk-ant-.")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await savePreferences(ctx.session.user.id, input);
      return getPreferences(ctx.session.user.id);
    }),

  clearKey: protectedProcedure.mutation(async ({ ctx }) => {
    await clearUserKey(ctx.session.user.id);
    return getPreferences(ctx.session.user.id);
  }),
});
