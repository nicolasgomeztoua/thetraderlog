import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/constants/admin";
import {
	ERR_ADMIN_BUG_REPORT_NOT_FOUND,
	ERR_ADMIN_CONVERSATION_NOT_FOUND,
	ERR_ADMIN_INVALID_STATUS_TRANSITION,
	ERR_ADMIN_ROLE_UPDATE_FAILED,
	ERR_ADMIN_USER_NOT_FOUND,
} from "@/lib/constants/errors";
import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
	aiConversationModeEnum,
	aiConversationStatusEnum,
	aiConversations,
	aiMessages,
	bugCategoryEnum,
	bugReportStatusEnum,
	bugReports,
	bugSeverityEnum,
	trades,
	users,
} from "@/server/db/schema";

export const adminRouter = createTRPCRouter({
	bugReports: createTRPCRouter({
		list: adminProcedure
			.input(
				z.object({
					status: z.enum(bugReportStatusEnum.enumValues).optional(),
					category: z.enum(bugCategoryEnum.enumValues).optional(),
					severity: z.enum(bugSeverityEnum.enumValues).optional(),
					page: z.number().int().min(1).default(1),
					pageSize: z
						.number()
						.int()
						.min(1)
						.max(100)
						.default(ADMIN_TABLE_PAGE_SIZE),
				}),
			)
			.query(async ({ ctx, input }) => {
				const conditions = [];
				if (input.status) {
					conditions.push(eq(bugReports.status, input.status));
				}
				if (input.category) {
					conditions.push(eq(bugReports.category, input.category));
				}
				if (input.severity) {
					conditions.push(eq(bugReports.severity, input.severity));
				}

				const whereClause =
					conditions.length > 0 ? and(...conditions) : undefined;
				const offset = (input.page - 1) * input.pageSize;

				const [items, [totalRow]] = await Promise.all([
					ctx.db.query.bugReports.findMany({
						where: whereClause,
						with: { user: true },
						orderBy: [desc(bugReports.createdAt)],
						limit: input.pageSize,
						offset,
					}),
					ctx.db.select({ count: count() }).from(bugReports).where(whereClause),
				]);

				const total = totalRow?.count ?? 0;

				return {
					items: items.map((item) => ({
						id: item.id,
						title: item.title,
						description: item.description,
						severity: item.severity,
						category: item.category,
						status: item.status,
						screenshotKey: item.screenshotKey,
						pageUrl: item.pageUrl,
						userAgent: item.userAgent,
						metadata: item.metadata,
						createdAt: item.createdAt,
						user: {
							id: item.user.id,
							name: item.user.name,
							email: item.user.email,
							imageUrl: item.user.imageUrl,
						},
					})),
					total,
					page: input.page,
					pageSize: input.pageSize,
					totalPages: Math.ceil(total / input.pageSize),
				};
			}),

		getById: adminProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ ctx, input }) => {
				const report = await ctx.db.query.bugReports.findFirst({
					where: eq(bugReports.id, input.id),
					with: { user: true },
				});

				if (!report) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_ADMIN_BUG_REPORT_NOT_FOUND,
					});
				}

				return {
					id: report.id,
					title: report.title,
					description: report.description,
					severity: report.severity,
					category: report.category,
					status: report.status,
					screenshotKey: report.screenshotKey,
					pageUrl: report.pageUrl,
					userAgent: report.userAgent,
					metadata: report.metadata,
					createdAt: report.createdAt,
					user: {
						id: report.user.id,
						name: report.user.name,
						email: report.user.email,
						imageUrl: report.user.imageUrl,
					},
				};
			}),

		updateStatus: adminProcedure
			.input(
				z.object({
					id: z.string(),
					status: z.enum(bugReportStatusEnum.enumValues),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const existing = await ctx.db.query.bugReports.findFirst({
					where: eq(bugReports.id, input.id),
				});

				if (!existing) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_ADMIN_BUG_REPORT_NOT_FOUND,
					});
				}

				// Validate status transitions: open → in_progress → resolved → closed
				const validTransitions: Record<string, string[]> = {
					open: ["in_progress", "closed"],
					in_progress: ["resolved", "open", "closed"],
					resolved: ["closed", "open"],
					closed: ["open"],
				};

				const allowed = validTransitions[existing.status] ?? [];
				if (!allowed.includes(input.status)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: ERR_ADMIN_INVALID_STATUS_TRANSITION,
					});
				}

				const [updated] = await ctx.db
					.update(bugReports)
					.set({ status: input.status })
					.where(eq(bugReports.id, input.id))
					.returning();

				return updated;
			}),
	}),

	users: createTRPCRouter({
		list: adminProcedure
			.input(
				z.object({
					search: z.string().optional(),
					page: z.number().int().min(1).default(1),
					pageSize: z
						.number()
						.int()
						.min(1)
						.max(100)
						.default(ADMIN_TABLE_PAGE_SIZE),
				}),
			)
			.query(async ({ ctx, input }) => {
				const conditions = [];
				if (input.search) {
					conditions.push(
						or(
							ilike(users.name, `%${input.search}%`),
							ilike(users.email, `%${input.search}%`),
						),
					);
				}

				const whereClause =
					conditions.length > 0 ? and(...conditions) : undefined;
				const offset = (input.page - 1) * input.pageSize;

				const [userRows, [totalRow]] = await Promise.all([
					ctx.db
						.select({
							id: users.id,
							clerkId: users.clerkId,
							name: users.name,
							email: users.email,
							imageUrl: users.imageUrl,
							role: users.role,
							createdAt: users.createdAt,
							accountCount: sql<number>`cast((select count(*) from "account" where "account"."user_id" = "user"."id") as integer)`,
							tradeCount: sql<number>`cast((select count(*) from "trade" where "trade"."user_id" = "user"."id" and "trade"."deleted_at" is null) as integer)`,
							lastActive: sql<Date | null>`greatest(
								(select max("entry_time") from "trade" where "trade"."user_id" = "user"."id" and "trade"."deleted_at" is null),
								(select max("created_at") from "ai_conversation" where "ai_conversation"."user_id" = "user"."id")
							)`,
						})
						.from(users)
						.where(whereClause)
						.orderBy(desc(users.createdAt))
						.limit(input.pageSize)
						.offset(offset),
					ctx.db.select({ count: count() }).from(users).where(whereClause),
				]);

				const total = totalRow?.count ?? 0;

				return {
					items: userRows.map((u) => ({
						id: u.id,
						clerkId: u.clerkId,
						name: u.name,
						email: u.email,
						imageUrl: u.imageUrl,
						role: u.role,
						createdAt: u.createdAt,
						accountCount: u.accountCount,
						tradeCount: u.tradeCount,
						lastActive: u.lastActive,
					})),
					total,
					page: input.page,
					pageSize: input.pageSize,
					totalPages: Math.ceil(total / input.pageSize),
				};
			}),

		getById: adminProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ ctx, input }) => {
				const user = await ctx.db.query.users.findFirst({
					where: eq(users.id, input.id),
					with: {
						accounts: true,
					},
				});

				if (!user) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_ADMIN_USER_NOT_FOUND,
					});
				}

				const [recentTrades, [aiConvoCount], [bugReportCount]] =
					await Promise.all([
						ctx.db.query.trades.findMany({
							where: and(eq(trades.userId, input.id), isNull(trades.deletedAt)),
							orderBy: [desc(trades.entryTime)],
							limit: 10,
						}),
						ctx.db
							.select({ count: count() })
							.from(aiConversations)
							.where(eq(aiConversations.userId, input.id)),
						ctx.db
							.select({ count: count() })
							.from(bugReports)
							.where(eq(bugReports.userId, input.id)),
					]);

				return {
					id: user.id,
					clerkId: user.clerkId,
					name: user.name,
					email: user.email,
					imageUrl: user.imageUrl,
					role: user.role,
					createdAt: user.createdAt,
					accounts: user.accounts.map((a) => ({
						id: a.id,
						name: a.name,
						accountType: a.accountType,
						broker: a.broker,
						isActive: a.isActive,
						createdAt: a.createdAt,
					})),
					recentTrades: recentTrades.map((t) => ({
						id: t.id,
						symbol: t.symbol,
						direction: t.direction,
						status: t.status,
						entryTime: t.entryTime,
						exitTime: t.exitTime,
						realizedPnl: t.realizedPnl,
						netPnl: t.netPnl,
					})),
					aiConversationCount: aiConvoCount?.count ?? 0,
					bugReportCount: bugReportCount?.count ?? 0,
				};
			}),

		updateRole: adminProcedure
			.input(
				z.object({
					id: z.string(),
					role: z.enum(["user", "admin"]),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const existing = await ctx.db.query.users.findFirst({
					where: eq(users.id, input.id),
				});

				if (!existing) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_ADMIN_USER_NOT_FOUND,
					});
				}

				const [updated] = await ctx.db
					.update(users)
					.set({ role: input.role })
					.where(eq(users.id, input.id))
					.returning();

				if (!updated) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: ERR_ADMIN_ROLE_UPDATE_FAILED,
					});
				}

				return {
					id: updated.id,
					name: updated.name,
					email: updated.email,
					role: updated.role,
				};
			}),
	}),

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

	ai: createTRPCRouter({
		listConversations: adminProcedure
			.input(
				z.object({
					mode: z.enum(aiConversationModeEnum.enumValues).optional(),
					status: z.enum(aiConversationStatusEnum.enumValues).optional(),
					page: z.number().int().min(1).default(1),
					pageSize: z
						.number()
						.int()
						.min(1)
						.max(100)
						.default(ADMIN_TABLE_PAGE_SIZE),
				}),
			)
			.query(async ({ ctx, input }) => {
				const conditions = [];
				if (input.mode) {
					conditions.push(eq(aiConversations.mode, input.mode));
				}
				if (input.status) {
					conditions.push(eq(aiConversations.status, input.status));
				}

				const whereClause =
					conditions.length > 0 ? and(...conditions) : undefined;
				const offset = (input.page - 1) * input.pageSize;

				const [rows, [totalRow]] = await Promise.all([
					ctx.db
						.select({
							id: aiConversations.id,
							userId: aiConversations.userId,
							title: aiConversations.title,
							status: aiConversations.status,
							mode: aiConversations.mode,
							model: aiConversations.model,
							createdAt: aiConversations.createdAt,
							messageCount: sql<number>`cast((select count(*) from "ai_message" where "ai_message"."conversation_id" = "ai_conversation"."id") as integer)`,
							tokenCount: sql<number>`cast(coalesce((select sum("tokens_used") from "ai_message" where "ai_message"."conversation_id" = "ai_conversation"."id"), 0) as integer)`,
							userName: users.name,
							userEmail: users.email,
							userImageUrl: users.imageUrl,
						})
						.from(aiConversations)
						.innerJoin(users, eq(aiConversations.userId, users.id))
						.where(whereClause)
						.orderBy(desc(aiConversations.createdAt))
						.limit(input.pageSize)
						.offset(offset),
					ctx.db
						.select({ count: count() })
						.from(aiConversations)
						.where(whereClause),
				]);

				const total = totalRow?.count ?? 0;

				return {
					items: rows.map((r) => ({
						id: r.id,
						title: r.title,
						status: r.status,
						mode: r.mode,
						model: r.model,
						createdAt: r.createdAt,
						messageCount: r.messageCount,
						tokenCount: r.tokenCount,
						user: {
							id: r.userId,
							name: r.userName,
							email: r.userEmail,
							imageUrl: r.userImageUrl,
						},
					})),
					total,
					page: input.page,
					pageSize: input.pageSize,
					totalPages: Math.ceil(total / input.pageSize),
				};
			}),

		getConversation: adminProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ ctx, input }) => {
				const conversation = await ctx.db.query.aiConversations.findFirst({
					where: eq(aiConversations.id, input.id),
					with: {
						user: true,
						messages: {
							orderBy: [asc(aiMessages.createdAt)],
						},
					},
				});

				if (!conversation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_ADMIN_CONVERSATION_NOT_FOUND,
					});
				}

				return {
					id: conversation.id,
					title: conversation.title,
					status: conversation.status,
					mode: conversation.mode,
					model: conversation.model,
					initialPrompt: conversation.initialPrompt,
					dateRangeStart: conversation.dateRangeStart,
					dateRangeEnd: conversation.dateRangeEnd,
					createdAt: conversation.createdAt,
					user: {
						id: conversation.user.id,
						name: conversation.user.name,
						email: conversation.user.email,
						imageUrl: conversation.user.imageUrl,
					},
					messages: conversation.messages.map((m) => ({
						id: m.id,
						role: m.role,
						content: m.content,
						model: m.model,
						tokensUsed: m.tokensUsed,
						toolCalls: m.toolCalls,
						createdAt: m.createdAt,
					})),
				};
			}),

		usageStats: adminProcedure.query(async ({ ctx }) => {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const [[totalTokensRow], tokensByModel, conversationsByMode, dailyUsage] =
				await Promise.all([
					ctx.db
						.select({
							total: sql<string>`coalesce(sum(${aiMessages.tokensUsed}), 0)`,
						})
						.from(aiMessages),
					ctx.db
						.select({
							model: aiMessages.model,
							tokens: sql<string>`coalesce(sum(${aiMessages.tokensUsed}), 0)`,
						})
						.from(aiMessages)
						.where(sql`${aiMessages.model} is not null`)
						.groupBy(aiMessages.model),
					ctx.db
						.select({
							mode: aiConversations.mode,
							count: count(),
						})
						.from(aiConversations)
						.groupBy(aiConversations.mode),
					ctx.db
						.select({
							date: sql<string>`date_trunc('day', ${aiMessages.createdAt})::date::text`,
							tokens: sql<string>`coalesce(sum(${aiMessages.tokensUsed}), 0)`,
							messageCount: count(),
						})
						.from(aiMessages)
						.where(gte(aiMessages.createdAt, thirtyDaysAgo))
						.groupBy(sql`date_trunc('day', ${aiMessages.createdAt})`)
						.orderBy(sql`date_trunc('day', ${aiMessages.createdAt})`),
				]);

			return {
				totalTokensUsed: Number(totalTokensRow?.total ?? 0),
				tokensByModel: tokensByModel.map((r) => ({
					model: r.model,
					tokens: Number(r.tokens),
				})),
				conversationsByMode: conversationsByMode.map((r) => ({
					mode: r.mode,
					count: r.count,
				})),
				dailyUsage: dailyUsage.map((r) => ({
					date: r.date,
					tokens: Number(r.tokens),
					messageCount: r.messageCount,
				})),
			};
		}),
	}),
});
