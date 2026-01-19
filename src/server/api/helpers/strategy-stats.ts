import { and, eq, isNull } from "drizzle-orm";
import { calculateAggregateStats } from "@/lib/analytics";
import type { CachedStats } from "@/lib/shared";
import { getUserBreakevenThreshold } from "@/server/api/helpers";
import type { db as DbType } from "@/server/db";
import { strategies, trades } from "@/server/db/schema";

type Db = typeof DbType;

/**
 * Compute and cache strategy stats for a public strategy.
 * This function is designed to be called whenever a trade is closed
 * to keep marketplace stats up-to-date.
 *
 * @param db - Database client
 * @param strategyId - The strategy ID to compute stats for
 * @param userId - The user ID who owns the strategy (for breakeven threshold)
 * @returns The computed stats, or null if strategy is not public or not found
 */
export async function computeAndCacheStrategyStats(
	db: Db,
	strategyId: string,
	userId: string,
): Promise<CachedStats | null> {
	// Get strategy to check if it's public
	const strategy = await db.query.strategies.findFirst({
		where: and(eq(strategies.id, strategyId), eq(strategies.userId, userId)),
		columns: { id: true, isPublic: true },
	});

	// Skip if strategy doesn't exist or isn't public
	if (!strategy || !strategy.isPublic) {
		return null;
	}

	// Get all closed trades for this strategy
	const strategyTrades = await db.query.trades.findMany({
		where: and(
			eq(trades.strategyId, strategyId),
			eq(trades.userId, userId),
			eq(trades.status, "closed"),
			isNull(trades.deletedAt),
		),
		columns: {
			netPnl: true,
			entryPrice: true,
			stopLoss: true,
			quantity: true,
			symbol: true,
			instrumentType: true,
		},
	});

	// Get user's breakeven threshold
	const beThreshold = await getUserBreakevenThreshold(db, userId);

	// Compute stats using shared analytics
	const stats = calculateAggregateStats(strategyTrades, beThreshold);

	// Build cached stats object
	const cachedStats: CachedStats = {
		totalTrades: stats.totalTrades,
		wins: stats.wins,
		losses: stats.losses,
		winRate: stats.winRate,
		profitFactor: stats.profitFactor === Infinity ? null : stats.profitFactor,
		avgR: stats.avgRMultiple,
		avgWin: stats.avgWin,
		avgLoss: stats.avgLoss,
		computedAt: new Date().toISOString(),
	};

	// Update strategy cachedStats
	await db
		.update(strategies)
		.set({ cachedStats: JSON.stringify(cachedStats) })
		.where(eq(strategies.id, strategyId));

	return cachedStats;
}

/**
 * Refresh cached stats for a strategy if it's public.
 * Called after trade mutations (close, update to closed status).
 *
 * @param db - Database client
 * @param strategyId - The strategy ID (may be null if trade has no strategy)
 * @param userId - The user ID who owns the trade/strategy
 */
export async function refreshStrategyStatsIfPublic(
	db: Db,
	strategyId: string | null,
	userId: string,
): Promise<void> {
	// Skip if no strategy assigned
	if (!strategyId) {
		return;
	}

	// Compute and cache stats - this function handles the public check internally
	await computeAndCacheStrategyStats(db, strategyId, userId);
}
