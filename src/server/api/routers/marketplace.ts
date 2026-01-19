import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
	MARKETPLACE_PAGE_SIZE,
	MARKETPLACE_SORT_OPTIONS,
	MAX_VOTES_PER_HOUR,
	STRATEGY_REPORT_REASONS,
} from "@/lib/constants";
import { checkVoteRateLimit } from "@/lib/rate-limit";
import { getTrackRecordStatus, parseCachedStats } from "@/lib/shared";
import { getCoverImageUrl } from "@/server/api/helpers";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";
import {
	strategies,
	strategyDownloads,
	strategyReports,
	strategyRules,
	strategyVotes,
	users,
} from "@/server/db/schema";

// =============================================================================
// TYPES
// =============================================================================

/** Creator info returned for marketplace strategies */
interface CreatorInfo {
	id: string;
	name: string | null;
	imageUrl: string | null;
}

/**
 * Compute the total vote score for a strategy
 * @returns The net score (sum of all votes: +1 or -1)
 */
async function computeVoteScore(
	db: Parameters<
		Parameters<typeof protectedProcedure.mutation>[0]
	>[0]["ctx"]["db"],
	strategyId: string,
): Promise<number> {
	const result = await db
		.select({
			score: sql<number>`COALESCE(SUM(${strategyVotes.vote}), 0)`.as("score"),
		})
		.from(strategyVotes)
		.where(eq(strategyVotes.strategyId, strategyId));

	return result[0]?.score ?? 0;
}

// =============================================================================
// ROUTER
// =============================================================================

