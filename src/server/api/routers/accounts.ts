import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import {
	calculateConsistencyMetric,
	calculateDailyLossStatus,
	calculateDailyPnl,
	calculateDrawdownStatus,
	calculateProfitTargetProgress,
	calculateStaticDrawdown,
	calculateTradingDays,
	calculateTrailingDrawdown,
	getOverallComplianceStatus,
} from "@/lib/analytics/prop-compliance";
import { buildEquityCurve } from "@/lib/analytics/risk";
import {
	ERR_ACCOUNT_NOT_CHALLENGE,
	ERR_ACCOUNT_NOT_FOUND,
	ERR_ACCOUNT_NOT_PROP,
	ERR_CHALLENGE_ACCOUNT_NOT_FOUND,
	ERR_GROUP_NOT_FOUND,
} from "@/lib/constants/errors";
import { isPropAccountType } from "@/lib/constants/prop";
import {
	accountTypeEnum,
	drawdownTypeEnum,
	payoutFrequencyEnum,
	propFieldsSchema,
	tradingPlatformEnum,
} from "@/lib/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { accountGroups, accounts, trades } from "@/server/db/schema";

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

			// Get all closed trades for this account
			const accountTrades = await ctx.db.query.trades.findMany({
				where: and(eq(trades.accountId, input.id), eq(trades.status, "closed")),
			});

			const totalTrades = accountTrades.length;
			const wins = accountTrades.filter(
				(t) => t.netPnl && parseFloat(t.netPnl) > 0,
			).length;
			const losses = accountTrades.filter(
				(t) => t.netPnl && parseFloat(t.netPnl) < 0,
			).length;

			const totalPnl = accountTrades.reduce(
				(sum, t) => sum + (t.netPnl ? parseFloat(t.netPnl) : 0),
				0,
			);

			const currentBalance =
				parseFloat(account.initialBalance ?? "0") + totalPnl;

			return {
				totalTrades,
				wins,
				losses,
				winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
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

			// Fetch all closed trades for the account, sorted by exitTime
			const accountTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.accountId, input.accountId),
					eq(trades.status, "closed"),
					isNull(trades.deletedAt),
				),
				orderBy: [asc(trades.exitTime)],
			});

			const initialBalance = parseFloat(account.initialBalance ?? "0");
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

			// Drawdown calculation (trailing vs static)
			let currentDrawdownPercent: number;
			if (account.drawdownType === "trailing") {
				const trailing = calculateTrailingDrawdown(equityCurve, initialBalance);
				currentDrawdownPercent = trailing.currentDrawdownPercent;
			} else {
				const staticDd = calculateStaticDrawdown(
					initialBalance,
					currentBalance,
				);
				currentDrawdownPercent = staticDd.drawdownPercent;
			}

			const drawdownStatus = calculateDrawdownStatus(
				currentDrawdownPercent,
				maxDrawdownPercent,
			);

			// Daily loss
			const todayPnl = calculateDailyPnl(accountTrades);
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
				const dateKey = trade.exitTime.toISOString().slice(0, 10);
				const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
				dailyPnlMap.set(dateKey, (dailyPnlMap.get(dateKey) ?? 0) + pnl);
			}
			const dailyPnls = Array.from(dailyPnlMap.values());
			const consistency = calculateConsistencyMetric(
				dailyPnls,
				consistencyRulePercent,
			);

			// Trading days
			const tradingDays = calculateTradingDays(accountTrades, minTradingDays);

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

			// Trade stats for Monte Carlo simulation
			const wins = accountTrades.filter(
				(t) => t.netPnl && parseFloat(t.netPnl) > 0,
			).length;
			const losses = accountTrades.filter(
				(t) => t.netPnl && parseFloat(t.netPnl) < 0,
			).length;
			const grossProfit = accountTrades.reduce((sum, t) => {
				const pnl = t.netPnl ? parseFloat(t.netPnl) : 0;
				return pnl > 0 ? sum + pnl : sum;
			}, 0);
			const grossLoss = accountTrades.reduce((sum, t) => {
				const pnl = t.netPnl ? parseFloat(t.netPnl) : 0;
				return pnl < 0 ? sum + Math.abs(pnl) : sum;
			}, 0);

			// Overall status
			const overallStatus = getOverallComplianceStatus([
				drawdownStatus.status,
				dailyLossStatus.status,
				profitTarget.status,
			]);

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
				},
				tradingDays: {
					daysTraded: tradingDays.daysTraded,
					minRequired: tradingDays.minRequired,
					remaining: tradingDays.remaining,
					dates: Array.from(dailyPnlMap.keys()),
				},
				timeline: {
					startDate,
					endDate,
					daysRemaining,
					daysElapsed,
				},
				overallStatus,
				tradeStats: {
					totalTrades: accountTrades.length,
					wins,
					losses,
					winRate:
						accountTrades.length > 0 ? (wins / accountTrades.length) * 100 : 0,
					avgWin: wins > 0 ? grossProfit / wins : 0,
					avgLoss: losses > 0 ? grossLoss / losses : 0,
				},
			};
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
