import { assetRouter } from "~/server/api/routers/asset";
import { assistantRouter } from "~/server/api/routers/assistant";
import { assetTxnRouter } from "~/server/api/routers/asset-txn";
import { categoryRouter } from "~/server/api/routers/category";
import { chatRouter } from "~/server/api/routers/chat";
import { expenseRouter } from "~/server/api/routers/expense";
import { healthRouter } from "~/server/api/routers/health";
import { overviewRouter } from "~/server/api/routers/overview";
import { priceRouter } from "~/server/api/routers/price";
import { subscriptionRouter } from "~/server/api/routers/subscription";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  assistant: assistantRouter,
  asset: assetRouter,
  assetTxn: assetTxnRouter,
  price: priceRouter,
  expense: expenseRouter,
  category: categoryRouter,
  subscription: subscriptionRouter,
  chat: chatRouter,
  overview: overviewRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.health.check();
 */
export const createCaller = createCallerFactory(appRouter);