export const marketplaceRouter = createTRPCRouter({
	/**
	 * List public strategies in the marketplace
	 * No auth required, auth optional for hasVoted status
	 */
	list: publicProcedure
		.input(
			z.object({
				cursor: z.string().nullish(),
				limit: z.number().min(1).max(100).default(MARKETPLACE_PAGE_SIZE),
				search: z.string().nullish(),
				instruments: z.array(z.string()).nullish(),
				categories: z.array(z.string()).nullish(),
				sort: z.enum(MARKETPLACE_SORT_OPTIONS).default("votes"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { cursor, limit, search, instruments, categories, sort } = input;

			// Build where conditions
			const conditions = [eq(strategies.isPublic, true)];

			// Search in name and description
			if (search?.trim()) {
				const searchTerm = `%${search.trim()}%`;
				conditions.push(
					or(
						ilike(strategies.name, searchTerm),
						ilike(strategies.description, searchTerm),
					) ?? sql`true`,
				);
			}

			// Filter by instruments (array overlap)
			if (instruments && instruments.length > 0) {
				// Check if strategy instruments array contains any of the requested instruments
				conditions.push(
					sql`${strategies.instruments} && ARRAY[${sql.join(
						instruments.map((i) => sql`${i}`),
						sql`, `,
					)}]::text[]`,
				);
			}

			// Filter by categories (array overlap)
			if (categories && categories.length > 0) {
				conditions.push(
					sql`${strategies.categoryTags} && ARRAY[${sql.join(
						categories.map((c) => sql`${c}`),
						sql`, `,
					)}]::text[]`,
				);
			}

			// Cursor-based pagination: fetch items after cursor ID
			// We use the strategy ID as cursor for simplicity
			if (cursor) {
				// For proper cursor pagination with different sorts, we'd need to encode the sort value
				// For simplicity, we filter by ID being greater than cursor for 'recent' sort
				// For votes/downloads, we use a subquery to get the score of cursor item
				if (sort === "recent") {
					const cursorStrategy = await ctx.db.query.strategies.findFirst({
						where: eq(strategies.id, cursor),
						columns: { createdAt: true },
					});
					if (cursorStrategy) {
						conditions.push(
							or(
								sql`${strategies.createdAt} < ${cursorStrategy.createdAt}`,
								and(
									eq(strategies.createdAt, cursorStrategy.createdAt),
									sql`${strategies.id} > ${cursor}`,
								),
							) ?? sql`true`,
						);
					}
				}
				// For votes and downloads, cursor logic is handled after sorting
			}

			// Get strategies with user info
			const strategyResults = await ctx.db
				.select({
					strategy: strategies,
					creator: {
						id: users.id,
						name: users.name,
						imageUrl: users.imageUrl,
					},
				})
				.from(strategies)
				.leftJoin(users, eq(strategies.userId, users.id))
				.where(and(...conditions))
				.orderBy(desc(strategies.createdAt))
				.limit(limit + 1); // Fetch one extra to detect if there are more

			// Get vote scores for all strategies
			const strategyIds = strategyResults.map((r) => r.strategy.id);

			const voteScores =
				strategyIds.length > 0
					? await ctx.db
							.select({
								strategyId: strategyVotes.strategyId,
								score: sql<number>`COALESCE(SUM(${strategyVotes.vote}), 0)`.as(
									"score",
								),
							})
							.from(strategyVotes)
							.where(inArray(strategyVotes.strategyId, strategyIds))
							.groupBy(strategyVotes.strategyId)
					: [];

			// Get download counts for all strategies
			const downloadCounts =
				strategyIds.length > 0
					? await ctx.db
							.select({
								strategyId: strategyDownloads.originalStrategyId,
								count:
									sql<number>`COALESCE(COUNT(${strategyDownloads.id}), 0)`.as(
										"count",
									),
							})
							.from(strategyDownloads)
							.where(inArray(strategyDownloads.originalStrategyId, strategyIds))
							.groupBy(strategyDownloads.originalStrategyId)
					: [];

			// Get current user's votes if authenticated
			let userVotes: Array<{ strategyId: string; vote: number }> = [];
			let currentUserId: string | null = null;
			if (ctx.userId && strategyIds.length > 0) {
				// Need to get user from DB to get internal ID
				const user = await ctx.db.query.users.findFirst({
					where: eq(users.clerkId, ctx.userId),
					columns: { id: true },
				});

				if (user) {
					currentUserId = user.id;
					userVotes = await ctx.db
						.select({
							strategyId: strategyVotes.strategyId,
							vote: strategyVotes.vote,
						})
						.from(strategyVotes)
						.where(
							and(
								inArray(strategyVotes.strategyId, strategyIds),
								eq(strategyVotes.userId, user.id),
							),
						);
				}
			}

			// Build lookup maps
			const voteScoreMap = new Map(
				voteScores.map((v) => [v.strategyId, v.score]),
			);
			const downloadCountMap = new Map(
				downloadCounts.map((d) => [d.strategyId, d.count]),
			);
			const userVoteMap = new Map(userVotes.map((v) => [v.strategyId, v.vote]));

			// Transform results
			const transformedResults = strategyResults.map((result) => {
				const { strategy, creator } = result;
				const cachedStats = parseCachedStats(strategy.cachedStats);
				const voteScore = voteScoreMap.get(strategy.id) ?? 0;
				const downloadCount = downloadCountMap.get(strategy.id) ?? 0;
				const userVote = userVoteMap.get(strategy.id) ?? null;
				const trackRecordStatus = getTrackRecordStatus(
					cachedStats?.totalTrades ?? 0,
				);

				// Respect isAnonymous flag for creator info
				const creatorInfo: CreatorInfo | null = strategy.isAnonymous
					? null
					: creator;

				return {
					id: strategy.id,
					name: strategy.name,
					description: strategy.description,
					color: strategy.color,
					coverImageUrl: getCoverImageUrl(strategy.coverImageKey),
					instruments: strategy.instruments,
					categoryTags: strategy.categoryTags,
					createdAt: strategy.createdAt,
					updatedAt: strategy.updatedAt,

					// Creator info
					creator: creatorInfo,

					// Stats
					stats: cachedStats,
					trackRecordStatus,

					// Engagement
					engagement: {
						voteScore,
						downloadCount,
					},

					// User interaction
					hasVoted: userVote,
				};
			});

			// Sort results based on sort parameter
			let sortedResults = transformedResults;
			if (sort === "votes") {
				sortedResults = [...transformedResults].sort(
					(a, b) => b.engagement.voteScore - a.engagement.voteScore,
				);
			} else if (sort === "downloads") {
				sortedResults = [...transformedResults].sort(
					(a, b) => b.engagement.downloadCount - a.engagement.downloadCount,
				);
			}
			// 'recent' is already sorted by createdAt desc from query

			// Apply cursor filter for votes/downloads (after sorting)
			let filteredResults = sortedResults;
			if (cursor && sort !== "recent") {
				const cursorIndex = sortedResults.findIndex((s) => s.id === cursor);
				if (cursorIndex !== -1) {
					filteredResults = sortedResults.slice(cursorIndex + 1);
				}
			}

			// Check if there are more results
			const hasMore = filteredResults.length > limit;
			const items = filteredResults.slice(0, limit);

			// Get next cursor
			const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

			return {
				items,
				nextCursor,
				currentUserId,
			};
		}),

	/**
	 * Get a public strategy by ID with full details
	 * No auth required, auth optional for vote status
	 */
	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			// Fetch the strategy with rules relation
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(eq(strategies.id, input.id), eq(strategies.isPublic, true)),
				with: {
					rules: {
						orderBy: [strategyRules.order],
					},
				},
			});

			if (!strategy) {
				throw new Error("Strategy not found or is not public");
			}

			// Get creator info
			const creator = await ctx.db.query.users.findFirst({
				where: eq(users.id, strategy.userId),
				columns: {
					id: true,
					name: true,
					imageUrl: true,
				},
			});

			// Get vote score
			const voteScore = await computeVoteScore(ctx.db, strategy.id);

			// Get download count
			const downloadCountResult = await ctx.db
				.select({
					count: sql<number>`COALESCE(COUNT(${strategyDownloads.id}), 0)`.as(
						"count",
					),
				})
				.from(strategyDownloads)
				.where(eq(strategyDownloads.originalStrategyId, strategy.id));
			const downloadCount = downloadCountResult[0]?.count ?? 0;

			// Get current user's vote and ID if authenticated
			let userVote: number | null = null;
			let currentUserId: string | null = null;
			if (ctx.userId) {
				const user = await ctx.db.query.users.findFirst({
					where: eq(users.clerkId, ctx.userId),
					columns: { id: true },
				});

				if (user) {
					currentUserId = user.id;
					const vote = await ctx.db.query.strategyVotes.findFirst({
						where: and(
							eq(strategyVotes.strategyId, strategy.id),
							eq(strategyVotes.userId, user.id),
						),
						columns: { vote: true },
					});
					userVote = vote?.vote ?? null;
				}
			}

			// Parse cached stats
			const cachedStats = parseCachedStats(strategy.cachedStats);
			const trackRecordStatus = getTrackRecordStatus(
				cachedStats?.totalTrades ?? 0,
			);

			// Respect isAnonymous flag for creator info
			const creatorInfo: CreatorInfo | null = strategy.isAnonymous
				? null
				: (creator ?? null);

			return {
				id: strategy.id,
				name: strategy.name,
				description: strategy.description,
				color: strategy.color,
				coverImageUrl: getCoverImageUrl(strategy.coverImageKey),
				instruments: strategy.instruments,
				categoryTags: strategy.categoryTags,
				createdAt: strategy.createdAt,
				updatedAt: strategy.updatedAt,

				// Strategy rules (entry, exit, risk, management)
				entryCriteria: strategy.entryCriteria,
				exitRules: strategy.exitRules,
				rules: strategy.rules,

				// Parsed JSON fields
				riskParameters: strategy.riskParameters
					? JSON.parse(strategy.riskParameters)
					: null,
				scalingRules: strategy.scalingRules
					? JSON.parse(strategy.scalingRules)
					: null,
				trailingRules: strategy.trailingRules
					? JSON.parse(strategy.trailingRules)
					: null,

				// Creator info
				creator: creatorInfo,

				// Stats
				stats: cachedStats,
				trackRecordStatus,

				// Engagement
				engagement: {
					voteScore,
					downloadCount,
				},

				// User interaction
				hasVoted: userVote,

				// Current user ID for ownership check
				currentUserId,
			};
		}),

	/**
	 * Vote on a public strategy (upvote or downvote)
	 * Uses upsert pattern - replaces existing vote if any
	 * Rate limited: Max 20 votes per user per hour
	 */
	vote: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				vote: z.union([z.literal(1), z.literal(-1)]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId, vote } = input;

			// Check rate limit
			const rateLimitResult = await checkVoteRateLimit(ctx.user.id);
			if (!rateLimitResult.success) {
				throw new Error(
					`Rate limit exceeded. You can only vote ${MAX_VOTES_PER_HOUR} times per hour.`,
				);
			}

			// Verify strategy exists and is public
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.isPublic, true),
				),
				columns: { id: true, userId: true },
			});

			if (!strategy) {
				throw new Error("Strategy not found or is not public");
			}

			// Cannot vote on own strategy
			if (strategy.userId === ctx.user.id) {
				throw new Error("Cannot vote on your own strategy");
			}

			// Upsert the vote (insert or update if exists)
			await ctx.db
				.insert(strategyVotes)
				.values({
					strategyId,
					userId: ctx.user.id,
					vote,
				})
				.onConflictDoUpdate({
					target: [strategyVotes.strategyId, strategyVotes.userId],
					set: {
						vote,
						updatedAt: new Date(),
					},
				});

			// Compute and return new vote score
			const newScore = await computeVoteScore(ctx.db, strategyId);

			return {
				voteScore: newScore,
			};
		}),

	/**
	 * Remove vote from a strategy
	 * Returns the new vote score after removal
	 */
	removeVote: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId } = input;

			// Verify strategy exists and is public
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.isPublic, true),
				),
				columns: { id: true },
			});

			if (!strategy) {
				throw new Error("Strategy not found or is not public");
			}

			// Delete the vote
			await ctx.db
				.delete(strategyVotes)
				.where(
					and(
						eq(strategyVotes.strategyId, strategyId),
						eq(strategyVotes.userId, ctx.user.id),
					),
				);

			// Compute and return new vote score
			const newScore = await computeVoteScore(ctx.db, strategyId);

			return {
				voteScore: newScore,
			};
		}),

	/**
	 * Download/copy a public strategy to user's account
	 * Creates a new strategy as a copy with source reference
	 */
	download: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId } = input;

			// Get the original strategy (must be public)
			const originalStrategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.isPublic, true),
				),
			});

			if (!originalStrategy) {
				throw new Error("Strategy not found or is not public");
			}

			// Cannot download own strategy
			if (originalStrategy.userId === ctx.user.id) {
				throw new Error("Cannot download your own strategy");
			}

			// Check if user has already downloaded this strategy
			const existingDownload = await ctx.db.query.strategyDownloads.findFirst({
				where: and(
					eq(strategyDownloads.originalStrategyId, strategyId),
					eq(strategyDownloads.userId, ctx.user.id),
				),
				columns: { id: true },
			});

			if (existingDownload) {
				throw new Error("You have already downloaded this strategy");
			}

			// Create the copied strategy
			// Copy: name (with Copy suffix), description, color, coverImageUrl (but NOT coverImageKey),
			// entryCriteria, exitRules, riskParameters, scalingRules, trailingRules, strategyRules
			const [copiedStrategy] = await ctx.db
				.insert(strategies)
				.values({
					userId: ctx.user.id,
					name: `${originalStrategy.name} (Copy)`,
					description: originalStrategy.description,
					color: originalStrategy.color,
					coverImageUrl: originalStrategy.coverImageUrl, // Keep public URL for display
					// Do NOT copy coverImageKey - user doesn't own that S3 object
					entryCriteria: originalStrategy.entryCriteria,
					exitRules: originalStrategy.exitRules,
					riskParameters: originalStrategy.riskParameters,
					scalingRules: originalStrategy.scalingRules,
					trailingRules: originalStrategy.trailingRules,
					sourceStrategyId: originalStrategy.id, // Link to original
					isActive: true,
					isPublic: false, // Copied strategy starts as private
				})
				.returning();

			if (!copiedStrategy) {
				throw new Error("Failed to create copied strategy");
			}

			// Create strategyDownload record linking original to copy
			await ctx.db.insert(strategyDownloads).values({
				originalStrategyId: originalStrategy.id,
				copiedStrategyId: copiedStrategy.id,
				userId: ctx.user.id,
			});

			// Return the copied strategy with parsed JSON fields
			return {
				...copiedStrategy,
				riskParameters: copiedStrategy.riskParameters
					? JSON.parse(copiedStrategy.riskParameters)
					: null,
				scalingRules: copiedStrategy.scalingRules
					? JSON.parse(copiedStrategy.scalingRules)
					: null,
				trailingRules: copiedStrategy.trailingRules
					? JSON.parse(copiedStrategy.trailingRules)
					: null,
			};
		}),

	/**
	 * Report a strategy for inappropriate or misleading content
	 * One report per user per strategy (unique constraint)
	 */
	report: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				reason: z.enum(STRATEGY_REPORT_REASONS),
				details: z.string().max(1000).nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId, reason, details } = input;

			// Verify strategy exists and is public
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.isPublic, true),
				),
				columns: { id: true, userId: true },
			});

			if (!strategy) {
				throw new Error("Strategy not found or is not public");
			}

			// Cannot report own strategy
			if (strategy.userId === ctx.user.id) {
				throw new Error("Cannot report your own strategy");
			}

			// Check if user has already reported this strategy
			const existingReport = await ctx.db.query.strategyReports.findFirst({
				where: and(
					eq(strategyReports.strategyId, strategyId),
					eq(strategyReports.reporterId, ctx.user.id),
				),
				columns: { id: true },
			});

			if (existingReport) {
				throw new Error("You have already reported this strategy");
			}

			// Create the report with status pending
			await ctx.db.insert(strategyReports).values({
				strategyId,
				reporterId: ctx.user.id,
				reason,
				details: details ?? null,
				status: "pending",
			});

			return {
				success: true,
			};
		}),
});
