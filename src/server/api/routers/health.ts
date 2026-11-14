import { sql } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const healthRouter = createTRPCRouter({
  check: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.execute<{ now: string }>(
      sql`select now()::text as now`,
    );
    return { ok: true, dbTime: rows[0]?.now ?? null };
  }),
});
