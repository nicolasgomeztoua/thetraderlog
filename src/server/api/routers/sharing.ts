import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
	ERR_SHARE_LINK_LIMIT_REACHED,
	ERR_SHARE_LINK_NOT_FOUND,
	ERR_SHARE_RESOURCE_NOT_COMPLETE,
	ERR_SHARE_RESOURCE_NOT_FOUND,
	MAX_SHARE_LINKS_PER_RESOURCE,
} from "@/lib/constants";
import { getExtendedDayBars, getFullDayBars } from "@/lib/market-data/service";
import { generateShareToken } from "@/lib/shared/id";
import { getSharedConversationPayload } from "@/server/api/helpers/conversation-share";
import { getSharedTradePayload } from "@/server/api/helpers/trade-share";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";
import type { db } from "@/server/db";
import {
	accounts,
	aiConversations,
	aiMessages,
	aiReports,
	shareLinks,
	shareResourceTypeEnum,
	trades,
} from "@/server/db/schema";

const shareResourceTypeSchema = z.enum(shareResourceTypeEnum.enumValues);

/**
 * Find a share link by token and assert it is usable (active, not expired).
 * Throws the same error shapes the share page relies on ("revoked"/"expired").
 */
async function resolveActiveLink(database: typeof db, token: string) {
	const link = await database.query.shareLinks.findFirst({
		where: eq(shareLinks.token, token),
	});

	if (!link) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: ERR_SHARE_LINK_NOT_FOUND,
		});
	}

	if (!link.isActive) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "revoked",
		});
	}

	if (link.expiresAt && link.expiresAt < new Date()) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "expired",
		});
	}

	return link;
}

