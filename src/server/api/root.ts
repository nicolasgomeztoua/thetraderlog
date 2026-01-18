import { accountsRouter } from "@/server/api/routers/accounts";
import { analyticsRouter } from "@/server/api/routers/analytics";
import { dailyJournalRouter } from "@/server/api/routers/dailyJournal";
import { filterPresetsRouter } from "@/server/api/routers/filterPresets";
import { marketDataRouter } from "@/server/api/routers/marketData";
import { marketplaceRouter } from "@/server/api/routers/marketplace";
import { settingsRouter } from "@/server/api/routers/settings";
import { storageRouter } from "@/server/api/routers/storage";
import { strategiesRouter } from "@/server/api/routers/strategies";
import { tagsRouter } from "@/server/api/routers/tags";
import { tradesRouter } from "@/server/api/routers/trades";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	trades: tradesRouter,
	marketData: marketDataRouter,
	accounts: accountsRouter,
	settings: settingsRouter,
	filterPresets: filterPresetsRouter,
	tags: tagsRouter,
	strategies: strategiesRouter,
	analytics: analyticsRouter,
	dailyJournal: dailyJournalRouter,
	storage: storageRouter,
	marketplace: marketplaceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.trades.getAll();
 *       ^? Trade[]
 */
export const createCaller = createCallerFactory(appRouter);
