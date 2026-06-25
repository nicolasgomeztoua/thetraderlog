import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { calculateAggregateStats, calculateWinRate } from "@/lib/analytics";
import {
	calculateConsistencyMetric,
	calculateDailyLossStatus,
	calculateDailyPnl,
	calculateDrawdownStatus,
	calculateProfitTargetProgress,
	calculateStaticDrawdown,
	calculateTradingDays,
	checkConsistency,
	checkEvalTimeLimit,
	checkInactivity,
	computePayoutEligibility,
	computeTrailingFloor,
	countQualifyingDays,
	getOverallComplianceStatus,
	type PayoutRecord,
} from "@/lib/analytics/prop-compliance";
import { buildEquityCurve } from "@/lib/analytics/risk";
import {
	ERR_ACCOUNT_NOT_CHALLENGE,
	ERR_ACCOUNT_NOT_FOUND,
	ERR_ACCOUNT_NOT_PROP,
	ERR_CHALLENGE_ACCOUNT_NOT_FOUND,
	ERR_GROUP_NOT_FOUND,
} from "@/lib/constants/errors";
import {
	BUFFER_TYPE,
	type BufferType,
	COMPLIANCE_STATUS,
	CONSISTENCY_COMPARATOR,
	CONSISTENCY_RULE_TYPE,
	type ComplianceStatus,
	type ConsistencyComparator,
	type ConsistencyRuleType,
	DATA_CONFIDENCE,
	type DataConfidence,
	DEFAULT_DRAWDOWN_LOCK_BUFFER,
	DRAWDOWN_ANCHOR,
	DRAWDOWN_LOCK,
	type DrawdownBasis,
	type DrawdownHighWaterSource,
	type DrawdownLock,
	isPropAccountType,
	LEGACY_DRAWDOWN_TYPE_TO_AXES,
	PAYOUT_CYCLE_TYPE,
	type PayoutCap,
	type PayoutCycleType,
	type ProfitSplitTier,
	QUALIFYING_DAY_MODE,
	type QualifyingDayMode,
} from "@/lib/constants/prop";
import {
	accountTypeEnum,
	drawdownTypeEnum,
	payoutFrequencyEnum,
	propFieldsSchema,
	tradingPlatformEnum,
} from "@/lib/shared";
import { getDateStringInTimezone } from "@/lib/shared/timezone";
import {
	getUserBreakevenThreshold,
	getUserTimezone,
} from "@/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	accountGroups,
	accountPayouts,
	accounts,
	trades,
} from "@/server/db/schema";

/** Parse a numeric DB decimal/string into a number, or fall back. */
function num(value: string | number | null | undefined, fallback = 0): number {
	if (value === null || value === undefined) return fallback;
	const n = typeof value === "number" ? value : parseFloat(value);
	return Number.isNaN(n) ? fallback : n;
}

/** Parse a JSON-string ladder column into a typed array, or []. */
function parseJsonArray<T>(value: string | null | undefined): T[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

// Input schemas
const createAccountSchema = z
	.object({
		name: z.string().min(1).max(100),
		broker: z.string().optional(),
		platform: tradingPlatformEnum.default("other"),
		accountType: accountTypeEnum.default("live"),
		initialBalance: z.string().optional(),
		currency: z.string().default("USD"),
		accountNumber: z.string().optional(),
		notes: z.string().optional(),
		color: z.string().optional(),
		isDefault: z.boolean().optional(),
	})
	.merge(propFieldsSchema);

const updateAccountSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1).max(100).optional(),
		broker: z.string().optional(),
		platform: tradingPlatformEnum.optional(),
		accountType: accountTypeEnum.optional(),
		initialBalance: z.string().optional(),
		currency: z.string().optional(),
		accountNumber: z.string().optional(),
		notes: z.string().optional(),
		color: z.string().optional(),
		isActive: z.boolean().optional(),
		isDefault: z.boolean().optional(),
	})
	.merge(propFieldsSchema);

// Group schemas
const createGroupSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	color: z.string().optional(),
});

const updateGroupSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
	color: z.string().optional(),
});

// Convert to funded schema
const convertToFundedSchema = z.object({
	challengeAccountId: z.string(),
	// New funded account details
	name: z.string().min(1).max(100),
	initialBalance: z.string(),
	// Prop firm rules for funded account
	maxDrawdown: z.string().optional(),
	drawdownType: drawdownTypeEnum.optional(),
	dailyLossLimit: z.string().optional(),
	profitSplit: z.string().optional(),
	payoutFrequency: payoutFrequencyEnum.optional(),
	consistencyRule: z.string().optional(),
});

