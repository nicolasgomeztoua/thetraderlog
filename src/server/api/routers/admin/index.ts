import { count, eq, gte, sql } from "drizzle-orm";
import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
	aiConversations,
	aiMessages,
	bugReports,
	trades,
	users,
} from "@/server/db/schema";

export const adminRouter = createTRPCRouter({
	analytics: createTRPCRouter({
		platformStats: adminProcedure.query(async ({ ctx }) => {
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

			const [
				[userCount],
				[tradeCount],
				[openBugCount],
				activeTradeUsers,
				activeAiUsers,
				[aiConvoCount],
				[tokenSum],
			] = await Promise.all([
				ctx.db.select({ count: count() }).from(users),
				ctx.db.select({ count: count() }).from(trades),
				ctx.db
					.select({ count: count() })
					.from(bugReports)
					.where(eq(bugReports.status, "open")),
				ctx.db
					.selectDistinct({ userId: trades.userId })
					.from(trades)
					.where(gte(trades.entryTime, sevenDaysAgo)),
				ctx.db
					.selectDistinct({ userId: aiConversations.userId })
					.from(aiConversations)
					.where(gte(aiConversations.createdAt, sevenDaysAgo)),
				ctx.db
					.select({ count: count() })
					.from(aiConversations)
					.where(gte(aiConversations.createdAt, sevenDaysAgo)),
				ctx.db
					.select({
						total: sql<string>`coalesce(sum(${aiMessages.tokensUsed}), 0)`,
					})
					.from(aiMessages),
			]);

			// Combine active trade users and active AI users into a unique set
			const activeUserIds = new Set([
				...activeTradeUsers.map((r) => r.userId),
				...activeAiUsers.map((r) => r.userId),
			]);

			return {
				totalUsers: userCount?.count ?? 0,
				activeUsersLast7d: activeUserIds.size,
				totalTrades: tradeCount?.count ?? 0,
				openBugReports: openBugCount?.count ?? 0,
				aiConversationsLast7d: aiConvoCount?.count ?? 0,
				totalTokensUsed: Number(tokenSum?.total ?? 0),
			};
		}),
	}),
});
