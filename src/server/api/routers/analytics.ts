import {
	and,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lte,
	type SQL,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import {
	buildEquityCurve,
	calculateAggregateStats,
	calculateRiskMetrics,
	findDrawdownPeriods,
	parsePnl,
} from "@/lib/analytics";
import {
	getDateStringInTimezone,
	getDayOfWeekInTimezone,
	getHourInTimezone,
	getMonthStringInTimezone,
	utcHourToLocalHour,
} from "@/lib/shared";
import { calculateActualRMultiple } from "@/lib/trades/calculations";
import {
	getActiveAccountsSubquery,
	getUserBreakevenThreshold,
	getUserTimezone,
} from "@/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	accounts,
	filterPresets,
	trades,
	tradeTags,
	userSettings,
} from "@/server/db/schema";

// =============================================================================
// ANALYTICS FILTER INPUT SCHEMA
// Shared input schema for filtering analytics queries
// =============================================================================

const analyticsFilterInput = z.object({
	symbols: z.array(z.string()).optional(),
	dateRange: z
		.object({
			start: z.string().datetime().nullable(),
			end: z.string().datetime().nullable(),
		})
		.optional(),
	daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
	hours: z.array(z.number().min(0).max(23)).optional(),
	sessions: z.array(z.string()).optional(),
	strategies: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	rMultipleRange: z
		.object({
			min: z.number().nullable(),
			max: z.number().nullable(),
		})
		.optional(),
	positionSizeRange: z
		.object({
			min: z.number().nullable(),
			max: z.number().nullable(),
		})
		.optional(),
	outcome: z.enum(["all", "win", "loss", "breakeven"]).optional(),
	reviewed: z.enum(["all", "reviewed", "unreviewed"]).optional(),
});

type AnalyticsFilterInput = z.infer<typeof analyticsFilterInput>;

// =============================================================================
// FILTER BUILDER HELPER
// Builds WHERE conditions from filter input
// =============================================================================

/**
 * Build SQL conditions from analytics filters
 * Returns an array of conditions to be combined with AND
 * Note: Some filters (daysOfWeek, hours, sessions, outcome, rMultiple, positionSize)
 * require post-query filtering as they depend on computed values
 */
function buildFilterConditions(
	filters: AnalyticsFilterInput | undefined,
	tradesTable: typeof trades,
): SQL[] {
	const conditions: SQL[] = [];

	if (!filters) return conditions;

	// Symbol filter
	if (filters.symbols && filters.symbols.length > 0) {
		conditions.push(inArray(tradesTable.symbol, filters.symbols));
	}

	// Date range filter (on entry time for consistency)
	if (filters.dateRange?.start) {
		conditions.push(
			gte(tradesTable.entryTime, new Date(filters.dateRange.start)),
		);
	}
	if (filters.dateRange?.end) {
		const endDate = new Date(filters.dateRange.end);
		// Only extend to end of day if time is midnight (date-only filter)
		// This preserves exact datetime filtering for specific timestamps
		if (
			endDate.getUTCHours() === 0 &&
			endDate.getUTCMinutes() === 0 &&
			endDate.getUTCSeconds() === 0 &&
			endDate.getUTCMilliseconds() === 0
		) {
			endDate.setUTCHours(23, 59, 59, 999);
		}
		conditions.push(lte(tradesTable.entryTime, endDate));
	}

	// Strategy filter
	if (filters.strategies && filters.strategies.length > 0) {
		conditions.push(inArray(tradesTable.strategyId, filters.strategies));
	}

	// Reviewed filter
	if (filters.reviewed && filters.reviewed !== "all") {
		conditions.push(
			eq(tradesTable.isReviewed, filters.reviewed === "reviewed"),
		);
	}

	// Position size range filter (can be done in SQL)
	if (
		filters.positionSizeRange?.min !== null &&
		filters.positionSizeRange?.min !== undefined
	) {
		conditions.push(
			gte(tradesTable.quantity, filters.positionSizeRange.min.toString()),
		);
	}
	if (
		filters.positionSizeRange?.max !== null &&
		filters.positionSizeRange?.max !== undefined
	) {
		conditions.push(
			lte(tradesTable.quantity, filters.positionSizeRange.max.toString()),
		);
	}

	return conditions;
}

/**
 * Apply post-query filters that require computed values
 * These filters cannot be done in SQL and must be applied to fetched data
 */
interface TradeWithComputedFields {
	netPnl: string | null;
	entryTime: Date;
	exitTime?: Date | null;
	entryPrice?: string;
	stopLoss?: string | null;
	quantity?: string;
	symbol?: string;
	instrumentType?: string | null;
	direction?: string;
}

function applyPostQueryFilters<T extends TradeWithComputedFields>(
	trades: T[],
	filters: AnalyticsFilterInput | undefined,
	options: {
		beThreshold: number;
		userTimezone: string;
	},
): T[] {
	if (!filters) return trades;

	let filtered = trades;

	// Days of week filter
	if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
		filtered = filtered.filter((trade) => {
			const dayOfWeek = getDayOfWeekInTimezone(
				trade.entryTime,
				options.userTimezone,
			);
			return filters.daysOfWeek?.includes(dayOfWeek);
		});
	}

	// Hours filter
	if (filters.hours && filters.hours.length > 0) {
		filtered = filtered.filter((trade) => {
			const hour = getHourInTimezone(trade.entryTime, options.userTimezone);
			return filters.hours?.includes(hour);
		});
	}

	// Sessions filter (session hours stored as UTC, convert to local for comparison)
	if (filters.sessions && filters.sessions.length > 0) {
		// Default session definitions (hours stored as UTC)
		const sessionDefsUtc: Record<string, { start: number; end: number }> = {
			asia: { start: 0, end: 8 },
			london: { start: 8, end: 16 },
			"new york": { start: 13, end: 21 },
			new_york: { start: 13, end: 21 },
		};

		// Convert UTC session hours to local hours for this user
		const sessionDefs: Record<string, { start: number; end: number }> = {};
		for (const [key, utcSession] of Object.entries(sessionDefsUtc)) {
			sessionDefs[key] = {
				start: utcHourToLocalHour(utcSession.start, options.userTimezone),
				end: utcHourToLocalHour(utcSession.end, options.userTimezone),
			};
		}

		filtered = filtered.filter((trade) => {
			const hour = getHourInTimezone(trade.entryTime, options.userTimezone);
			return filters.sessions?.some((sessionName) => {
				const session = sessionDefs[sessionName.toLowerCase()];
				if (!session) return false;
				if (session.start <= session.end) {
					return hour >= session.start && hour < session.end;
				}
				// Handle wrap-around sessions
				return hour >= session.start || hour < session.end;
			});
		});
	}

	// Outcome filter (win/loss/breakeven)
	if (filters.outcome && filters.outcome !== "all") {
		filtered = filtered.filter((trade) => {
			const pnl = parsePnl(trade.netPnl);
			switch (filters.outcome) {
				case "win":
					return pnl > options.beThreshold;
				case "loss":
					return pnl < -options.beThreshold;
				case "breakeven":
					return pnl >= -options.beThreshold && pnl <= options.beThreshold;
				default:
					return true;
			}
		});
	}

	// R-Multiple range filter
	if (
		filters.rMultipleRange &&
		(filters.rMultipleRange.min !== null || filters.rMultipleRange.max !== null)
	) {
		filtered = filtered.filter((trade) => {
			if (!trade.stopLoss || !trade.entryPrice || !trade.quantity) return true;

			// Use shared utility for consistent R-multiple calculation
			const rMultiple = calculateActualRMultiple(
				parsePnl(trade.netPnl),
				parseFloat(trade.entryPrice),
				parseFloat(trade.stopLoss),
				parseFloat(trade.quantity),
				trade.symbol ?? "",
				(trade.instrumentType as "futures" | "forex") ?? "futures",
			);

			if (rMultiple === null) return true;

			if (
				filters.rMultipleRange?.min !== null &&
				filters.rMultipleRange?.min !== undefined &&
				rMultiple < filters.rMultipleRange.min
			) {
				return false;
			}
			if (
				filters.rMultipleRange?.max !== null &&
				filters.rMultipleRange?.max !== undefined &&
				rMultiple > filters.rMultipleRange.max
			) {
				return false;
			}
			return true;
		});
	}

	// Tags filter - requires join, handled separately in procedures that support it
	// For now, we skip tag filtering in the generic helper

	return filtered;
}

// =============================================================================
// ANALYTICS ROUTER
// Provides advanced analytics and performance metrics
// =============================================================================

