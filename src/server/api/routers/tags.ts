import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { FEATURE_CUSTOM_TAGS } from "@/lib/constants/billing";
import {
	ERR_TAG_NAME_EXISTS,
	ERR_TAG_NOT_FOUND,
	ERR_TRADE_NOT_FOUND,
	ERR_TRADES_BULK_NOT_FOUND,
} from "@/lib/constants/errors";
import {
	createTRPCRouter,
	protectedProcedure,
	requireFeature,
} from "@/server/api/trpc";
import { tags, trades, tradeTags } from "@/server/db/schema";

export const tagsRouter = createTRPCRouter({
	// Get all tags for current user
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const userTags = await ctx.db.query.tags.findMany({
			where: eq(tags.userId, ctx.user.id),
			orderBy: [desc(tags.createdAt)],
		});
		return userTags;
	}),

	// Get tags with usage count
	getWithStats: protectedProcedure.query(async ({ ctx }) => {
		const userTags = await ctx.db.query.tags.findMany({
			where: eq(tags.userId, ctx.user.id),
			orderBy: [desc(tags.createdAt)],
			with: {
				tradeTags: true,
			},
		});

		return userTags.map((tag) => ({
			...tag,
			usageCount: tag.tradeTags.length,
		}));
	}),

	// Get a single tag by ID
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const tag = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.id, input.id), eq(tags.userId, ctx.user.id)),
				with: {
					tradeTags: {
						with: {
							trade: true,
						},
					},
				},
			});

			if (!tag) {
				throw new Error(ERR_TAG_NOT_FOUND);
			}

			return tag;
		}),

	// Create a new tag
	create: requireFeature(FEATURE_CUSTOM_TAGS)
		.input(
			z.object({
				name: z.string().min(1).max(50),
				color: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if tag with same name already exists
			const existing = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.userId, ctx.user.id), eq(tags.name, input.name)),
			});

			if (existing) {
				throw new Error(ERR_TAG_NAME_EXISTS);
			}

			const [tag] = await ctx.db
				.insert(tags)
				.values({
					userId: ctx.user.id,
					name: input.name,
					color: input.color ?? "#6366f1",
				})
				.returning();

			return tag;
		}),

	// Update a tag
	update: requireFeature(FEATURE_CUSTOM_TAGS)
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(50).optional(),
				color: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.id, input.id), eq(tags.userId, ctx.user.id)),
			});

			if (!existing) {
				throw new Error(ERR_TAG_NOT_FOUND);
			}

			// Check if new name conflicts with another tag
			if (input.name && input.name !== existing.name) {
				const nameConflict = await ctx.db.query.tags.findFirst({
					where: and(eq(tags.userId, ctx.user.id), eq(tags.name, input.name)),
				});
				if (nameConflict) {
					throw new Error(ERR_TAG_NAME_EXISTS);
				}
			}

			const [updated] = await ctx.db
				.update(tags)
				.set({
					name: input.name ?? existing.name,
					color: input.color ?? existing.color,
				})
				.where(eq(tags.id, input.id))
				.returning();

			return updated;
		}),

	// Delete a tag
	// Ungated: users must be able to delete their own tags even after downgrading
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.id, input.id), eq(tags.userId, ctx.user.id)),
			});

			if (!existing) {
				throw new Error(ERR_TAG_NOT_FOUND);
			}

			// This will also delete from trade_tags due to cascade
			await ctx.db.delete(tags).where(eq(tags.id, input.id));

			return { success: true };
		}),

	// Add tag to trade
	addToTrade: requireFeature(FEATURE_CUSTOM_TAGS)
		.input(
			z.object({
				tradeId: z.string(),
				tagId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify trade ownership
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			// Verify tag ownership
			const tag = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.id, input.tagId), eq(tags.userId, ctx.user.id)),
			});

			if (!tag) {
				throw new Error(ERR_TAG_NOT_FOUND);
			}

			// Check if already exists
			const existing = await ctx.db.query.tradeTags.findFirst({
				where: and(
					eq(tradeTags.tradeId, input.tradeId),
					eq(tradeTags.tagId, input.tagId),
				),
			});

			if (existing) {
				return { success: true, alreadyExists: true };
			}

			await ctx.db.insert(tradeTags).values({
				tradeId: input.tradeId,
				tagId: input.tagId,
			});

			return { success: true, alreadyExists: false };
		}),

	// Remove tag from trade
	// Ungated: users must be able to detach tags from owned trades even after downgrading
	removeFromTrade: protectedProcedure
		.input(
			z.object({
				tradeId: z.string(),
				tagId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify trade ownership
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			await ctx.db
				.delete(tradeTags)
				.where(
					and(
						eq(tradeTags.tradeId, input.tradeId),
						eq(tradeTags.tagId, input.tagId),
					),
				);

			return { success: true };
		}),

	// Bulk add tag to multiple trades
	bulkAddToTrades: requireFeature(FEATURE_CUSTOM_TAGS)
		.input(
			z.object({
				tradeIds: z.array(z.string()).min(1).max(100),
				tagId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify tag ownership
			const tag = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.id, input.tagId), eq(tags.userId, ctx.user.id)),
			});

			if (!tag) {
				throw new Error(ERR_TAG_NOT_FOUND);
			}

			// Verify all trades belong to user
			const userTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					sql`${trades.id} IN (${sql.join(
						input.tradeIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			});

			if (userTrades.length !== input.tradeIds.length) {
				throw new Error(ERR_TRADES_BULK_NOT_FOUND);
			}

			// Get existing trade-tag relationships
			const existingRelations = await ctx.db.query.tradeTags.findMany({
				where: and(
					eq(tradeTags.tagId, input.tagId),
					sql`${tradeTags.tradeId} IN (${sql.join(
						input.tradeIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			});

			const existingTradeIds = new Set(existingRelations.map((r) => r.tradeId));
			const newTradeIds = input.tradeIds.filter(
				(id) => !existingTradeIds.has(id),
			);

			if (newTradeIds.length > 0) {
				await ctx.db.insert(tradeTags).values(
					newTradeIds.map((tradeId) => ({
						tradeId,
						tagId: input.tagId,
					})),
				);
			}

			return { success: true, added: newTradeIds.length };
		}),

	// Bulk remove tag from multiple trades
	// Ungated: users must be able to detach tags from owned trades even after downgrading (matches removeFromTrade policy)
	bulkRemoveFromTrades: protectedProcedure
		.input(
			z.object({
				tradeIds: z.array(z.string()).min(1).max(100),
				tagId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify tag ownership
			const tag = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.id, input.tagId), eq(tags.userId, ctx.user.id)),
			});

			if (!tag) {
				throw new Error(ERR_TAG_NOT_FOUND);
			}

			await ctx.db.delete(tradeTags).where(
				and(
					eq(tradeTags.tagId, input.tagId),
					sql`${tradeTags.tradeId} IN (${sql.join(
						input.tradeIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			);

			return { success: true };
		}),

	// Get trades by tag
	getTradesByTag: protectedProcedure
		.input(z.object({ tagId: z.string() }))
		.query(async ({ ctx, input }) => {
			const tag = await ctx.db.query.tags.findFirst({
				where: and(eq(tags.id, input.tagId), eq(tags.userId, ctx.user.id)),
				with: {
					tradeTags: {
						with: {
							trade: true,
						},
					},
				},
			});

			if (!tag) {
				throw new Error(ERR_TAG_NOT_FOUND);
			}

			return tag.tradeTags.map((tt) => tt.trade);
		}),
});
