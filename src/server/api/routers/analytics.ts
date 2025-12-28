import { and, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
	buildEquityCurve,
	calculateRiskMetrics,
	findDrawdownPeriods,
} from "@/lib/risk-calculations";
import { calculateAggregateStats, parsePnl } from "@/lib/stats-calculations";
import { getPointValue } from "@/lib/symbols";
import {
	getDateStringInTimezone,
	getDayOfWeekInTimezone,
	getHourInTimezone,
	getMonthStringInTimezone,
} from "@/lib/timezone";
import {
	getActiveAccountsSubquery,
	getUserBreakevenThreshold,
	getUserTimezone,
} from "@/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { accounts, trades, userSettings } from "@/server/db/schema";

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
					accountId: z.number().nullish(),
					startDate: z.string().datetime().nullish(),
					endDate: z.string().datetime().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			// Build conditions for the query
			const conditions = [
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

			// Date range filters
			if (input?.startDate) {
				conditions.push(gte(trades.exitTime, new Date(input.startDate)));
			}
			if (input?.endDate) {
				conditions.push(lte(trades.exitTime, new Date(input.endDate)));
			}

			// Fetch all closed trades with P&L
			const closedTrades = await ctx.db
				.select({
					id: trades.id,
					netPnl: trades.netPnl,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					exitTime: trades.exitTime,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user's breakeven threshold
			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);

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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			// Get trades from last 365 days
			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					exitTime: trades.exitTime,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Aggregate by date in user's timezone
			const dailyData = new Map<
				string,
				{ pnl: number; trades: number; wins: number; losses: number }
			>();

			for (const trade of closedTrades) {
				if (!trade.exitTime) continue;
				// Use timezone-aware date grouping
				const dateKey = getDateStringInTimezone(trade.exitTime, userTimezone);

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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					exitTime: trades.exitTime,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

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
				if (!trade.exitTime) continue;
				// Use timezone-aware day calculation
				const dayIndex = getDayOfWeekInTimezone(trade.exitTime, userTimezone);
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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
				})
				.from(trades)
				.where(and(...conditions));

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

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
	 * All times are in UTC
	 */
	getPerformanceBySession: protectedProcedure
		.input(
			z
				.object({
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryTime: trades.entryTime,
				})
				.from(trades)
				.where(and(...conditions));

			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);

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
					start: config.startHour,
					end: config.endHour,
					color: config.color || "#6366f1",
					pnl: 0,
					trades: 0,
					wins: 0,
					losses: 0,
				};
			}

			// Helper to determine which sessions an hour belongs to (based on UTC hours)
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
				// Sessions use UTC hours
				const hour = trade.entryTime.getUTCHours();
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
					accountId: z.number().nullish(),
					months: z.number().min(1).max(24).default(12),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const monthsBack = input?.months ?? 12;
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - monthsBack);
			startDate.setDate(1);
			startDate.setHours(0, 0, 0, 0);

			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					exitTime: trades.exitTime,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Get user settings
			const [beThreshold, userTimezone] = await Promise.all([
				getUserBreakevenThreshold(ctx.db, ctx.user.id),
				getUserTimezone(ctx.db, ctx.user.id),
			]);

			// Aggregate by month in user's timezone
			const monthData = new Map<
				string,
				{ pnl: number; trades: number; wins: number; losses: number }
			>();

			for (const trade of closedTrades) {
				if (!trade.exitTime) continue;
				// Use timezone-aware month extraction
				const monthKey = getMonthStringInTimezone(trade.exitTime, userTimezone);

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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			// Fetch trades sorted by exit time for equity curve
			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					exitTime: trades.exitTime,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Also get aggregate stats for Kelly/RoR calculations
			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);
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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					id: trades.id,
					netPnl: trades.netPnl,
					exitTime: trades.exitTime,
					symbol: trades.symbol,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

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
					accountId: z.number().nullish(),
					limit: z.number().min(1).max(20).default(10),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					exitTime: trades.exitTime,
				})
				.from(trades)
				.where(and(...conditions))
				.orderBy(trades.exitTime);

			// Build cumulative P&L curve (starts at $0)
			const curve = buildEquityCurve(
				closedTrades.map((t) => ({
					netPnl: t.netPnl,
					exitTime: t.exitTime,
				})),
			);

			const periods = findDrawdownPeriods(curve, 1);
			const limit = input?.limit ?? 10;

			// Format dates for JSON serialization
			return periods.slice(0, limit).map((period) => ({
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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					entryPrice: trades.entryPrice,
					stopLoss: trades.stopLoss,
					quantity: trades.quantity,
					direction: trades.direction,
					symbol: trades.symbol,
					instrumentType: trades.instrumentType,
				})
				.from(trades)
				.where(and(...conditions));

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

				const entryPrice = parseFloat(trade.entryPrice);
				const stopLoss = parseFloat(trade.stopLoss);
				const quantity = parseFloat(trade.quantity);
				const netPnl = parsePnl(trade.netPnl);

				// Calculate risk per unit based on direction
				const riskPerUnit = Math.abs(entryPrice - stopLoss);
				if (riskPerUnit === 0 || quantity === 0) continue;

				// Get point value for this instrument to convert to dollars
				const pointValue = getPointValue(
					trade.symbol,
					trade.instrumentType as "futures" | "forex",
				);

				// Total planned risk in dollars
				const plannedRisk = riskPerUnit * pointValue * quantity;
				// R-Multiple = actual P&L / planned risk
				const rMultiple = netPnl / plannedRisk;

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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
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

			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);

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
				const quantity = parseFloat(trade.quantity);
				const netPnl = parsePnl(trade.netPnl);

				const riskPerUnit = Math.abs(entryPrice - stopLoss);
				if (riskPerUnit === 0 || quantity === 0) continue;

				// Get point value for this instrument to convert to dollars
				const pointValue = getPointValue(
					trade.symbol,
					trade.instrumentType as "futures" | "forex",
				);

				// Calculate planned risk in dollars
				const plannedRisk = riskPerUnit * pointValue * quantity;
				const rMultiple = netPnl / plannedRisk;
				rMultiples.push(rMultiple);

				if (netPnl > beThreshold) wins++;
				else if (netPnl < -beThreshold) losses++;

				// If we have TP, calculate planned R:R and efficiency
				if (trade.takeProfit) {
					const takeProfit = parseFloat(trade.takeProfit);
					const rewardPerUnit = Math.abs(takeProfit - entryPrice);
					const plannedRR = rewardPerUnit / riskPerUnit;
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
			const winRate =
				wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

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
					accountId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
					quantity: trades.quantity,
					symbol: trades.symbol,
				})
				.from(trades)
				.where(and(...conditions));

			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);

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
	getMonteCarloSimulation: protectedProcedure
		.input(
			z
				.object({
					accountId: z.number().nullish(),
					iterations: z.number().min(100).max(10000).default(1000),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
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

			const closedTrades = await ctx.db
				.select({
					netPnl: trades.netPnl,
				})
				.from(trades)
				.where(and(...conditions));

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
});