export const analyticsRouter = createTRPCRouter({
	/**
	 * Get overview metrics for the analytics dashboard
	 * Returns all core metrics in a single call for efficiency
	 */
	getOverview: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			// Build conditions for the query
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			// Filter by account if specified, otherwise use active accounts
			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			// Fetch all closed trades with P&L
			const closedTradesRaw = await ctx.db
				.select({
					id: trades.id,
					netPnl: trades.netPnl,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Calculate aggregate stats using existing function
			const stats = calculateAggregateStats(closedTrades, beThreshold);

			// Calculate additional advanced metrics
			const pnls = closedTrades.map((t) => parsePnl(t.netPnl));

			// Expectancy: (winRate/100 * avgWin) - (lossRate/100 * avgLoss)
			const winRate = stats.winRate / 100;
			const lossRate = 1 - winRate;
			const expectancy =
				stats.totalTrades > 0
					? winRate * stats.avgWin - lossRate * stats.avgLoss
					: 0;

			// Payoff Ratio: avgWin / avgLoss
			const payoffRatio = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : 0;

			// Sharpe Ratio: (mean return - risk free rate) / std dev
			// Using 0 as risk-free rate for simplicity (common in trading)
			let sharpeRatio = 0;
			if (pnls.length > 1) {
				const mean = stats.avgPnl;
				const variance =
					pnls.reduce((sum, pnl) => sum + (pnl - mean) ** 2, 0) /
					(pnls.length - 1);
				const stdDev = Math.sqrt(variance);
				sharpeRatio = stdDev > 0 ? mean / stdDev : 0;
			}

			// Largest win and loss
			const largestWin = pnls.length > 0 ? Math.max(...pnls) : 0;
			const largestLoss = pnls.length > 0 ? Math.min(...pnls) : 0;

			// Consecutive wins/losses (current streak)
			let currentStreak = 0;
			let currentStreakType: "win" | "loss" | "none" = "none";
			for (let i = pnls.length - 1; i >= 0; i--) {
				const pnl = pnls[i];
				if (pnl === undefined) continue;

				if (pnl > beThreshold) {
					if (currentStreakType === "none" || currentStreakType === "win") {
						currentStreakType = "win";
						currentStreak++;
					} else {
						break;
					}
				} else if (pnl < -beThreshold) {
					if (currentStreakType === "none" || currentStreakType === "loss") {
						currentStreakType = "loss";
						currentStreak++;
					} else {
						break;
					}
				} else {
					// Breakeven breaks the streak
					break;
				}
			}

			return {
				// Basic stats
				totalTrades: stats.totalTrades,
				wins: stats.wins,
				losses: stats.losses,
				breakevens: stats.breakevens,
				winRate: stats.winRate,
				totalPnl: stats.totalPnl,
				avgPnl: stats.avgPnl,
				grossProfit: stats.grossProfit,
				grossLoss: stats.grossLoss,
				profitFactor: stats.profitFactor,
				avgWin: stats.avgWin,
				avgLoss: stats.avgLoss,
				avgRMultiple: stats.avgRMultiple,

				// Advanced metrics
				expectancy,
				payoffRatio,
				sharpeRatio,
				largestWin,
				largestLoss,

				// Streak info
				currentStreak,
				currentStreakType,
			};
		}),

	// =========================================================================
	// TIME-BASED ANALYSIS PROCEDURES
	// =========================================================================

	/**
	 * Get daily P&L data for calendar heatmap
	 * Returns last 365 days of daily aggregated P&L
	 * Groups by date in user's timezone
	 */
	getCalendarData: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			// Get trades from last 365 days
			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				gte(trades.exitTime, oneYearAgo),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Aggregate by date in user's timezone
			const dailyData = new Map<
				string,
				{ pnl: number; trades: number; wins: number; losses: number }
			>();

			for (const trade of closedTrades) {
				// Use timezone-aware date grouping based on entry time
				const dateKey = getDateStringInTimezone(trade.entryTime, userTimezone);

				const existing = dailyData.get(dateKey) || {
					pnl: 0,
					trades: 0,
					wins: 0,
					losses: 0,
				};
				const pnl = parsePnl(trade.netPnl);
				existing.pnl += pnl;
				existing.trades += 1;
				if (pnl > beThreshold) existing.wins += 1;
				else if (pnl < -beThreshold) existing.losses += 1;

				dailyData.set(dateKey, existing);
			}

			return Array.from(dailyData.entries()).map(([date, data]) => ({
				date,
				pnl: data.pnl,
				trades: data.trades,
				wins: data.wins,
				losses: data.losses,
			}));
		}),

	/**
	 * Get performance breakdown by day of week
	 * Uses user's timezone for day calculation
	 */
	getPerformanceByDayOfWeek: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Initialize days (0 = Sunday, 6 = Saturday)
			const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
			const dayData = dayNames.map((name) => ({
				day: name,
				pnl: 0,
				trades: 0,
				wins: 0,
				losses: 0,
			}));

			for (const trade of closedTrades) {
				// Use timezone-aware day calculation based on entry time
				const dayIndex = getDayOfWeekInTimezone(trade.entryTime, userTimezone);
				const pnl = parsePnl(trade.netPnl);
				const dayEntry = dayData[dayIndex];
				if (!dayEntry) continue;

				dayEntry.pnl += pnl;
				dayEntry.trades += 1;
				if (pnl > beThreshold) dayEntry.wins += 1;
				else if (pnl < -beThreshold) dayEntry.losses += 1;
			}

			return dayData.map((d) => ({
				...d,
				winRate:
					d.wins + d.losses > 0 ? (d.wins / (d.wins + d.losses)) * 100 : 0,
				avgPnl: d.trades > 0 ? d.pnl / d.trades : 0,
			}));
		}),

	/**
	 * Get performance breakdown by hour of day
	 * Uses user's timezone for hour calculation
	 */
	getPerformanceByHour: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Initialize 24 hours
			const hourData = Array.from({ length: 24 }, (_, i) => ({
				hour: i,
				pnl: 0,
				trades: 0,
				wins: 0,
				losses: 0,
			}));

			for (const trade of closedTrades) {
				// Use timezone-aware hour calculation
				const hourIndex = getHourInTimezone(trade.entryTime, userTimezone);
				const pnl = parsePnl(trade.netPnl);
				const hourEntry = hourData[hourIndex];
				if (!hourEntry) continue;

				hourEntry.pnl += pnl;
				hourEntry.trades += 1;
				if (pnl > beThreshold) hourEntry.wins += 1;
				else if (pnl < -beThreshold) hourEntry.losses += 1;
			}

			return hourData.map((h) => ({
				...h,
				winRate:
					h.wins + h.losses > 0 ? (h.wins / (h.wins + h.losses)) * 100 : 0,
				avgPnl: h.trades > 0 ? h.pnl / h.trades : 0,
			}));
		}),

	/**
	 * Get performance breakdown by trading session
	 * Uses user-configured sessions from settings (defaults to Asia/London/New York if not configured)
	 * Session hours are stored as UTC in database, converted to user's local timezone for comparison
	 */
	getPerformanceBySession: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Get user's custom sessions from settings
			const userSettingsRow = await ctx.db.query.userSettings.findFirst({
				where: eq(userSettings.userId, ctx.user.id),
				columns: { tradingSessions: true },
			});

			// Default sessions if user hasn't configured any
			const defaultSessions = [
				{ name: "Asia", startHour: 0, endHour: 8, color: "#00d4ff" },
				{ name: "London", startHour: 8, endHour: 16, color: "#d4ff00" },
				{ name: "New York", startHour: 13, endHour: 21, color: "#00ff88" },
			];

			let sessionConfigs = defaultSessions;
			if (userSettingsRow?.tradingSessions) {
				try {
					const parsed = JSON.parse(userSettingsRow.tradingSessions);
					if (Array.isArray(parsed) && parsed.length > 0) {
						sessionConfigs = parsed;
					}
				} catch {
					// Keep defaults on parse error
				}
			}

			// Build sessions data structure
			const sessions: Record<
				string,
				{
					name: string;
					start: number;
					end: number;
					color: string;
					pnl: number;
					trades: number;
					wins: number;
					losses: number;
				}
			> = {};

			for (const config of sessionConfigs) {
				const key = config.name.toLowerCase().replace(/\s+/g, "_");
				sessions[key] = {
					name: config.name,
					// Convert UTC session hours to user's local timezone for comparison
					// Session hours are stored as UTC in database, but we compare against local hour
					start: utcHourToLocalHour(config.startHour, userTimezone),
					end: utcHourToLocalHour(config.endHour, userTimezone),
					color: config.color || "#6366f1",
					pnl: 0,
					trades: 0,
					wins: 0,
					losses: 0,
				};
			}

			// Helper to determine which sessions an hour belongs to (based on user timezone)
			const getSessionsForHour = (hour: number): string[] => {
				const result: string[] = [];
				for (const [key, session] of Object.entries(sessions)) {
					// Handle sessions that wrap around midnight
					if (session.start <= session.end) {
						// Normal session (e.g., 8-16)
						if (hour >= session.start && hour < session.end) {
							result.push(key);
						}
					} else {
						// Wrapping session (e.g., 22-6)
						if (hour >= session.start || hour < session.end) {
							result.push(key);
						}
					}
				}
				return result;
			};

			for (const trade of closedTrades) {
				// Sessions use user's timezone
				const hour = getHourInTimezone(trade.entryTime, userTimezone);
				const pnl = parsePnl(trade.netPnl);
				const tradesSessions = getSessionsForHour(hour);

				// Attribute trade to all applicable sessions (handles overlap)
				for (const sessionKey of tradesSessions) {
					const session = sessions[sessionKey];
					if (session) {
						session.pnl += pnl;
						session.trades += 1;
						if (pnl > beThreshold) session.wins += 1;
						else if (pnl < -beThreshold) session.losses += 1;
					}
				}
			}

			return Object.values(sessions).map((s) => ({
				session: s.name,
				pnl: s.pnl,
				trades: s.trades,
				wins: s.wins,
				losses: s.losses,
				color: s.color,
				winRate:
					s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0,
				avgPnl: s.trades > 0 ? s.pnl / s.trades : 0,
			}));
		}),

	/**
	 * Get performance breakdown by month
	 * Uses user's timezone for month grouping
	 */
	getPerformanceByMonth: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					months: z.number().min(1).max(24).default(12),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const monthsBack = input?.months ?? 12;
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - monthsBack);
			startDate.setDate(1);
			startDate.setHours(0, 0, 0, 0);

			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				gte(trades.exitTime, startDate),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Aggregate by month in user's timezone
			const monthData = new Map<
				string,
				{ pnl: number; trades: number; wins: number; losses: number }
			>();

			for (const trade of closedTrades) {
				// Use timezone-aware month extraction based on entry time
				const monthKey = getMonthStringInTimezone(
					trade.entryTime,
					userTimezone,
				);

				const existing = monthData.get(monthKey) || {
					pnl: 0,
					trades: 0,
					wins: 0,
					losses: 0,
				};
				const pnl = parsePnl(trade.netPnl);
				existing.pnl += pnl;
				existing.trades += 1;
				if (pnl > beThreshold) existing.wins += 1;
				else if (pnl < -beThreshold) existing.losses += 1;

				monthData.set(monthKey, existing);
			}

			// Convert to array and sort by date
			return Array.from(monthData.entries())
				.map(([month, data]) => ({
					month,
					pnl: data.pnl,
					trades: data.trades,
					wins: data.wins,
					losses: data.losses,
					winRate:
						data.wins + data.losses > 0
							? (data.wins / (data.wins + data.losses)) * 100
							: 0,
					avgPnl: data.trades > 0 ? data.pnl / data.trades : 0,
				}))
				.sort((a, b) => a.month.localeCompare(b.month));
		}),

	// =========================================================================
	// RISK ANALYSIS PROCEDURES
	// =========================================================================

	/**
	 * Get complete risk metrics including drawdowns, risk-adjusted returns,
	 * Kelly Criterion, and Risk of Ruin
	 * Uses cumulative P&L (starting at $0) - no fake equity
	 */
	getRiskMetrics: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			// Get account's maxDrawdown and initialBalance for Risk of Ruin calculation
			let ruinThreshold = 0.5; // Default 50% for live/demo accounts
			let ruinThresholdSource = "default" as "account" | "default";
			let accountInitialBalance: number | null = null;

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));

				// Fetch the specific account's maxDrawdown and initialBalance
				const account = await ctx.db
					.select({
						maxDrawdown: accounts.maxDrawdown,
						initialBalance: accounts.initialBalance,
					})
					.from(accounts)
					.where(eq(accounts.id, input.accountId))
					.limit(1);

				if (account[0]?.maxDrawdown) {
					// Convert from percentage (e.g., 6.00) to decimal (0.06)
					ruinThreshold = parseFloat(account[0].maxDrawdown) / 100;
					ruinThresholdSource = "account";
				}

				if (account[0]?.initialBalance) {
					accountInitialBalance = parseFloat(account[0].initialBalance);
				}
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
				// When viewing multiple accounts, use default 50%
				// Future: could aggregate account drawdown limits
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			// Fetch trades sorted by exit time for equity curve
			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Also get aggregate stats for Kelly/RoR calculations
			const stats = calculateAggregateStats(closedTrades, beThreshold);

			// Calculate actual risk per trade from trading data
			// riskPerTrade = avgLoss / initialBalance (as decimal)
			let riskPerTrade = 0.02; // Default 2% if we can't calculate
			let riskPerTradeSource = "default" as
				| "calculated"
				| "default"
				| "no_losses";

			if (
				stats.avgLoss > 0 &&
				accountInitialBalance &&
				accountInitialBalance > 0
			) {
				// Calculate actual risk % based on average loss vs initial balance
				riskPerTrade = stats.avgLoss / accountInitialBalance;
				riskPerTradeSource = "calculated";
			} else if (stats.avgLoss === 0 && stats.totalTrades > 0) {
				// No losing trades - can't calculate risk
				riskPerTradeSource = "no_losses";
				riskPerTrade = 0.01; // Assume 1% for RoR calculation
			}

			const riskMetrics = calculateRiskMetrics(
				closedTrades.map((t) => ({
					netPnl: t.netPnl,
					exitTime: t.exitTime,
				})),
				stats.winRate,
				stats.avgWin,
				stats.avgLoss,
				riskPerTrade,
				ruinThreshold,
			);

			// Add Sortino ratio (need to calculate from returns)
			const pnls = closedTrades.map((t) => parsePnl(t.netPnl));
			let sortinoRatio = 0;
			if (pnls.length > 1) {
				const mean = pnls.reduce((sum, p) => sum + p, 0) / pnls.length;
				const negReturns = pnls.filter((p) => p < 0);
				if (negReturns.length > 0) {
					const downsideVar =
						negReturns.reduce((sum, v) => sum + v ** 2, 0) / negReturns.length;
					const downsideDev = Math.sqrt(downsideVar);
					sortinoRatio = downsideDev > 0 ? mean / downsideDev : 0;
				} else if (mean > 0) {
					sortinoRatio = Infinity;
				}
			}

			return {
				...riskMetrics,
				sortinoRatio,
				// Include win rate and payoff for context
				winRate: stats.winRate,
				avgWin: stats.avgWin,
				avgLoss: stats.avgLoss,
				totalTrades: stats.totalTrades,
				// Ruin threshold info for display
				ruinThreshold, // As decimal (e.g., 0.06 for 6%)
				ruinThresholdPercent: ruinThreshold * 100, // As percentage (e.g., 6)
				ruinThresholdSource, // "account" or "default"
				// Risk per trade info for display
				riskPerTrade, // As decimal (e.g., 0.015 for 1.5%)
				riskPerTradePercent: riskPerTrade * 100, // As percentage (e.g., 1.5)
				riskPerTradeSource, // "calculated", "default", or "no_losses"
			};
		}),

	/**
	 * Get cumulative P&L curve data for charting
	 * Returns running profit/loss at each trade with drawdown from peak
	 */
	getEquityCurve: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					id: trades.id,
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					symbol: trades.symbol,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Build cumulative P&L curve (starts at $0)
			const curve = buildEquityCurve(
				closedTrades.map((t) => ({
					netPnl: t.netPnl,
					exitTime: t.exitTime,
				})),
			);

			// Add trade metadata to each point
			return curve.map((point, i) => {
				const trade = closedTrades[i];
				return {
					...point,
					date: point.date.toISOString(),
					tradeId: trade?.id ?? null,
					symbol: trade?.symbol ?? null,
				};
			});
		}),

	/**
	 * Get top drawdown periods for the drawdown table
	 */
	getDrawdownHistory: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					limit: z.number().min(1).max(20).default(10),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Build cumulative P&L curve (starts at $0)
			const curve = buildEquityCurve(
				closedTrades.map((t) => ({
					netPnl: t.netPnl,
					exitTime: t.exitTime,
				})),
			);

			const periods = findDrawdownPeriods(curve, 1);
			const resultLimit = input?.limit ?? 10;

			// Format dates for JSON serialization
			return periods.slice(0, resultLimit).map((period) => ({
				...period,
				startDate: period.startDate.toISOString(),
				troughDate: period.troughDate.toISOString(),
				recoveryDate: period.recoveryDate?.toISOString() ?? null,
			}));
		}),

	// =========================================================================
	// R-MULTIPLE AND RISK/REWARD ANALYSIS
	// =========================================================================

	/**
	 * Get R-Multiple distribution for histogram chart
	 * Groups trades by R-multiple buckets for visualization
	 */
	getRMultipleDistribution: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.stopLoss), // Must have stop loss to calculate R
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					direction: trades.direction,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Define R-Multiple buckets
			const buckets = [
				{ label: "< -2R", min: -Infinity, max: -2 },
				{ label: "-2R to -1R", min: -2, max: -1 },
				{ label: "-1R to 0", min: -1, max: 0 },
				{ label: "0 to 1R", min: 0, max: 1 },
				{ label: "1R to 2R", min: 1, max: 2 },
				{ label: "2R to 3R", min: 2, max: 3 },
				{ label: "> 3R", min: 3, max: Infinity },
			];

			// Initialize bucket data
			const bucketData = buckets.map((b) => ({
				...b,
				count: 0,
				totalPnl: 0,
				trades: [] as number[], // R-multiples in this bucket
			}));

			// Calculate R-multiple for each trade and bucket it
			let totalWithR = 0;
			const allRMultiples: number[] = [];

			for (const trade of closedTrades) {
				if (!trade.stopLoss || !trade.entryPrice) continue;

				const netPnl = parsePnl(trade.netPnl);

				// Use shared utility for consistent R-multiple calculation
				const rMultiple = calculateActualRMultiple(
					netPnl,
					parseFloat(trade.entryPrice),
					parseFloat(trade.stopLoss),
					parseFloat(trade.quantity),
					trade.symbol,
					trade.instrumentType as "futures" | "forex",
				);

				if (rMultiple === null) continue;

				totalWithR++;
				allRMultiples.push(rMultiple);

				// Find the bucket for this R-multiple
				for (const bucket of bucketData) {
					if (rMultiple >= bucket.min && rMultiple < bucket.max) {
						bucket.count++;
						bucket.totalPnl += netPnl;
						bucket.trades.push(rMultiple);
						break;
					}
				}
			}

			// Calculate statistics
			const avgRMultiple =
				allRMultiples.length > 0
					? allRMultiples.reduce((sum, r) => sum + r, 0) / allRMultiples.length
					: 0;

			const positiveR = allRMultiples.filter((r) => r > 0);
			const negativeR = allRMultiples.filter((r) => r < 0);

			return {
				buckets: bucketData.map((b) => ({
					label: b.label,
					count: b.count,
					totalPnl: b.totalPnl,
					avgR:
						b.trades.length > 0
							? b.trades.reduce((sum, r) => sum + r, 0) / b.trades.length
							: 0,
				})),
				stats: {
					totalTrades: closedTrades.length,
					tradesWithR: totalWithR,
					avgRMultiple,
					avgWinR:
						positiveR.length > 0
							? positiveR.reduce((sum, r) => sum + r, 0) / positiveR.length
							: 0,
					avgLossR:
						negativeR.length > 0
							? negativeR.reduce((sum, r) => sum + r, 0) / negativeR.length
							: 0,
					maxR: allRMultiples.length > 0 ? Math.max(...allRMultiples) : 0,
					minR: allRMultiples.length > 0 ? Math.min(...allRMultiples) : 0,
				},
			};
		}),

	/**
	 * Get Risk/Reward analysis comparing planned vs actual
	 * Requires trades with both stopLoss and takeProfit for planned R:R
	 */
	getRiskRewardAnalysis: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					exitPrice: trades.exitPrice,
					stopLoss: trades.stopLoss,
					takeProfit: trades.takeProfit,
					quantity: trades.quantity,
					direction: trades.direction,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Trades with stop loss (can calculate R-multiple)
			const tradesWithSL = closedTrades.filter((t) => t.stopLoss);
			// Trades with both SL and TP (can calculate planned R:R)
			const tradesWithBoth = closedTrades.filter(
				(t) => t.stopLoss && t.takeProfit,
			);

			// Calculate R-multiples and planned R:R
			const rMultiples: number[] = [];
			const plannedRRs: number[] = [];
			const efficiencies: number[] = [];
			let wins = 0;
			let losses = 0;

			// Performance by planned R:R category
			const rrCategories: Record<
				string,
				{ trades: number; wins: number; totalPnl: number }
			> = {
				"< 1:1": { trades: 0, wins: 0, totalPnl: 0 },
				"1:1 - 2:1": { trades: 0, wins: 0, totalPnl: 0 },
				"2:1 - 3:1": { trades: 0, wins: 0, totalPnl: 0 },
				"> 3:1": { trades: 0, wins: 0, totalPnl: 0 },
			};

			for (const trade of tradesWithSL) {
				if (!trade.stopLoss || !trade.entryPrice) continue;

				const entryPrice = parseFloat(trade.entryPrice);
				const stopLoss = parseFloat(trade.stopLoss);
				const netPnl = parsePnl(trade.netPnl);

				// Use shared utility for consistent R-multiple calculation
				const rMultiple = calculateActualRMultiple(
					netPnl,
					entryPrice,
					stopLoss,
					parseFloat(trade.quantity),
					trade.symbol,
					trade.instrumentType as "futures" | "forex",
				);

				if (rMultiple === null) continue;
				rMultiples.push(rMultiple);

				if (netPnl > beThreshold) wins++;
				else if (netPnl < -beThreshold) losses++;

				// If we have TP, calculate planned R:R and efficiency
				if (trade.takeProfit) {
					const takeProfit = parseFloat(trade.takeProfit);
					const riskPerUnit = Math.abs(entryPrice - stopLoss);
					const rewardPerUnit = Math.abs(takeProfit - entryPrice);
					const plannedRR = riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
					plannedRRs.push(plannedRR);

					// Trade efficiency: how much of planned R was captured
					// If planned R:R is 2:1 and actual is 1.5R, efficiency = 75%
					const efficiency = plannedRR > 0 ? (rMultiple / plannedRR) * 100 : 0;
					efficiencies.push(efficiency);

					// Categorize by planned R:R
					let category: string;
					if (plannedRR < 1) category = "< 1:1";
					else if (plannedRR < 2) category = "1:1 - 2:1";
					else if (plannedRR < 3) category = "2:1 - 3:1";
					else category = "> 3:1";

					const cat = rrCategories[category];
					if (cat) {
						cat.trades++;
						cat.totalPnl += netPnl;
						if (netPnl > beThreshold) cat.wins++;
					}
				}
			}

			// Calculate averages
			const avgRMultiple =
				rMultiples.length > 0
					? rMultiples.reduce((sum, r) => sum + r, 0) / rMultiples.length
					: 0;

			const avgPlannedRR =
				plannedRRs.length > 0
					? plannedRRs.reduce((sum, r) => sum + r, 0) / plannedRRs.length
					: 0;

			const avgEfficiency =
				efficiencies.length > 0
					? efficiencies.reduce((sum, e) => sum + e, 0) / efficiencies.length
					: 0;

			// Win rate for trades with R data
			const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

			return {
				summary: {
					totalTrades: closedTrades.length,
					tradesWithSL: tradesWithSL.length,
					tradesWithBoth: tradesWithBoth.length,
					avgRMultiple,
					avgPlannedRR,
					avgEfficiency,
					winRate,
					wins,
					losses,
				},
				categories: Object.entries(rrCategories).map(([range, data]) => ({
					range,
					trades: data.trades,
					wins: data.wins,
					winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
					totalPnl: data.totalPnl,
					avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
				})),
			};
		}),

	// =========================================================================
	// POSITION SIZING ANALYSIS
	// =========================================================================

	/**
	 * Analyze performance by position size
	 * Groups trades into size buckets based on quantity distribution
	 */
	getPositionSizeAnalysis: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			if (closedTrades.length === 0) {
				return {
					buckets: [],
					stats: {
						totalTrades: 0,
						avgSize: 0,
						minSize: 0,
						maxSize: 0,
					},
				};
			}

			// Get all quantities
			const quantities = closedTrades.map((t) => parseFloat(t.quantity));
			const minQty = Math.min(...quantities);
			const maxQty = Math.max(...quantities);
			const avgQty =
				quantities.reduce((sum, q) => sum + q, 0) / quantities.length;

			// Create size buckets based on percentiles
			const sortedQtys = [...quantities].sort((a, b) => a - b);
			const p25 = sortedQtys[Math.floor(sortedQtys.length * 0.25)] ?? minQty;
			const p50 = sortedQtys[Math.floor(sortedQtys.length * 0.5)] ?? avgQty;
			const p75 = sortedQtys[Math.floor(sortedQtys.length * 0.75)] ?? maxQty;

			// Define buckets by percentile (neutral labels)
			const bucketDefs = [
				{ label: "0-25%", min: minQty, max: p25 },
				{ label: "25-50%", min: p25, max: p50 },
				{ label: "50-75%", min: p50, max: p75 },
				{ label: "75-100%", min: p75, max: maxQty + 0.001 },
			];

			// Initialize buckets
			const buckets = bucketDefs.map((def) => ({
				...def,
				trades: 0,
				wins: 0,
				losses: 0,
				totalPnl: 0,
				avgPnl: 0,
				winRate: 0,
			}));

			// Categorize trades
			for (const trade of closedTrades) {
				const qty = parseFloat(trade.quantity);
				const pnl = parsePnl(trade.netPnl);

				for (const bucket of buckets) {
					if (qty >= bucket.min && qty < bucket.max) {
						bucket.trades++;
						bucket.totalPnl += pnl;
						if (pnl > beThreshold) bucket.wins++;
						else if (pnl < -beThreshold) bucket.losses++;
						break;
					}
				}
			}

			// Calculate averages and win rates
			for (const bucket of buckets) {
				bucket.avgPnl = bucket.trades > 0 ? bucket.totalPnl / bucket.trades : 0;
				bucket.winRate =
					bucket.wins + bucket.losses > 0
						? (bucket.wins / (bucket.wins + bucket.losses)) * 100
						: 0;
			}

			return {
				buckets: buckets.map((b) => ({
					label: b.label,
					range: `${b.min.toFixed(2)} - ${b.max.toFixed(2)}`,
					trades: b.trades,
					wins: b.wins,
					losses: b.losses,
					totalPnl: b.totalPnl,
					avgPnl: b.avgPnl,
					winRate: b.winRate,
				})),
				stats: {
					totalTrades: closedTrades.length,
					avgSize: avgQty,
					minSize: minQty,
					maxSize: maxQty,
				},
			};
		}),

	// =========================================================================
	// MONTE CARLO SIMULATION
	// =========================================================================

	/**
	 * Run Monte Carlo simulation on trade history
	 * Randomizes trade order to show range of possible outcomes
	 */
	// =========================================================================
	// SYMBOL ANALYSIS PROCEDURES
	// =========================================================================

	/**
	 * Get performance breakdown by symbol
	 * Returns P&L, trade count, win rate, profit factor, and avg trade per symbol
	 */
	getPerformanceBySymbol: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					symbol: trades.symbol,
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Aggregate by symbol
			const symbolData = new Map<
				string,
				{
					pnl: number;
					trades: number;
					wins: number;
					losses: number;
					grossProfit: number;
					grossLoss: number;
					pnls: number[];
				}
			>();

			for (const trade of closedTrades) {
				const symbol = trade.symbol;
				const pnl = parsePnl(trade.netPnl);

				const existing = symbolData.get(symbol) || {
					pnl: 0,
					trades: 0,
					wins: 0,
					losses: 0,
					grossProfit: 0,
					grossLoss: 0,
					pnls: [],
				};

				existing.pnl += pnl;
				existing.trades += 1;
				existing.pnls.push(pnl);

				if (pnl > beThreshold) {
					existing.wins += 1;
					existing.grossProfit += pnl;
				} else if (pnl < -beThreshold) {
					existing.losses += 1;
					existing.grossLoss += Math.abs(pnl);
				}

				symbolData.set(symbol, existing);
			}

			// Convert to array with calculated metrics
			return Array.from(symbolData.entries())
				.map(([symbol, data]) => ({
					symbol,
					pnl: data.pnl,
					trades: data.trades,
					wins: data.wins,
					losses: data.losses,
					winRate:
						data.wins + data.losses > 0
							? (data.wins / (data.wins + data.losses)) * 100
							: 0,
					profitFactor:
						data.grossLoss > 0
							? data.grossProfit / data.grossLoss
							: data.grossProfit > 0
								? Infinity
								: 0,
					avgTrade: data.trades > 0 ? data.pnl / data.trades : 0,
					avgWin: data.wins > 0 ? data.grossProfit / data.wins : 0,
					avgLoss: data.losses > 0 ? data.grossLoss / data.losses : 0,
				}))
				.sort((a, b) => b.pnl - a.pnl); // Sort by P&L descending
		}),

	/**
	 * Get symbol performance trends over time (monthly breakdown)
	 * Returns monthly P&L per symbol for trend analysis
	 */
	getSymbolTrend: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					months: z.number().min(1).max(24).default(12),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const monthsBack = input?.months ?? 12;
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - monthsBack);
			startDate.setDate(1);
			startDate.setHours(0, 0, 0, 0);

			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				gte(trades.exitTime, startDate),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					symbol: trades.symbol,
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Aggregate by symbol and month
			const trendData = new Map<string, Map<string, number>>();
			const allMonths = new Set<string>();
			const allSymbols = new Set<string>();

			for (const trade of closedTrades) {
				const symbol = trade.symbol;
				// Use timezone-aware month extraction based on entry time
				const monthKey = getMonthStringInTimezone(
					trade.entryTime,
					userTimezone,
				);
				const pnl = parsePnl(trade.netPnl);

				allSymbols.add(symbol);
				allMonths.add(monthKey);

				if (!trendData.has(symbol)) {
					trendData.set(symbol, new Map());
				}

				const symbolMonthData = trendData.get(symbol);
				if (symbolMonthData) {
					const existing = symbolMonthData.get(monthKey) ?? 0;
					symbolMonthData.set(monthKey, existing + pnl);
				}
			}

			// Convert to structured output
			// Sort months chronologically
			const sortedMonths = Array.from(allMonths).sort();

			// Create series data for each symbol
			const symbols = Array.from(allSymbols).map((symbol) => {
				const symbolData = trendData.get(symbol);
				const monthlyPnl = sortedMonths.map((month) => ({
					month,
					pnl: symbolData?.get(month) ?? 0,
				}));

				// Calculate cumulative P&L
				let cumulative = 0;
				const cumulativePnl = monthlyPnl.map((m) => {
					cumulative += m.pnl;
					return {
						month: m.month,
						pnl: m.pnl,
						cumulative,
					};
				});

				return {
					symbol,
					data: cumulativePnl,
					totalPnl: cumulative,
				};
			});

			// Sort symbols by total P&L
			symbols.sort((a, b) => b.totalPnl - a.totalPnl);

			return {
				months: sortedMonths,
				symbols,
			};
		}),

	// =========================================================================
	// MONTE CARLO SIMULATION
	// =========================================================================

	// =========================================================================
	// BEHAVIORAL ANALYSIS PROCEDURES
	// =========================================================================

	/**
	 * Get streak analysis - win/loss streak patterns
	 * Analyzes consecutive wins/losses and performance during streaks
	 */
	getStreakAnalysis: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			if (closedTrades.length === 0) {
				return {
					currentStreak: { type: "none" as const, count: 0 },
					maxWinStreak: 0,
					maxLossStreak: 0,
					streakDistribution: {
						wins: [] as {
							streakLength: number;
							count: number;
							totalPnl: number;
						}[],
						losses: [] as {
							streakLength: number;
							count: number;
							totalPnl: number;
						}[],
					},
					performanceDuringStreaks: {
						duringWinStreak: { trades: 0, pnl: 0, avgPnl: 0 },
						duringLossStreak: { trades: 0, pnl: 0, avgPnl: 0 },
						noStreak: { trades: 0, pnl: 0, avgPnl: 0 },
					},
				};
			}

			// Classify trades as win/loss/breakeven
			const classified = closedTrades.map((t) => {
				const pnl = parsePnl(t.netPnl);
				let type: "win" | "loss" | "breakeven";
				if (pnl > beThreshold) type = "win";
				else if (pnl < -beThreshold) type = "loss";
				else type = "breakeven";
				return { pnl, type };
			});

			// Find all streaks
			const allStreaks: {
				type: "win" | "loss";
				length: number;
				totalPnl: number;
			}[] = [];
			let currentStreakType: "win" | "loss" | null = null;
			let currentStreakLength = 0;
			let currentStreakPnl = 0;

			for (const trade of classified) {
				if (trade.type === "breakeven") {
					// Breakeven breaks the streak
					if (currentStreakType && currentStreakLength > 0) {
						allStreaks.push({
							type: currentStreakType,
							length: currentStreakLength,
							totalPnl: currentStreakPnl,
						});
					}
					currentStreakType = null;
					currentStreakLength = 0;
					currentStreakPnl = 0;
				} else if (trade.type === currentStreakType) {
					// Continue streak
					currentStreakLength++;
					currentStreakPnl += trade.pnl;
				} else {
					// New streak type
					if (currentStreakType && currentStreakLength > 0) {
						allStreaks.push({
							type: currentStreakType,
							length: currentStreakLength,
							totalPnl: currentStreakPnl,
						});
					}
					currentStreakType = trade.type;
					currentStreakLength = 1;
					currentStreakPnl = trade.pnl;
				}
			}

			// Don't forget the last streak
			if (currentStreakType && currentStreakLength > 0) {
				allStreaks.push({
					type: currentStreakType,
					length: currentStreakLength,
					totalPnl: currentStreakPnl,
				});
			}

			// Calculate max streaks
			const maxWinStreak = Math.max(
				0,
				...allStreaks.filter((s) => s.type === "win").map((s) => s.length),
			);
			const maxLossStreak = Math.max(
				0,
				...allStreaks.filter((s) => s.type === "loss").map((s) => s.length),
			);

			// Current streak (from the end)
			const lastStreak = allStreaks[allStreaks.length - 1];
			const currentStreak = lastStreak
				? { type: lastStreak.type, count: lastStreak.length }
				: { type: "none" as const, count: 0 };

			// Streak distribution - group by streak length
			const winStreakCounts = new Map<
				number,
				{ count: number; totalPnl: number }
			>();
			const lossStreakCounts = new Map<
				number,
				{ count: number; totalPnl: number }
			>();

			for (const streak of allStreaks) {
				const map = streak.type === "win" ? winStreakCounts : lossStreakCounts;
				const existing = map.get(streak.length) || { count: 0, totalPnl: 0 };
				map.set(streak.length, {
					count: existing.count + 1,
					totalPnl: existing.totalPnl + streak.totalPnl,
				});
			}

			const winDistribution = Array.from(winStreakCounts.entries())
				.map(([streakLength, data]) => ({ streakLength, ...data }))
				.sort((a, b) => a.streakLength - b.streakLength);

			const lossDistribution = Array.from(lossStreakCounts.entries())
				.map(([streakLength, data]) => ({ streakLength, ...data }))
				.sort((a, b) => a.streakLength - b.streakLength);

			// Performance during streaks vs no streak
			// A trade is "during a streak" if it's part of a streak of 2+
			const duringWinStreak = { trades: 0, pnl: 0 };
			const duringLossStreak = { trades: 0, pnl: 0 };
			const noStreak = { trades: 0, pnl: 0 };

			for (const streak of allStreaks) {
				if (streak.length >= 2) {
					if (streak.type === "win") {
						duringWinStreak.trades += streak.length;
						duringWinStreak.pnl += streak.totalPnl;
					} else {
						duringLossStreak.trades += streak.length;
						duringLossStreak.pnl += streak.totalPnl;
					}
				} else {
					noStreak.trades += streak.length;
					noStreak.pnl += streak.totalPnl;
				}
			}

			return {
				currentStreak,
				maxWinStreak,
				maxLossStreak,
				streakDistribution: {
					wins: winDistribution,
					losses: lossDistribution,
				},
				performanceDuringStreaks: {
					duringWinStreak: {
						...duringWinStreak,
						avgPnl:
							duringWinStreak.trades > 0
								? duringWinStreak.pnl / duringWinStreak.trades
								: 0,
					},
					duringLossStreak: {
						...duringLossStreak,
						avgPnl:
							duringLossStreak.trades > 0
								? duringLossStreak.pnl / duringLossStreak.trades
								: 0,
					},
					noStreak: {
						...noStreak,
						avgPnl: noStreak.trades > 0 ? noStreak.pnl / noStreak.trades : 0,
					},
				},
			};
		}),

	/**
	 * Get revenge trading analysis
	 * Analyzes performance after wins vs after losses
	 */
	getRevengeTrading: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			if (closedTrades.length < 2) {
				return {
					afterWin: {
						trades: 0,
						wins: 0,
						losses: 0,
						winRate: 0,
						pnl: 0,
						avgPnl: 0,
					},
					afterLoss: {
						trades: 0,
						wins: 0,
						losses: 0,
						winRate: 0,
						pnl: 0,
						avgPnl: 0,
					},
					afterConsecutiveLosses: {
						after1Loss: { trades: 0, wins: 0, winRate: 0, avgPnl: 0 },
						after2Losses: { trades: 0, wins: 0, winRate: 0, avgPnl: 0 },
						after3PlusLosses: { trades: 0, wins: 0, winRate: 0, avgPnl: 0 },
					},
					revengeIndicator: 0, // 0-100, higher = more revenge trading tendency
				};
			}

			// Classify trades
			const classified = closedTrades.map((t) => {
				const pnl = parsePnl(t.netPnl);
				let type: "win" | "loss" | "breakeven";
				if (pnl > beThreshold) type = "win";
				else if (pnl < -beThreshold) type = "loss";
				else type = "breakeven";
				return { pnl, type };
			});

			// Analyze performance after wins vs losses
			const afterWin = { trades: 0, wins: 0, losses: 0, pnl: 0 };
			const afterLoss = { trades: 0, wins: 0, losses: 0, pnl: 0 };
			const after1Loss = { trades: 0, wins: 0, pnl: 0 };
			const after2Losses = { trades: 0, wins: 0, pnl: 0 };
			const after3PlusLosses = { trades: 0, wins: 0, pnl: 0 };

			let consecutiveLosses = 0;

			for (let i = 1; i < classified.length; i++) {
				const prevTrade = classified[i - 1];
				const currentTrade = classified[i];
				if (!prevTrade || !currentTrade) continue;

				if (prevTrade.type === "win") {
					afterWin.trades++;
					afterWin.pnl += currentTrade.pnl;
					if (currentTrade.type === "win") afterWin.wins++;
					else if (currentTrade.type === "loss") afterWin.losses++;
					consecutiveLosses = 0;
				} else if (prevTrade.type === "loss") {
					afterLoss.trades++;
					afterLoss.pnl += currentTrade.pnl;
					if (currentTrade.type === "win") afterLoss.wins++;
					else if (currentTrade.type === "loss") afterLoss.losses++;

					// Track consecutive losses
					consecutiveLosses++;
					if (consecutiveLosses === 1) {
						after1Loss.trades++;
						after1Loss.pnl += currentTrade.pnl;
						if (currentTrade.type === "win") after1Loss.wins++;
					} else if (consecutiveLosses === 2) {
						after2Losses.trades++;
						after2Losses.pnl += currentTrade.pnl;
						if (currentTrade.type === "win") after2Losses.wins++;
					} else {
						after3PlusLosses.trades++;
						after3PlusLosses.pnl += currentTrade.pnl;
						if (currentTrade.type === "win") after3PlusLosses.wins++;
					}
				} else {
					// Breakeven - reset consecutive losses
					consecutiveLosses = 0;
				}

				// Update consecutive losses for current trade
				if (currentTrade.type === "loss") {
					if (prevTrade.type === "loss") {
						// Already incremented above
					} else {
						consecutiveLosses = 1;
					}
				} else if (currentTrade.type !== "breakeven") {
					consecutiveLosses = 0;
				}
			}

			// Calculate revenge indicator (0-100)
			// Based on: win rate after losses vs after wins
			// If win rate drops significantly after losses, indicates revenge trading
			const winRateAfterWin =
				afterWin.wins + afterWin.losses > 0
					? (afterWin.wins / (afterWin.wins + afterWin.losses)) * 100
					: 0;
			const winRateAfterLoss =
				afterLoss.wins + afterLoss.losses > 0
					? (afterLoss.wins / (afterLoss.wins + afterLoss.losses)) * 100
					: 0;

			// Revenge indicator: how much worse performance is after losses
			// 0 = no difference or better after losses
			// 100 = complete collapse after losses
			const winRateDrop = Math.max(0, winRateAfterWin - winRateAfterLoss);
			const revengeIndicator = Math.min(100, winRateDrop * 2); // Scale 0-50% drop to 0-100

			return {
				afterWin: {
					...afterWin,
					winRate:
						afterWin.wins + afterWin.losses > 0
							? (afterWin.wins / (afterWin.wins + afterWin.losses)) * 100
							: 0,
					avgPnl: afterWin.trades > 0 ? afterWin.pnl / afterWin.trades : 0,
				},
				afterLoss: {
					...afterLoss,
					winRate:
						afterLoss.wins + afterLoss.losses > 0
							? (afterLoss.wins / (afterLoss.wins + afterLoss.losses)) * 100
							: 0,
					avgPnl: afterLoss.trades > 0 ? afterLoss.pnl / afterLoss.trades : 0,
				},
				afterConsecutiveLosses: {
					after1Loss: {
						...after1Loss,
						winRate:
							after1Loss.trades > 0
								? (after1Loss.wins / after1Loss.trades) * 100
								: 0,
						avgPnl:
							after1Loss.trades > 0 ? after1Loss.pnl / after1Loss.trades : 0,
					},
					after2Losses: {
						...after2Losses,
						winRate:
							after2Losses.trades > 0
								? (after2Losses.wins / after2Losses.trades) * 100
								: 0,
						avgPnl:
							after2Losses.trades > 0
								? after2Losses.pnl / after2Losses.trades
								: 0,
					},
					after3PlusLosses: {
						...after3PlusLosses,
						winRate:
							after3PlusLosses.trades > 0
								? (after3PlusLosses.wins / after3PlusLosses.trades) * 100
								: 0,
						avgPnl:
							after3PlusLosses.trades > 0
								? after3PlusLosses.pnl / after3PlusLosses.trades
								: 0,
					},
				},
				revengeIndicator,
			};
		}),

	/**
	 * Get overtrading analysis
	 * Analyzes performance by number of trades per day
	 */
	getOvertradingAnalysis: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			if (closedTrades.length === 0) {
				return {
					byTradeCount: [],
					optimalRange: { min: 1, max: 3 },
					overtradingThreshold: 5,
					correlationScore: 0, // -1 to 1, negative = more trades = worse
				};
			}

			// Group trades by day (using entry time for consistent daily grouping)
			const dailyTrades = new Map<
				string,
				{ pnl: number; wins: number; losses: number }[]
			>();

			for (const trade of closedTrades) {
				if (!trade.entryTime) continue;
				const dateKey = getDateStringInTimezone(trade.entryTime, userTimezone);
				const pnl = parsePnl(trade.netPnl);
				const isWin = pnl > beThreshold;
				const isLoss = pnl < -beThreshold;

				if (!dailyTrades.has(dateKey)) {
					dailyTrades.set(dateKey, []);
				}
				dailyTrades.get(dateKey)?.push({
					pnl,
					wins: isWin ? 1 : 0,
					losses: isLoss ? 1 : 0,
				});
			}

			// Aggregate by trade count per day
			const byTradeCountMap = new Map<
				number,
				{
					days: number;
					totalPnl: number;
					wins: number;
					losses: number;
				}
			>();

			for (const [, dayTrades] of dailyTrades) {
				const tradeCount = dayTrades.length;
				const dayPnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
				const dayWins = dayTrades.reduce((sum, t) => sum + t.wins, 0);
				const dayLosses = dayTrades.reduce((sum, t) => sum + t.losses, 0);

				const existing = byTradeCountMap.get(tradeCount) || {
					days: 0,
					totalPnl: 0,
					wins: 0,
					losses: 0,
				};
				byTradeCountMap.set(tradeCount, {
					days: existing.days + 1,
					totalPnl: existing.totalPnl + dayPnl,
					wins: existing.wins + dayWins,
					losses: existing.losses + dayLosses,
				});
			}

			// Convert to array and calculate stats
			const byTradeCount = Array.from(byTradeCountMap.entries())
				.map(([tradeCount, data]) => ({
					tradeCount,
					days: data.days,
					totalPnl: data.totalPnl,
					avgDailyPnl: data.totalPnl / data.days,
					wins: data.wins,
					losses: data.losses,
					winRate:
						data.wins + data.losses > 0
							? (data.wins / (data.wins + data.losses)) * 100
							: 0,
				}))
				.sort((a, b) => a.tradeCount - b.tradeCount);

			// Find optimal range (trade count with best avg P&L)
			let bestAvgPnl = -Infinity;
			let optimalTradeCount = 1;
			for (const bucket of byTradeCount) {
				if (bucket.avgDailyPnl > bestAvgPnl && bucket.days >= 3) {
					bestAvgPnl = bucket.avgDailyPnl;
					optimalTradeCount = bucket.tradeCount;
				}
			}

			// Calculate correlation between trade count and daily P&L
			// Negative correlation = more trades = worse performance (overtrading)
			const dailyData: { tradeCount: number; pnl: number }[] = [];
			for (const [, dayTrades] of dailyTrades) {
				dailyData.push({
					tradeCount: dayTrades.length,
					pnl: dayTrades.reduce((sum, t) => sum + t.pnl, 0),
				});
			}

			let correlationScore = 0;
			if (dailyData.length >= 5) {
				const n = dailyData.length;
				const sumX = dailyData.reduce((s, d) => s + d.tradeCount, 0);
				const sumY = dailyData.reduce((s, d) => s + d.pnl, 0);
				const sumXY = dailyData.reduce((s, d) => s + d.tradeCount * d.pnl, 0);
				const sumX2 = dailyData.reduce(
					(s, d) => s + d.tradeCount * d.tradeCount,
					0,
				);
				const sumY2 = dailyData.reduce((s, d) => s + d.pnl * d.pnl, 0);

				const numerator = n * sumXY - sumX * sumY;
				const denominator = Math.sqrt(
					(n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
				);
				correlationScore = denominator !== 0 ? numerator / denominator : 0;
			}

			// Determine overtrading threshold (where performance drops significantly)
			const sortedByAvg = [...byTradeCount].sort(
				(a, b) => b.avgDailyPnl - a.avgDailyPnl,
			);
			const avgPnlThreshold = sortedByAvg[0]?.avgDailyPnl ?? 0;
			let overtradingThreshold = 5;
			for (const bucket of byTradeCount) {
				if (
					bucket.avgDailyPnl < avgPnlThreshold * 0.5 &&
					bucket.tradeCount > optimalTradeCount
				) {
					overtradingThreshold = bucket.tradeCount;
					break;
				}
			}

			return {
				byTradeCount,
				optimalRange: {
					min: Math.max(1, optimalTradeCount - 1),
					max: optimalTradeCount + 1,
				},
				overtradingThreshold,
				correlationScore, // Negative = overtrading tendency
			};
		}),

	/**
	 * Get holding time analysis
	 * Analyzes performance by trade duration
	 */
	getHoldingTimeAnalysis: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Duration buckets in minutes
			const buckets = [
				{ label: "0-5min", minMinutes: 0, maxMinutes: 5 },
				{ label: "5-15min", minMinutes: 5, maxMinutes: 15 },
				{ label: "15-30min", minMinutes: 15, maxMinutes: 30 },
				{ label: "30min-1h", minMinutes: 30, maxMinutes: 60 },
				{ label: "1h-2h", minMinutes: 60, maxMinutes: 120 },
				{ label: "2h+", minMinutes: 120, maxMinutes: Infinity },
			];

			const bucketData = buckets.map((b) => ({
				...b,
				trades: 0,
				wins: 0,
				losses: 0,
				totalPnl: 0,
			}));

			for (const trade of closedTrades) {
				if (!trade.exitTime) continue;

				const durationMs = trade.exitTime.getTime() - trade.entryTime.getTime();
				const durationMinutes = durationMs / (1000 * 60);
				const pnl = parsePnl(trade.netPnl);
				const isWin = pnl > beThreshold;
				const isLoss = pnl < -beThreshold;

				for (const bucket of bucketData) {
					if (
						durationMinutes >= bucket.minMinutes &&
						durationMinutes < bucket.maxMinutes
					) {
						bucket.trades++;
						bucket.totalPnl += pnl;
						if (isWin) bucket.wins++;
						else if (isLoss) bucket.losses++;
						break;
					}
				}
			}

			// Calculate stats per bucket
			const resultBuckets = bucketData.map((b) => ({
				label: b.label,
				minMinutes: b.minMinutes,
				maxMinutes: b.maxMinutes,
				trades: b.trades,
				wins: b.wins,
				losses: b.losses,
				totalPnl: b.totalPnl,
				avgPnl: b.trades > 0 ? b.totalPnl / b.trades : 0,
				winRate:
					b.wins + b.losses > 0 ? (b.wins / (b.wins + b.losses)) * 100 : 0,
			}));

			// Find optimal holding time (best avg P&L with meaningful sample)
			let bestBucket = resultBuckets[0];
			let bestAvgPnl = -Infinity;
			for (const bucket of resultBuckets) {
				if (bucket.trades >= 5 && bucket.avgPnl > bestAvgPnl) {
					bestAvgPnl = bucket.avgPnl;
					bestBucket = bucket;
				}
			}

			return {
				buckets: resultBuckets,
				optimalDuration: bestBucket
					? { label: bestBucket.label, avgPnl: bestBucket.avgPnl }
					: null,
				totalTrades: closedTrades.length,
			};
		}),

	/**
	 * Get behavioral patterns summary
	 * Aggregates various behavioral metrics into scores
	 */
	getBehavioralPatterns: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
				isNotNull(trades.exitTime),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					emotionalState: trades.emotionalState,
					strategyId: trades.strategyId,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			if (closedTrades.length === 0) {
				return {
					tiltScore: 0,
					disciplineScore: 100,
					overtradingTendency: 0,
					emotionalStateBreakdown: [],
					totalTrades: 0,
				};
			}

			// Calculate Tilt Score (0-100, based on losses after losses)
			let lossesAfterLoss = 0;
			let tradesAfterLoss = 0;
			const classified = closedTrades.map((t) => {
				const pnl = parsePnl(t.netPnl);
				return {
					pnl,
					isLoss: pnl < -beThreshold,
					emotionalState: t.emotionalState,
					hasStrategy: !!t.strategyId,
				};
			});

			for (let i = 1; i < classified.length; i++) {
				const prev = classified[i - 1];
				const curr = classified[i];
				if (prev?.isLoss) {
					tradesAfterLoss++;
					if (curr?.isLoss) lossesAfterLoss++;
				}
			}

			// Tilt score: how often losses lead to more losses
			// Higher = more tilted
			const tiltScore =
				tradesAfterLoss > 0
					? Math.round((lossesAfterLoss / tradesAfterLoss) * 100)
					: 0;

			// Discipline Score (0-100, based on strategy assignment)
			const tradesWithStrategy = classified.filter((t) => t.hasStrategy).length;
			const disciplineScore =
				closedTrades.length > 0
					? Math.round((tradesWithStrategy / closedTrades.length) * 100)
					: 100;

			// Overtrading Tendency (based on daily trade count variance)
			const dailyTrades = new Map<string, number>();
			for (const trade of closedTrades) {
				if (!trade.entryTime) continue;
				const dateKey = getDateStringInTimezone(trade.entryTime, userTimezone);
				dailyTrades.set(dateKey, (dailyTrades.get(dateKey) || 0) + 1);
			}

			const tradeCounts = Array.from(dailyTrades.values());
			const avgDailyTrades =
				tradeCounts.length > 0
					? tradeCounts.reduce((s, c) => s + c, 0) / tradeCounts.length
					: 0;

			// Days with >2x average = overtrading days
			const overtradingDays = tradeCounts.filter(
				(c) => c > avgDailyTrades * 2,
			).length;
			const overtradingTendency =
				tradeCounts.length > 0
					? Math.round((overtradingDays / tradeCounts.length) * 100)
					: 0;

			// Emotional State Breakdown
			const emotionalCounts = new Map<
				string,
				{ count: number; pnl: number; wins: number; losses: number }
			>();
			for (const trade of classified) {
				const state = trade.emotionalState || "untracked";
				const existing = emotionalCounts.get(state) || {
					count: 0,
					pnl: 0,
					wins: 0,
					losses: 0,
				};
				emotionalCounts.set(state, {
					count: existing.count + 1,
					pnl: existing.pnl + trade.pnl,
					wins: existing.wins + (trade.pnl > beThreshold ? 1 : 0),
					losses: existing.losses + (trade.isLoss ? 1 : 0),
				});
			}

			const emotionalStateBreakdown = Array.from(emotionalCounts.entries())
				.map(([state, data]) => ({
					state,
					trades: data.count,
					pnl: data.pnl,
					avgPnl: data.count > 0 ? data.pnl / data.count : 0,
					winRate:
						data.wins + data.losses > 0
							? (data.wins / (data.wins + data.losses)) * 100
							: 0,
				}))
				.sort((a, b) => b.trades - a.trades);

			return {
				tiltScore,
				disciplineScore,
				overtradingTendency,
				emotionalStateBreakdown,
				totalTrades: closedTrades.length,
			};
		}),

	getMonteCarloSimulation: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					iterations: z.number().min(100).max(10000).default(1000),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			const closedTradesRaw = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			const iterations = input?.iterations ?? 1000;

			if (closedTrades.length < 10) {
				return {
					hasEnoughData: false,
					iterations: 0,
					percentiles: {
						p5: 0,
						p25: 0,
						p50: 0,
						p75: 0,
						p95: 0,
					},
					probabilityOfProfit: 0,
					expectedValue: 0,
					standardDeviation: 0,
					actualOutcome: 0,
					worstDrawdown: 0,
					bestPeak: 0,
				};
			}

			// Extract P&L values
			const pnls = closedTrades.map((t) => parsePnl(t.netPnl));

			// Fisher-Yates shuffle function
			const shuffle = (array: number[]): number[] => {
				const result = [...array];
				for (let i = result.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					const temp = result[i];
					const swapVal = result[j];
					if (temp !== undefined && swapVal !== undefined) {
						result[i] = swapVal;
						result[j] = temp;
					}
				}
				return result;
			};

			// Run simulations
			const outcomes: number[] = [];
			const maxDrawdowns: number[] = [];
			const peaks: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const shuffled = shuffle(pnls);

				// Calculate equity curve for this simulation
				let equity = 0;
				let peak = 0;
				let maxDD = 0;

				for (const pnl of shuffled) {
					equity += pnl;
					peak = Math.max(peak, equity);
					const dd = peak - equity;
					maxDD = Math.max(maxDD, dd);
				}

				outcomes.push(equity);
				maxDrawdowns.push(maxDD);
				peaks.push(peak);
			}

			// Sort outcomes for percentile calculation
			outcomes.sort((a, b) => a - b);

			// Calculate percentiles
			const getPercentile = (arr: number[], p: number) => {
				const idx = Math.floor(arr.length * (p / 100));
				return arr[Math.min(idx, arr.length - 1)] ?? 0;
			};

			const percentiles = {
				p5: getPercentile(outcomes, 5),
				p25: getPercentile(outcomes, 25),
				p50: getPercentile(outcomes, 50),
				p75: getPercentile(outcomes, 75),
				p95: getPercentile(outcomes, 95),
			};

			// Probability of profit
			const profitableOutcomes = outcomes.filter((o) => o > 0).length;
			const probabilityOfProfit = (profitableOutcomes / iterations) * 100;

			// Expected value and standard deviation
			const expectedValue =
				outcomes.reduce((sum, o) => sum + o, 0) / iterations;
			const variance =
				outcomes.reduce((sum, o) => sum + (o - expectedValue) ** 2, 0) /
				iterations;
			const standardDeviation = Math.sqrt(variance);

			// Actual outcome (original order)
			const actualOutcome = pnls.reduce((sum, p) => sum + p, 0);

			// Worst drawdown and best peak across simulations
			const worstDrawdown = Math.max(...maxDrawdowns);
			const bestPeak = Math.max(...peaks);

			return {
				hasEnoughData: true,
				iterations,
				percentiles,
				probabilityOfProfit,
				expectedValue,
				standardDeviation,
				actualOutcome,
				worstDrawdown,
				bestPeak,
			};
		}),

	// =========================================================================
	// FILTER PRESET PROCEDURES
	// =========================================================================

	/**
	 * Get all filter presets for the current user
	 * Ordered by creation date, with default preset first
	 */
	getFilterPresets: protectedProcedure.query(async ({ ctx }) => {
		const presets = await ctx.db
			.select()
			.from(filterPresets)
			.where(eq(filterPresets.userId, ctx.user.id))
			.orderBy(desc(filterPresets.isDefault), desc(filterPresets.createdAt));

		return presets;
	}),

	/**
	 * Get the user's default preset if one exists
	 */
	getDefaultPreset: protectedProcedure.query(async ({ ctx }) => {
		const preset = await ctx.db
			.select()
			.from(filterPresets)
			.where(
				and(
					eq(filterPresets.userId, ctx.user.id),
					eq(filterPresets.isDefault, true),
				),
			)
			.limit(1);

		return preset[0] ?? null;
	}),

	/**
	 * Create a new filter preset
	 */
	createFilterPreset: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				description: z.string().max(500).optional(),
				filters: z.string(), // JSON string of AnalyticsFilters
				isDefault: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// If this preset should be the default, unset any existing default first
			if (input.isDefault) {
				await ctx.db
					.update(filterPresets)
					.set({ isDefault: false })
					.where(
						and(
							eq(filterPresets.userId, ctx.user.id),
							eq(filterPresets.isDefault, true),
						),
					);
			}

			const [preset] = await ctx.db
				.insert(filterPresets)
				.values({
					userId: ctx.user.id,
					name: input.name,
					description: input.description ?? null,
					filters: input.filters,
					isDefault: input.isDefault,
				})
				.returning();

			return preset;
		}),

	/**
	 * Update an existing filter preset
	 */
	updateFilterPreset: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(100).optional(),
				description: z.string().max(500).nullable().optional(),
				filters: z.string().optional(), // JSON string of AnalyticsFilters
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const existing = await ctx.db
				.select({ id: filterPresets.id })
				.from(filterPresets)
				.where(
					and(
						eq(filterPresets.id, input.id),
						eq(filterPresets.userId, ctx.user.id),
					),
				)
				.limit(1);

			if (!existing[0]) {
				throw new Error("Preset not found or access denied");
			}

			const updateData: Record<string, unknown> = {};
			if (input.name !== undefined) updateData.name = input.name;
			if (input.description !== undefined)
				updateData.description = input.description;
			if (input.filters !== undefined) updateData.filters = input.filters;

			if (Object.keys(updateData).length === 0) {
				// Nothing to update
				const [preset] = await ctx.db
					.select()
					.from(filterPresets)
					.where(eq(filterPresets.id, input.id));
				return preset;
			}

			const [preset] = await ctx.db
				.update(filterPresets)
				.set(updateData)
				.where(eq(filterPresets.id, input.id))
				.returning();

			return preset;
		}),

	/**
	 * Delete a filter preset
	 */
	deleteFilterPreset: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership and delete
			const [deleted] = await ctx.db
				.delete(filterPresets)
				.where(
					and(
						eq(filterPresets.id, input.id),
						eq(filterPresets.userId, ctx.user.id),
					),
				)
				.returning();

			if (!deleted) {
				throw new Error("Preset not found or access denied");
			}

			return { success: true };
		}),

	/**
	 * Set a preset as the default (auto-loads on page visit)
	 * Pass null id to clear the default
	 */
	setDefaultPreset: protectedProcedure
		.input(z.object({ id: z.string().nullable() }))
		.mutation(async ({ ctx, input }) => {
			// First, unset any existing default
			await ctx.db
				.update(filterPresets)
				.set({ isDefault: false })
				.where(
					and(
						eq(filterPresets.userId, ctx.user.id),
						eq(filterPresets.isDefault, true),
					),
				);

			// If an id was provided, set that preset as the new default
			if (input.id) {
				const [updated] = await ctx.db
					.update(filterPresets)
					.set({ isDefault: true })
					.where(
						and(
							eq(filterPresets.id, input.id),
							eq(filterPresets.userId, ctx.user.id),
						),
					)
					.returning();

				if (!updated) {
					throw new Error("Preset not found or access denied");
				}

				return updated;
			}

			return null;
		}),

	// =========================================================================
	// EXPORT PROCEDURES
	// =========================================================================

	/**
	 * Export filtered trades for CSV download
	 * Returns trades matching filters with all relevant fields for export
	 */
	exportFilteredTrades: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			// Fetch trades with strategy info
			const closedTradesRaw = await ctx.db
				.select({
					id: trades.id,
					symbol: trades.symbol,
					direction: trades.direction,
					quantity: trades.quantity,
					entryPrice: trades.entryPrice,
					exitPrice: trades.exitPrice,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					realizedPnl: trades.realizedPnl,
					netPnl: trades.netPnl,
					fees: trades.fees,
					stopLoss: trades.stopLoss,
					instrumentType: trades.instrumentType,
					strategyId: trades.strategyId,
					rating: trades.rating,
					isReviewed: trades.isReviewed,
					notes: trades.notes,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(desc(trades.exitTime));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			const closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Fetch strategies for name lookup
			const strategyIds = [
				...new Set(
					closedTrades
						.map((t) => t.strategyId)
						.filter((id): id is string => id !== null),
				),
			];

			let strategyMap = new Map<string, string>();
			if (strategyIds.length > 0) {
				const { strategies } = await import("@/server/db/schema");
				const strategiesData = await ctx.db
					.select({ id: strategies.id, name: strategies.name })
					.from(strategies)
					.where(inArray(strategies.id, strategyIds));
				strategyMap = new Map(strategiesData.map((s) => [s.id, s.name]));
			}

			// Fetch tags for each trade
			const tradeIds = closedTrades.map((t) => t.id);
			const tradeTagsMap = new Map<string, string[]>();
			if (tradeIds.length > 0) {
				const { tradeTags: tradeTagsTable, tags: tagsTable } = await import(
					"@/server/db/schema"
				);
				const tagsData = await ctx.db
					.select({
						tradeId: tradeTagsTable.tradeId,
						tagName: tagsTable.name,
					})
					.from(tradeTagsTable)
					.innerJoin(tagsTable, eq(tradeTagsTable.tagId, tagsTable.id))
					.where(inArray(tradeTagsTable.tradeId, tradeIds));

				for (const tag of tagsData) {
					const existing = tradeTagsMap.get(tag.tradeId) ?? [];
					existing.push(tag.tagName);
					tradeTagsMap.set(tag.tradeId, existing);
				}
			}

			// Calculate R-Multiple and duration for each trade
			const exportData = closedTrades.map((trade) => {
				// Calculate R-Multiple using shared utility
				const rMultiple =
					trade.stopLoss && trade.entryPrice && trade.quantity && trade.netPnl
						? calculateActualRMultiple(
								parsePnl(trade.netPnl),
								parseFloat(trade.entryPrice),
								parseFloat(trade.stopLoss),
								parseFloat(trade.quantity),
								trade.symbol,
								(trade.instrumentType as "futures" | "forex") ?? "futures",
							)
						: null;

				// Calculate duration in minutes
				let durationMinutes: number | null = null;
				if (trade.entryTime && trade.exitTime) {
					const entryMs = new Date(trade.entryTime).getTime();
					const exitMs = new Date(trade.exitTime).getTime();
					durationMinutes = (exitMs - entryMs) / (1000 * 60);
				}

				return {
					exitTime: trade.exitTime,
					entryTime: trade.entryTime,
					symbol: trade.symbol,
					direction: trade.direction,
					quantity: trade.quantity,
					entryPrice: trade.entryPrice,
					exitPrice: trade.exitPrice,
					realizedPnl: trade.realizedPnl,
					netPnl: trade.netPnl,
					fees: trade.fees,
					rMultiple,
					durationMinutes,
					strategyName: trade.strategyId
						? (strategyMap.get(trade.strategyId) ?? null)
						: null,
					tags: tradeTagsMap.get(trade.id) ?? [],
					rating: trade.rating,
					isReviewed: trade.isReviewed ?? false,
					notes: trade.notes,
				};
			});

			return exportData;
		}),

	/**
	 * Get filtered trade count for live preview
	 * Efficient count-only query for real-time filter feedback
	 */
	getFilteredTradeCount: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().nullish(),
					filters: analyticsFilterInput.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			// Build conditions for the query
			const conditions: SQL[] = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNotNull(trades.netPnl),
			];

			// Filter by account if specified, otherwise use active accounts
			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}

			// Apply SQL-compatible filters
			conditions.push(...buildFilterConditions(input?.filters, trades));

			// For simple filters that can be done in SQL, use COUNT(*)
			const hasPostQueryFilters =
				(input?.filters?.daysOfWeek && input.filters.daysOfWeek.length > 0) ||
				(input?.filters?.hours && input.filters.hours.length > 0) ||
				(input?.filters?.sessions && input.filters.sessions.length > 0) ||
				(input?.filters?.outcome && input.filters.outcome !== "all") ||
				(input?.filters?.tags && input.filters.tags.length > 0) ||
				(input?.filters?.rMultipleRange &&
					(input.filters.rMultipleRange.min !== null ||
						input.filters.rMultipleRange.max !== null));

			if (!hasPostQueryFilters) {
				// Fast path: SQL count only
				const result = await ctx.db
					.select({ count: sql<number>`count(*)::int` })
					.from(trades)
					.where(and(...conditions));

				return { count: result[0]?.count ?? 0 };
			}

			// Slow path: need to fetch trades for post-query filtering
			const closedTradesRaw = await ctx.db
				.select({
					id: trades.id,
					netPnl: trades.netPnl,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					entryTime: trades.entryTime,
					exitTime: trades.exitTime,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Apply post-query filters
			let closedTrades = applyPostQueryFilters(
				closedTradesRaw,
				input?.filters,
				{
					beThreshold,
					userTimezone,
				},
			);

			// Apply tags filter (requires join with trade_tags table)
			if (input?.filters?.tags && input.filters.tags.length > 0) {
				const tradeIds = closedTrades.map((t) => t.id);
				if (tradeIds.length > 0) {
					// Get trade IDs that have at least one of the selected tags
					const matchingTradeTags = await ctx.db
						.select({ tradeId: tradeTags.tradeId })
						.from(tradeTags)
						.where(
							and(
								inArray(tradeTags.tradeId, tradeIds),
								inArray(tradeTags.tagId, input.filters.tags),
							),
						);

					const matchingTradeIds = new Set(
						matchingTradeTags.map((tt) => tt.tradeId),
					);
					closedTrades = closedTrades.filter((t) => matchingTradeIds.has(t.id));
				}
			}

			return { count: closedTrades.length };
		}),
});