export const accountsRouter = createTRPCRouter({
	// ============================================================================
	// ACCOUNT QUERIES
	// ============================================================================

	// Get all accounts for current user
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const userAccounts = await ctx.db.query.accounts.findMany({
			where: eq(accounts.userId, ctx.user.id),
			orderBy: [desc(accounts.isDefault), desc(accounts.createdAt)],
			with: {
				group: true,
				linkedAccount: true,
			},
		});

		return userAccounts;
	}),

	// Get active accounts only
	getActive: protectedProcedure.query(async ({ ctx }) => {
		const userAccounts = await ctx.db.query.accounts.findMany({
			where: and(eq(accounts.userId, ctx.user.id), eq(accounts.isActive, true)),
			orderBy: [desc(accounts.isDefault), desc(accounts.createdAt)],
		});

		return userAccounts;
	}),

	// Get default account
	getDefault: protectedProcedure.query(async ({ ctx }) => {
		const defaultAccount = await ctx.db.query.accounts.findFirst({
			where: and(
				eq(accounts.userId, ctx.user.id),
				eq(accounts.isDefault, true),
			),
		});

		// If no default, return first active account
		if (!defaultAccount) {
			return ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.userId, ctx.user.id),
					eq(accounts.isActive, true),
				),
				orderBy: [desc(accounts.createdAt)],
			});
		}

		return defaultAccount;
	}),

	// Get account by ID
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const account = await ctx.db.query.accounts.findFirst({
				where: and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
				with: {
					group: true,
					linkedAccount: true,
					linkedFromAccounts: true,
				},
			});

			if (!account) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			return account;
		}),

	// Get linked account (for challenge/funded pairs)
	getLinkedAccount: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const account = await ctx.db.query.accounts.findFirst({
				where: and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
			});

			if (!account) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			// If this is a funded account, get its linked challenge
			if (account.linkedAccountId) {
				return ctx.db.query.accounts.findFirst({
					where: eq(accounts.id, account.linkedAccountId),
				});
			}

			// If this is a challenge account, find any funded accounts linked to it
			const linkedFunded = await ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.linkedAccountId, input.id),
					eq(accounts.userId, ctx.user.id),
				),
			});

			return linkedFunded;
		}),

	// ============================================================================
	// ACCOUNT MUTATIONS
	// ============================================================================

	// Create a new account
	create: protectedProcedure
		.input(createAccountSchema)
		.mutation(async ({ ctx, input }) => {
			// If this is set as default, unset other defaults first
			if (input.isDefault) {
				await ctx.db
					.update(accounts)
					.set({ isDefault: false })
					.where(eq(accounts.userId, ctx.user.id));
			}

			// Check if this is the user's first account - make it default
			const existingAccounts = await ctx.db.query.accounts.findMany({
				where: eq(accounts.userId, ctx.user.id),
			});

			const isFirstAccount = existingAccounts.length === 0;

			// Prepare values with proper date parsing
			const values = {
				...input,
				userId: ctx.user.id,
				isDefault: input.isDefault ?? isFirstAccount,
				challengeStartDate: input.challengeStartDate
					? new Date(input.challengeStartDate)
					: undefined,
				challengeEndDate: input.challengeEndDate
					? new Date(input.challengeEndDate)
					: undefined,
				// Set default challenge status for new challenge accounts
				challengeStatus:
					input.accountType === "prop_challenge"
						? (input.challengeStatus ?? "active")
						: input.challengeStatus,
			};

			const [newAccount] = await ctx.db
				.insert(accounts)
				.values(values)
				.returning();

			return newAccount;
		}),

	// Update an account
	update: protectedProcedure
		.input(updateAccountSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			// Verify ownership
			const existingAccount = await ctx.db.query.accounts.findFirst({
				where: and(eq(accounts.id, id), eq(accounts.userId, ctx.user.id)),
			});

			if (!existingAccount) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			// If setting as default, unset other defaults first
			if (updateData.isDefault) {
				await ctx.db
					.update(accounts)
					.set({ isDefault: false })
					.where(eq(accounts.userId, ctx.user.id));
			}

			// Prepare values with proper date parsing
			const values = {
				...updateData,
				challengeStartDate: updateData.challengeStartDate
					? new Date(updateData.challengeStartDate)
					: undefined,
				challengeEndDate: updateData.challengeEndDate
					? new Date(updateData.challengeEndDate)
					: undefined,
			};

			const [updated] = await ctx.db
				.update(accounts)
				.set(values)
				.where(eq(accounts.id, id))
				.returning();

			return updated;
		}),

	// Convert challenge account to funded (Mark as Passed)
	convertToFunded: protectedProcedure
		.input(convertToFundedSchema)
		.mutation(async ({ ctx, input }) => {
			const { challengeAccountId, ...fundedAccountData } = input;

			// Verify ownership and that it's a challenge account
			const challengeAccount = await ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.id, challengeAccountId),
					eq(accounts.userId, ctx.user.id),
				),
			});

			if (!challengeAccount) {
				throw new Error(ERR_CHALLENGE_ACCOUNT_NOT_FOUND);
			}

			if (challengeAccount.accountType !== "prop_challenge") {
				throw new Error(ERR_ACCOUNT_NOT_CHALLENGE);
			}

			// Mark the challenge as passed
			await ctx.db
				.update(accounts)
				.set({ challengeStatus: "passed" })
				.where(eq(accounts.id, challengeAccountId));

			// Create the new funded account linked to the challenge
			const [fundedAccount] = await ctx.db
				.insert(accounts)
				.values({
					userId: ctx.user.id,
					name: fundedAccountData.name,
					broker: challengeAccount.broker,
					platform: challengeAccount.platform,
					accountType: "prop_funded",
					initialBalance: fundedAccountData.initialBalance,
					currency: challengeAccount.currency,
					accountNumber: challengeAccount.accountNumber,
					color: challengeAccount.color,
					// Prop firm fields
					maxDrawdown: fundedAccountData.maxDrawdown,
					drawdownType: fundedAccountData.drawdownType,
					dailyLossLimit: fundedAccountData.dailyLossLimit,
					profitSplit: fundedAccountData.profitSplit,
					payoutFrequency: fundedAccountData.payoutFrequency,
					consistencyRule: fundedAccountData.consistencyRule,
					// Link to challenge
					linkedAccountId: challengeAccountId,
					// Keep in same group if applicable
					groupId: challengeAccount.groupId,
				})
				.returning();

			return {
				challengeAccount: { ...challengeAccount, challengeStatus: "passed" },
				fundedAccount,
			};
		}),

	// Mark challenge as failed
	markChallengeFailed: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const account = await ctx.db.query.accounts.findFirst({
				where: and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
			});

			if (!account) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			if (account.accountType !== "prop_challenge") {
				throw new Error(ERR_ACCOUNT_NOT_CHALLENGE);
			}

			const [updated] = await ctx.db
				.update(accounts)
				.set({ challengeStatus: "failed" })
				.where(eq(accounts.id, input.id))
				.returning();

			return updated;
		}),

	// Set account as default
	setDefault: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const existingAccount = await ctx.db.query.accounts.findFirst({
				where: and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
			});

			if (!existingAccount) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			// Unset all defaults for this user
			await ctx.db
				.update(accounts)
				.set({ isDefault: false })
				.where(eq(accounts.userId, ctx.user.id));

			// Set the new default
			const [updated] = await ctx.db
				.update(accounts)
				.set({ isDefault: true })
				.where(eq(accounts.id, input.id))
				.returning();

			return updated;
		}),

	// Delete an account
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existingAccount = await ctx.db.query.accounts.findFirst({
				where: and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
			});

			if (!existingAccount) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			// Check if there are trades associated with this account
			const associatedTrades = await ctx.db.query.trades.findFirst({
				where: eq(trades.accountId, input.id),
			});

			if (associatedTrades) {
				// Soft-delete trades from this account
				await ctx.db
					.update(trades)
					.set({ deletedAt: new Date() })
					.where(eq(trades.accountId, input.id));
			}

			await ctx.db.delete(accounts).where(eq(accounts.id, input.id));

			// If this was the default account, set another one as default
			if (existingAccount.isDefault) {
				const anotherAccount = await ctx.db.query.accounts.findFirst({
					where: and(
						eq(accounts.userId, ctx.user.id),
						eq(accounts.isActive, true),
					),
				});

				if (anotherAccount) {
					await ctx.db
						.update(accounts)
						.set({ isDefault: true })
						.where(eq(accounts.id, anotherAccount.id));
				}
			}

			return { success: true };
		}),

	// Get account stats
	getStats: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify ownership
			const account = await ctx.db.query.accounts.findFirst({
				where: and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
			});

			if (!account) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			// Breakeven threshold so win/loss classification matches the rest of
			// the app: trades within ±threshold are breakevens, not wins/losses.
			const beThreshold = await getUserBreakevenThreshold(
				ctx.db,
				ctx.user.id,
				ctx.userSettingsCache,
			);

			// Aggregate stats in SQL instead of fetching every closed trade row.
			// NOTE: intentionally does NOT filter deletedAt — this preserves the
			// prior behavior of this endpoint (getPropCompliance does filter it).
			const [agg] = await ctx.db
				.select({
					totalTrades: sql<number>`count(*)::int`,
					wins: sql<number>`count(*) filter (where ${trades.netPnl} > ${beThreshold})::int`,
					losses: sql<number>`count(*) filter (where ${trades.netPnl} < ${-beThreshold})::int`,
					totalPnl: sql<string>`coalesce(sum(${trades.netPnl}), '0')`,
				})
				.from(trades)
				.where(
					and(eq(trades.accountId, input.id), eq(trades.status, "closed")),
				);

			const totalTrades = agg?.totalTrades ?? 0;
			const wins = agg?.wins ?? 0;
			const losses = agg?.losses ?? 0;
			const totalPnl = parseFloat(agg?.totalPnl ?? "0");

			const currentBalance =
				parseFloat(account.initialBalance ?? "0") + totalPnl;

			return {
				totalTrades,
				wins,
				losses,
				// Win rate excludes breakevens from the denominator.
				winRate: calculateWinRate(wins, losses),
				totalPnl,
				initialBalance: parseFloat(account.initialBalance ?? "0"),
				currentBalance,
			};
		}),

	// Get prop compliance metrics for a prop account
	getPropCompliance: protectedProcedure
		.input(z.object({ accountId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify ownership
			const account = await ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.id, input.accountId),
					eq(accounts.userId, ctx.user.id),
				),
			});

			if (!account) {
				throw new Error(ERR_ACCOUNT_NOT_FOUND);
			}

			// Validate it's a prop account
			if (!isPropAccountType(account.accountType)) {
				throw new Error(ERR_ACCOUNT_NOT_PROP);
			}

			// Fetch all closed trades for the account, sorted by exitTime.
			// Only the columns the compliance math reads — downstream helpers
			// (buildEquityCurve, calculateDailyPnl, calculateTradingDays, etc.)
			// use only netPnl and exitTime.
			const accountTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.accountId, input.accountId),
					eq(trades.status, "closed"),
					isNull(trades.deletedAt),
				),
				columns: {
					id: true,
					netPnl: true,
					exitTime: true,
				},
				orderBy: [asc(trades.exitTime)],
			});

			// Get user timezone for date grouping and breakeven threshold so
			// win/loss classification matches the rest of the app.
			const [userTimezone, beThreshold] = await Promise.all([
				getUserTimezone(ctx.db, ctx.user.id, ctx.userSettingsCache),
				getUserBreakevenThreshold(ctx.db, ctx.user.id, ctx.userSettingsCache),
			]);

			const initialBalance = parseFloat(account.initialBalance ?? "0");
			// Nominal program size (e.g. 50000) that program rules anchor to. Falls
			// back to initialBalance for accounts created before this field existed.
			const nominalAccountSize =
				account.accountSize != null ? num(account.accountSize) : initialBalance;
			const maxDrawdownPercent = parseFloat(account.maxDrawdown ?? "0");
			const dailyLossLimitPercent = parseFloat(account.dailyLossLimit ?? "0");
			const profitTargetPercent = parseFloat(account.profitTarget ?? "0");
			const consistencyRulePercent = parseFloat(account.consistencyRule ?? "0");
			const minTradingDays = account.minTradingDays ?? 0;

			// Total P&L
			const totalPnl = accountTrades.reduce(
				(sum, t) => sum + (t.netPnl ? parseFloat(t.netPnl) : 0),
				0,
			);
			const currentBalance = initialBalance + totalPnl;

			// Build equity curve for drawdown calculations
			const equityCurve = buildEquityCurve(accountTrades);

			// --- Drawdown: 4-axis model with lock-at-start. New axis fields win;
			// otherwise fall back to the legacy drawdownType mapping (no lock), so
			// untouched accounts compute identically until they adopt a preset. ---
			const legacyAxes =
				LEGACY_DRAWDOWN_TYPE_TO_AXES[account.drawdownType ?? "static"] ??
				LEGACY_DRAWDOWN_TYPE_TO_AXES.static;
			const ddAnchor = account.drawdownAnchor ?? legacyAxes.anchor;
			const ddHighWaterSource = (account.drawdownHighWaterSource ??
				legacyAxes.highWaterSource) as DrawdownHighWaterSource;
			const ddLock = (account.drawdownLock ?? legacyAxes.lock) as DrawdownLock;
			const ddBasis = (account.drawdownBasis ??
				legacyAxes.basis) as DrawdownBasis;
			const ddLockBuffer =
				account.drawdownLockBuffer != null
					? num(account.drawdownLockBuffer)
					: ddLock === DRAWDOWN_LOCK.AT_START_PLUS_BUFFER
						? DEFAULT_DRAWDOWN_LOCK_BUFFER
						: 0;
			// Drawdown amount in dollars: explicit absolute wins, else % of initial.
			const drawdownAbsolute =
				account.maxDrawdownAbsolute != null
					? num(account.maxDrawdownAbsolute)
					: (maxDrawdownPercent / 100) * initialBalance;
			const drawdownLimitPercent =
				initialBalance > 0
					? (drawdownAbsolute / initialBalance) * 100
					: maxDrawdownPercent;

			let currentDrawdownPercent: number;
			let drawdownConfidence: DataConfidence = DATA_CONFIDENCE.EXACT;
			let drawdownFloor = initialBalance - drawdownAbsolute;
			let drawdownRoom = currentBalance - drawdownFloor;
			let drawdownLockEngaged = false;
			if (ddAnchor === DRAWDOWN_ANCHOR.STATIC) {
				const staticDd = calculateStaticDrawdown(
					initialBalance,
					currentBalance,
				);
				currentDrawdownPercent = staticDd.drawdownPercent;
				drawdownConfidence =
					ddBasis === "equity_unrealized"
						? DATA_CONFIDENCE.APPROXIMATE
						: DATA_CONFIDENCE.EXACT;
			} else {
				const floorResult = computeTrailingFloor(equityCurve, {
					initialBalance,
					lockAnchor: nominalAccountSize,
					drawdownAbsolute,
					highWaterSource: ddHighWaterSource,
					lock: ddLock,
					lockBuffer: ddLockBuffer,
					basis: ddBasis,
					timezone: userTimezone,
				});
				currentDrawdownPercent = floorResult.currentDrawdownPercent;
				drawdownConfidence = floorResult.dataConfidence;
				drawdownFloor = floorResult.floor;
				drawdownRoom = floorResult.roomToFloor;
				drawdownLockEngaged = floorResult.lockEngaged;
			}

			const drawdownStatus = calculateDrawdownStatus(
				currentDrawdownPercent,
				drawdownLimitPercent,
			);

			// Daily loss (timezone-aware)
			const todayPnl = calculateDailyPnl(
				accountTrades,
				undefined,
				userTimezone,
			);
			const dailyLossStatus = calculateDailyLossStatus(
				todayPnl,
				dailyLossLimitPercent,
				initialBalance,
			);

			// Profit target
			const profitTarget = calculateProfitTargetProgress(
				totalPnl,
				profitTargetPercent,
				initialBalance,
			);

			// Consistency
			// Build daily P&L map for consistency metric
			const dailyPnlMap = new Map<string, number>();
			for (const trade of accountTrades) {
				if (!trade.exitTime) continue;
				const dateKey = getDateStringInTimezone(trade.exitTime, userTimezone);
				const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
				dailyPnlMap.set(dateKey, (dailyPnlMap.get(dateKey) ?? 0) + pnl);
			}
			const dailyPnls = Array.from(dailyPnlMap.values());
			const consistency = calculateConsistencyMetric(
				dailyPnls,
				consistencyRulePercent,
			);

			// Typed consistency detail (denominator/comparator/extra-profit-needed).
			const consistencyType = (account.consistencyRuleType ??
				CONSISTENCY_RULE_TYPE.BEST_DAY_PCT_OF_TOTAL) as ConsistencyRuleType;
			const consistencyDetail =
				consistencyType === CONSISTENCY_RULE_TYPE.OFF ||
				consistencyRulePercent <= 0
					? null
					: checkConsistency(
							{ dailyPnls },
							{
								type: consistencyType,
								pct: consistencyRulePercent,
								comparator: (account.consistencyComparator ??
									CONSISTENCY_COMPARATOR.LTE) as ConsistencyComparator,
								profitTarget:
									account.profitTargetAbsolute != null
										? num(account.profitTargetAbsolute)
										: (profitTargetPercent / 100) * initialBalance,
							},
						);

			// Trading days
			const tradingDays = calculateTradingDays(
				accountTrades,
				minTradingDays,
				userTimezone,
			);

			// Timeline
			const now = new Date();
			const startDate = account.challengeStartDate ?? null;
			const endDate = account.challengeEndDate ?? null;
			let daysRemaining: number | null = null;
			let daysElapsed: number | null = null;
			if (startDate) {
				daysElapsed = Math.floor(
					(now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
				);
			}
			if (endDate) {
				daysRemaining = Math.max(
					0,
					Math.ceil(
						(endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
					),
				);
			}

			// Trade stats for Monte Carlo simulation — threshold-aware so win
			// rate and avg win/loss match the rest of the app (breakevens are
			// excluded from the win-rate denominator and from avg win/loss).
			const stats = calculateAggregateStats(accountTrades, beThreshold);

			// Eval time limit (Apex-style 30-day cap; null = unlimited)
			const evalTimeLimit = checkEvalTimeLimit(
				account.challengeStartDate ?? null,
				account.evalMaxDays ?? null,
				now,
			);

			// Inactivity timeout (last closed trade is the latest exitTime — list is asc)
			const lastTradeDate =
				accountTrades.length > 0
					? (accountTrades[accountTrades.length - 1]?.exitTime ?? null)
					: null;
			const inactivity = checkInactivity(
				lastTradeDate,
				account.inactivityLimitDays ?? 0,
				now,
			);

			// Qualifying days (winning-day definition for payout context)
			const qualifyingDayMode = (account.qualifyingDayMode ??
				QUALIFYING_DAY_MODE.ANY_TRADE) as QualifyingDayMode;
			const qualifyingDaysResult = countQualifyingDays(accountTrades, {
				mode: qualifyingDayMode,
				minProfit: num(account.qualifyingDayMinProfit),
				timezone: userTimezone,
			});

			// Payout eligibility (funded accounts only)
			let payout: ReturnType<typeof computePayoutEligibility> | null = null;
			if (account.accountType === "prop_funded") {
				const payoutRows = await ctx.db.query.accountPayouts.findMany({
					where: eq(accountPayouts.accountId, account.id),
					orderBy: [asc(accountPayouts.date)],
				});
				const payoutRecords: PayoutRecord[] = payoutRows.map((p) => ({
					date: p.date,
					paidAmount: num(p.paidAmount),
				}));
				payout = computePayoutEligibility(
					accountTrades,
					payoutRecords,
					{
						initialBalance,
						accountSize: nominalAccountSize,
						safetyNetBuffer:
							account.safetyNetBuffer != null
								? num(account.safetyNetBuffer)
								: undefined,
						totalRealizedPnl: totalPnl,
						drawdownAbsolute,
						winningDayThreshold: num(account.winningDayThreshold),
						winningDaysRequired: account.winningDaysRequired ?? 0,
						payoutCycleType: (account.payoutCycleType ??
							PAYOUT_CYCLE_TYPE.WINNING_DAYS) as PayoutCycleType,
						payoutCycleLength: account.payoutCycleLength ?? 0,
						firstPayoutWaitDays: account.firstPayoutWaitDays ?? undefined,
						firstTradeDate: accountTrades[0]?.exitTime ?? null,
						bufferType: (account.bufferType ?? BUFFER_TYPE.NONE) as BufferType,
						minWithdrawal: num(account.minWithdrawal),
						firstPayoutCaps: parseJsonArray<PayoutCap>(account.firstPayoutCaps),
						maxLifetimePayouts: account.maxLifetimePayouts ?? undefined,
						payoutConsistencyPct: num(account.payoutConsistencyPct),
						consistencyComparator: (account.consistencyComparator ??
							CONSISTENCY_COMPARATOR.LTE) as ConsistencyComparator,
						profitSplitTiers: parseJsonArray<ProfitSplitTier>(
							account.profitSplitTiers,
						),
						profitSplit: num(account.profitSplit, 100),
						timezone: userTimezone,
					},
					now,
				);
			}

			// Overall status — the account-fail risk indicator.
			// Profit target is progress (excluded). Daily loss only counts where it
			// actually fails the account (most futures firms = soft pause, not breach).
			const overallStatuses: ComplianceStatus[] = [drawdownStatus.status];
			if (account.dailyLossFailsAccount) {
				overallStatuses.push(dailyLossStatus.status);
			}
			if (inactivity.breached) overallStatuses.push(COMPLIANCE_STATUS.DANGER);
			if (evalTimeLimit.expired && account.challengeStatus === "active") {
				overallStatuses.push(COMPLIANCE_STATUS.DANGER);
			}
			const overallStatus = getOverallComplianceStatus(overallStatuses);

			return {
				account: {
					id: account.id,
					name: account.name,
					accountType: account.accountType,
					initialBalance,
					currentBalance,
					challengeStatus: account.challengeStatus,
					linkedAccountId: account.linkedAccountId,
				},
				drawdown: {
					current: drawdownStatus.percent,
					limit: drawdownStatus.limit,
					used: drawdownStatus.used,
					remaining: drawdownStatus.remaining,
					type: account.drawdownType ?? "static",
					status: drawdownStatus.status,
					// Expanded 4-axis model
					anchor: ddAnchor,
					highWaterSource: ddHighWaterSource,
					lock: ddLock,
					basis: ddBasis,
					absolute: drawdownAbsolute,
					limitPercent: drawdownLimitPercent,
					floor: drawdownFloor,
					roomToFloor: drawdownRoom,
					lockEngaged: drawdownLockEngaged,
					dataConfidence: drawdownConfidence,
					equityCurve: equityCurve.map((p) => ({
						date: p.date,
						equity: p.equity,
						peak: p.peak,
						drawdown: p.drawdown,
						drawdownPercent: p.drawdownPercent,
					})),
				},
				dailyLoss: {
					todayPnl: dailyLossStatus.current,
					limit: dailyLossStatus.limit,
					used: dailyLossStatus.used,
					remaining: dailyLossStatus.remaining,
					status: dailyLossStatus.status,
					failsAccount: account.dailyLossFailsAccount ?? false,
				},
				profitTarget: {
					current: profitTarget.current,
					target: profitTarget.target,
					progress: profitTarget.progress,
					status: profitTarget.status,
				},
				consistency: {
					maxDayPercent: consistency.maxDayPercent,
					limit: consistency.limit,
					isCompliant: consistency.isCompliant,
					// Typed detail (null when the rule is off)
					detail: consistencyDetail,
					ruleType: consistencyType,
				},
				tradingDays: {
					daysTraded: tradingDays.daysTraded,
					minRequired: tradingDays.minRequired,
					remaining: tradingDays.remaining,
					dates: Array.from(dailyPnlMap.keys()),
				},
				qualifyingDays: {
					mode: qualifyingDayMode,
					count: qualifyingDaysResult.count,
					dates: qualifyingDaysResult.dates,
				},
				inactivity: {
					idleDays: inactivity.idleDays,
					limitDays: inactivity.limitDays,
					breached: inactivity.breached,
					daysUntilBreach: inactivity.daysUntilBreach,
				},
				evalTimeLimit: {
					daysElapsed: evalTimeLimit.daysElapsed,
					maxDays: evalTimeLimit.maxDays,
					daysRemaining: evalTimeLimit.daysRemaining,
					expired: evalTimeLimit.expired,
				},
				payout,
				timeline: {
					startDate,
					endDate,
					daysRemaining,
					daysElapsed,
				},
				overallStatus,
				tradeStats: {
					totalTrades: stats.totalTrades,
					wins: stats.wins,
					losses: stats.losses,
					winRate: stats.winRate,
					avgWin: stats.avgWin,
					avgLoss: stats.avgLoss,
				},
			};
		}),

	// ============================================================================
	// ACCOUNT PAYOUTS (funded payout log)
	// ============================================================================

	// List payouts for a funded account (newest first)
	listPayouts: protectedProcedure
		.input(z.object({ accountId: z.string() }))
		.query(async ({ ctx, input }) => {
			const account = await ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.id, input.accountId),
					eq(accounts.userId, ctx.user.id),
				),
				columns: { id: true },
			});
			if (!account) throw new Error(ERR_ACCOUNT_NOT_FOUND);

			return ctx.db.query.accountPayouts.findMany({
				where: eq(accountPayouts.accountId, input.accountId),
				orderBy: [desc(accountPayouts.date)],
			});
		}),

	// Add a payout to the log
	addPayout: protectedProcedure
		.input(
			z.object({
				accountId: z.string(),
				date: z.string(),
				requestedAmount: z.string().optional(),
				paidAmount: z.string().optional(),
				split: z.string().optional(),
				notes: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const account = await ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.id, input.accountId),
					eq(accounts.userId, ctx.user.id),
				),
				columns: { id: true },
			});
			if (!account) throw new Error(ERR_ACCOUNT_NOT_FOUND);

			// cycleIndex = number of existing payouts (0-based).
			const existing = await ctx.db.query.accountPayouts.findMany({
				where: eq(accountPayouts.accountId, input.accountId),
				columns: { id: true },
			});

			const [created] = await ctx.db
				.insert(accountPayouts)
				.values({
					userId: ctx.user.id,
					accountId: input.accountId,
					date: new Date(input.date),
					requestedAmount: input.requestedAmount,
					paidAmount: input.paidAmount,
					split: input.split,
					cycleIndex: existing.length,
					notes: input.notes,
				})
				.returning();

			return created;
		}),

	// Delete a payout from the log
	deletePayout: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(accountPayouts)
				.where(
					and(
						eq(accountPayouts.id, input.id),
						eq(accountPayouts.userId, ctx.user.id),
					),
				);
			return { success: true };
		}),

	// ============================================================================
	// ACCOUNT GROUPS
	// ============================================================================

	// Get all groups for current user
	getGroups: protectedProcedure.query(async ({ ctx }) => {
		const groups = await ctx.db.query.accountGroups.findMany({
			where: eq(accountGroups.userId, ctx.user.id),
			orderBy: [desc(accountGroups.createdAt)],
			with: {
				accounts: true,
			},
		});

		return groups;
	}),

	// Get group by ID with accounts
	getGroupById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const group = await ctx.db.query.accountGroups.findFirst({
				where: and(
					eq(accountGroups.id, input.id),
					eq(accountGroups.userId, ctx.user.id),
				),
				with: {
					accounts: true,
				},
			});

			if (!group) {
				throw new Error(ERR_GROUP_NOT_FOUND);
			}

			return group;
		}),

	// Create a new group
	createGroup: protectedProcedure
		.input(createGroupSchema)
		.mutation(async ({ ctx, input }) => {
			const [newGroup] = await ctx.db
				.insert(accountGroups)
				.values({
					...input,
					userId: ctx.user.id,
				})
				.returning();

			return newGroup;
		}),

	// Update a group
	updateGroup: protectedProcedure
		.input(updateGroupSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			// Verify ownership
			const existingGroup = await ctx.db.query.accountGroups.findFirst({
				where: and(
					eq(accountGroups.id, id),
					eq(accountGroups.userId, ctx.user.id),
				),
			});

			if (!existingGroup) {
				throw new Error(ERR_GROUP_NOT_FOUND);
			}

			const [updated] = await ctx.db
				.update(accountGroups)
				.set(updateData)
				.where(eq(accountGroups.id, id))
				.returning();

			return updated;
		}),

	// Delete a group
	deleteGroup: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existingGroup = await ctx.db.query.accountGroups.findFirst({
				where: and(
					eq(accountGroups.id, input.id),
					eq(accountGroups.userId, ctx.user.id),
				),
			});

			if (!existingGroup) {
				throw new Error(ERR_GROUP_NOT_FOUND);
			}

			// Remove group assignment from accounts (don't delete the accounts)
			await ctx.db
				.update(accounts)
				.set({ groupId: null })
				.where(eq(accounts.groupId, input.id));

			await ctx.db.delete(accountGroups).where(eq(accountGroups.id, input.id));

			return { success: true };
		}),

	// Get cumulative stats for a group
	getGroupStats: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify ownership
			const group = await ctx.db.query.accountGroups.findFirst({
				where: and(
					eq(accountGroups.id, input.id),
					eq(accountGroups.userId, ctx.user.id),
				),
				with: {
					accounts: true,
				},
			});

			if (!group) {
				throw new Error(ERR_GROUP_NOT_FOUND);
			}

			const accountIds = group.accounts.map((a) => a.id);

			if (accountIds.length === 0) {
				return {
					totalTrades: 0,
					wins: 0,
					losses: 0,
					winRate: 0,
					totalPnl: 0,
					totalInitialBalance: 0,
					totalCurrentBalance: 0,
					accountCount: 0,
				};
			}

			// Get all closed trades for accounts in this group
			const groupTrades = await ctx.db.query.trades.findMany({
				where: and(
					inArray(trades.accountId, accountIds),
					eq(trades.status, "closed"),
				),
			});

			const totalTrades = groupTrades.length;
			const wins = groupTrades.filter(
				(t) => t.netPnl && parseFloat(t.netPnl) > 0,
			).length;
			const losses = groupTrades.filter(
				(t) => t.netPnl && parseFloat(t.netPnl) < 0,
			).length;

			const totalPnl = groupTrades.reduce(
				(sum, t) => sum + (t.netPnl ? parseFloat(t.netPnl) : 0),
				0,
			);

			const totalInitialBalance = group.accounts.reduce(
				(sum, a) => sum + parseFloat(a.initialBalance ?? "0"),
				0,
			);

			return {
				totalTrades,
				wins,
				losses,
				winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
				totalPnl,
				totalInitialBalance,
				totalCurrentBalance: totalInitialBalance + totalPnl,
				accountCount: accountIds.length,
			};
		}),
});