export const sharingRouter = createTRPCRouter({
	// =========================================================================
	// PUBLIC: Resolve a share token → report content
	// =========================================================================
	resolveToken: publicProcedure
		.input(z.object({ token: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const link = await resolveActiveLink(ctx.db, input.token);

			// Increment view count
			await ctx.db
				.update(shareLinks)
				.set({
					viewCount: sql`${shareLinks.viewCount} + 1`,
					lastViewedAt: new Date(),
				})
				.where(eq(shareLinks.id, link.id));

			// Fetch the resource based on type
			if (link.resourceType === "report") {
				const report = await ctx.db.query.aiReports.findFirst({
					where: eq(aiReports.id, link.resourceId),
					columns: {
						title: true,
						content: true,
						dataArtifacts: true,
						completedAt: true,
						prompt: true,
						model: true,
					},
				});

				if (!report) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}

				return {
					resourceType: link.resourceType,
					report,
				};
			}

			if (link.resourceType === "trade") {
				const payload = await getSharedTradePayload(ctx.db, link.resourceId);

				if (!payload) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}

				return {
					resourceType: link.resourceType,
					...payload,
				};
			}

			if (link.resourceType === "conversation") {
				const payload = await getSharedConversationPayload(
					ctx.db,
					link.resourceId,
				);

				if (!payload) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}

				return {
					resourceType: link.resourceType,
					...payload,
				};
			}

			throw new TRPCError({
				code: "NOT_FOUND",
				message: ERR_SHARE_RESOURCE_NOT_FOUND,
			});
		}),

	// =========================================================================
	// PUBLIC: Chart data for a shared trade (token-gated, no auth)
	// =========================================================================
	getTradeChartData: publicProcedure
		.input(
			z.object({
				token: z.string().min(1),
				mode: z.enum(["day", "extended"]),
			}),
		)
		.query(async ({ ctx, input }) => {
			const link = await resolveActiveLink(ctx.db, input.token);

			if (link.resourceType !== "trade") {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: ERR_SHARE_RESOURCE_NOT_FOUND,
				});
			}

			const trade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, link.resourceId), isNull(trades.deletedAt)),
				columns: { symbol: true, entryTime: true, exitTime: true },
			});

			if (!trade) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: ERR_SHARE_RESOURCE_NOT_FOUND,
				});
			}

			const fetchBars =
				input.mode === "day" ? getFullDayBars : getExtendedDayBars;
			const { bars, source, dataQuality } = await fetchBars(
				trade.symbol,
				trade.entryTime,
				trade.exitTime,
			);

			// Convert timestamps to lightweight-charts format (seconds, not ms)
			const chartBars = bars.map((bar) => ({
				time: Math.floor(bar.timestamp / 1000),
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
			}));

			return {
				bars: chartBars,
				source,
				dataQuality,
				barCount: chartBars.length,
			};
		}),

	// =========================================================================
	// PROTECTED: Create a share link
	// =========================================================================
	createLink: protectedProcedure
		.input(
			z.object({
				resourceType: shareResourceTypeSchema,
				resourceId: z.string().min(1),
				expiryDays: z.number().int().positive().nullish(),
				label: z.string().max(100).nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership + status
			if (input.resourceType === "report") {
				const report = await ctx.db.query.aiReports.findFirst({
					where: and(
						eq(aiReports.id, input.resourceId),
						eq(aiReports.userId, ctx.user.id),
					),
					columns: { id: true, status: true },
				});

				if (!report) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}

				if (report.status !== "complete") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: ERR_SHARE_RESOURCE_NOT_COMPLETE,
					});
				}
			}

			if (input.resourceType === "trade") {
				const trade = await ctx.db.query.trades.findFirst({
					where: and(
						eq(trades.id, input.resourceId),
						eq(trades.userId, ctx.user.id),
						isNull(trades.deletedAt),
					),
					columns: { id: true },
				});

				if (!trade) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}
			}

			if (input.resourceType === "account_analytics") {
				const account = await ctx.db.query.accounts.findFirst({
					where: and(
						eq(accounts.id, input.resourceId),
						eq(accounts.userId, ctx.user.id),
					),
					columns: { id: true },
				});

				if (!account) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}
			}

			if (input.resourceType === "conversation") {
				const conversation = await ctx.db.query.aiConversations.findFirst({
					where: and(
						eq(aiConversations.id, input.resourceId),
						eq(aiConversations.userId, ctx.user.id),
					),
					columns: { id: true },
				});

				if (!conversation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}

				// Don't mint a link for an empty conversation — the public page would
				// 404 on it anyway (getSharedConversationPayload returns null).
				const firstMessage = await ctx.db.query.aiMessages.findFirst({
					where: eq(aiMessages.conversationId, input.resourceId),
					columns: { id: true },
				});

				if (!firstMessage) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: ERR_SHARE_RESOURCE_NOT_COMPLETE,
					});
				}
			}

			// Check link limit
			const existing = await ctx.db
				.select({ count: sql<number>`count(*)::int` })
				.from(shareLinks)
				.where(
					and(
						eq(shareLinks.resourceType, input.resourceType),
						eq(shareLinks.resourceId, input.resourceId),
						eq(shareLinks.userId, ctx.user.id),
						eq(shareLinks.isActive, true),
					),
				);

			if ((existing[0]?.count ?? 0) >= MAX_SHARE_LINKS_PER_RESOURCE) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: ERR_SHARE_LINK_LIMIT_REACHED,
				});
			}

			const token = generateShareToken();
			const expiresAt = input.expiryDays
				? new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000)
				: null;

			const [link] = await ctx.db
				.insert(shareLinks)
				.values({
					userId: ctx.user.id,
					token,
					resourceType: input.resourceType,
					resourceId: input.resourceId,
					label: input.label ?? null,
					expiresAt,
				})
				.returning();

			return link ?? null;
		}),

	// =========================================================================
	// PROTECTED: Get links for a resource
	// =========================================================================
	getLinksForResource: protectedProcedure
		.input(
			z.object({
				resourceType: shareResourceTypeSchema,
				resourceId: z.string().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db.query.shareLinks.findMany({
				where: and(
					eq(shareLinks.resourceType, input.resourceType),
					eq(shareLinks.resourceId, input.resourceId),
					eq(shareLinks.userId, ctx.user.id),
				),
				orderBy: [desc(shareLinks.createdAt)],
			});
		}),

	// =========================================================================
	// PROTECTED: Revoke a link (soft disable)
	// =========================================================================
	revokeLink: protectedProcedure
		.input(z.object({ linkId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [updated] = await ctx.db
				.update(shareLinks)
				.set({ isActive: false })
				.where(
					and(
						eq(shareLinks.id, input.linkId),
						eq(shareLinks.userId, ctx.user.id),
					),
				)
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: ERR_SHARE_LINK_NOT_FOUND,
				});
			}

			return updated;
		}),

	// =========================================================================
	// PROTECTED: Delete a link (hard delete)
	// =========================================================================
	deleteLink: protectedProcedure
		.input(z.object({ linkId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [deleted] = await ctx.db
				.delete(shareLinks)
				.where(
					and(
						eq(shareLinks.id, input.linkId),
						eq(shareLinks.userId, ctx.user.id),
					),
				)
				.returning();

			if (!deleted) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: ERR_SHARE_LINK_NOT_FOUND,
				});
			}

			return { success: true };
		}),

	// =========================================================================
	// PROTECTED: List all user's share links
	// =========================================================================
	listUserLinks: protectedProcedure
		.input(z.object({ limit: z.number().int().positive().default(50) }))
		.query(async ({ ctx, input }) => {
			return ctx.db.query.shareLinks.findMany({
				where: eq(shareLinks.userId, ctx.user.id),
				orderBy: [desc(shareLinks.createdAt)],
				limit: input.limit,
			});
		}),
});
