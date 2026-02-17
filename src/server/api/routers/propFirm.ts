import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import {
	ERR_NOT_PROP_ACCOUNT,
	ERR_PROP_ACCOUNT_NOT_FOUND,
} from "@/lib/constants/errors";
import { PROP_FIRM_TEMPLATES } from "@/lib/constants/prop-firms";
import { calculatePropFirmStatus } from "@/lib/prop-firm/calculator";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { accounts, trades } from "@/server/db/schema";

export const propFirmRouter = createTRPCRouter({
	/**
	 * Get prop firm rule status for a specific account.
	 * Account must belong to the user and be a prop_challenge or prop_funded type.
	 */
	getStatus: protectedProcedure
		.input(z.object({ accountId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			// Fetch account and validate ownership + type
			const account = await ctx.db.query.accounts.findFirst({
				where: and(
					eq(accounts.id, input.accountId),
					eq(accounts.userId, ctx.user.id),
				),
			});

			if (!account) {
				throw new Error(ERR_PROP_ACCOUNT_NOT_FOUND);
			}

			if (
				account.accountType !== "prop_challenge" &&
				account.accountType !== "prop_funded"
			) {
				throw new Error(ERR_NOT_PROP_ACCOUNT);
			}

			// Fetch all closed trades for this account, sorted by entry time
			const accountTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.accountId, input.accountId),
					eq(trades.status, "closed"),
					isNull(trades.deletedAt),
				),
				orderBy: [asc(trades.entryTime)],
			});

			// Map trades to the shape expected by the calculator
			const calcTrades = accountTrades.map((t) => ({
				netPnl: t.netPnl,
				fees: t.fees,
				entryTime: t.entryTime,
				exitTime: t.exitTime,
				quantity: t.quantity,
			}));

			// Run the status aggregator
			const status = calculatePropFirmStatus(
				{
					initialBalance: account.initialBalance,
					maxDrawdown: account.maxDrawdown,
					drawdownType: account.drawdownType,
					dailyLossLimit: account.dailyLossLimit,
					profitTarget: account.profitTarget,
					consistencyRule: account.consistencyRule,
					minTradingDays: account.minTradingDays,
					maxPositionSize: account.maxPositionSize,
					challengeStartDate: account.challengeStartDate,
					challengeEndDate: account.challengeEndDate,
					challengeStatus: account.challengeStatus,
				},
				calcTrades,
			);

			return status;
		}),

	/**
	 * Get all available prop firm templates.
	 * Returns the static PROP_FIRM_TEMPLATES constant.
	 */
	getTemplates: protectedProcedure.query(() => {
		return PROP_FIRM_TEMPLATES;
	}),
});
