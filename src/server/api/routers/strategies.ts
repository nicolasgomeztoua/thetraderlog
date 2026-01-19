import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { calculateAggregateStats } from "@/lib/analytics";
import { MIN_TRADES_TO_PUBLISH } from "@/lib/constants";
import {
	deleteObject,
	getPresignedUploadUrl,
	getS3Bucket,
	isS3Configured,
} from "@/lib/storage/s3";
import {
	getCoverImageUrl,
	getUserBreakevenThreshold,
} from "@/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	strategies,
	strategyDownloads,
	strategyRules,
	strategyVotes,
	tradeRuleChecks,
	trades,
} from "@/server/db/schema";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Allowed image mime types for strategy cover images */
const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
] as const;

/** Maximum file size for cover images (5MB) */
const MAX_COVER_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * Construct the stored URL for an S3 object (used when saving to DB after upload).
 * Note: This URL may not be publicly accessible - use getCoverImageUrl() for display.
 */
function getPublicUrl(key: string): string {
	// Use custom domain if configured
	if (env.S3_PUBLIC_URL) {
		return `${env.S3_PUBLIC_URL}/${key}`;
	}

	// Fall back to endpoint + bucket format
	const bucket = getS3Bucket();
	const endpoint = env.S3_ENDPOINT ?? "";
	const cleanEndpoint = endpoint.replace(/\/$/, "");
	return `${cleanEndpoint}/${bucket}/${key}`;
}

/**
 * Extract file extension from filename or mime type
 */
function getFileExtension(filename: string, mimeType: string): string {
	// Try to get extension from filename
	const dotIndex = filename.lastIndexOf(".");
	if (dotIndex > 0) {
		return filename.substring(dotIndex + 1).toLowerCase();
	}

	// Fall back to mime type
	const mimeExtensions: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
		"image/gif": "gif",
	};

	return mimeExtensions[mimeType] ?? "jpg";
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

const riskParametersSchema = z.object({
	positionSizing: z
		.object({
			method: z.enum(["fixed", "risk_percent", "kelly"]),
			fixedSize: z.number().optional(),
			riskPercent: z.number().optional(),
			kellyFraction: z.number().optional(),
		})
		.optional(),
	maxRiskPerTrade: z
		.object({
			type: z.enum(["dollars", "percent"]),
			value: z.number(),
		})
		.optional(),
	dailyLossLimit: z
		.object({
			type: z.enum(["dollars", "percent"]),
			value: z.number(),
		})
		.optional(),
	maxConcurrentPositions: z.number().optional(),
	minRRRatio: z.number().optional(),
	targetRMultiples: z.array(z.number()).optional(),
});

const scalingRulesSchema = z.object({
	scaleIn: z
		.array(
			z.object({
				trigger: z.string(),
				sizePercent: z.number(),
			}),
		)
		.optional(),
	scaleOut: z
		.array(
			z.object({
				trigger: z.string(),
				sizePercent: z.number(),
			}),
		)
		.optional(),
});

const trailingRulesSchema = z.object({
	moveToBreakeven: z
		.object({
			triggerR: z.number(),
			offsetTicks: z.number().optional(),
		})
		.optional(),
	trailStops: z
		.array(
			z.object({
				triggerR: z.number(),
				method: z.enum(["fixed_ticks", "atr_multiple", "swing_low"]),
				value: z.number(),
			}),
		)
		.optional(),
});

const strategyRuleSchema = z.object({
	id: z.string().optional(), // Optional for new rules
	text: z.string().min(1),
	category: z.enum(["entry", "exit", "risk", "management"]),
	order: z.number(),
});

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const createStrategySchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	color: z.string().optional(),
	entryCriteria: z.string().optional(),
	exitRules: z.string().optional(),
	riskParameters: riskParametersSchema.optional(),
	scalingRules: scalingRulesSchema.optional(),
	trailingRules: trailingRulesSchema.optional(),
	isActive: z.boolean().optional(),
	rules: z.array(strategyRuleSchema).optional(),
});

const updateStrategySchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().nullish(),
	color: z.string().optional(),
	coverImageUrl: z.string().nullish(),
	coverImageKey: z.string().nullish(),
	entryCriteria: z.string().nullish(),
	exitRules: z.string().nullish(),
	riskParameters: riskParametersSchema.nullish(),
	scalingRules: scalingRulesSchema.nullish(),
	trailingRules: trailingRulesSchema.nullish(),
	isActive: z.boolean().optional(),
	rules: z.array(strategyRuleSchema).optional(),
});

// Auto-save uses the same fields as update but only for silent saves
const autosaveStrategySchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().nullish(),
	color: z.string().optional(),
	coverImageUrl: z.string().nullish(),
	coverImageKey: z.string().nullish(),
	entryCriteria: z.string().nullish(),
	exitRules: z.string().nullish(),
	riskParameters: riskParametersSchema.nullish(),
	scalingRules: scalingRulesSchema.nullish(),
	trailingRules: trailingRulesSchema.nullish(),
	isActive: z.boolean().optional(),
	rules: z.array(strategyRuleSchema).optional(),
	instruments: z.array(z.string()).nullish(),
	categoryTags: z.array(z.string()).nullish(),
});

// =============================================================================
// ROUTER
// =============================================================================

export const strategiesRouter = createTRPCRouter({
	// Get all strategies for current user
	getAll: protectedProcedure
		.input(
			z
				.object({
					includeInactive: z.boolean().optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [eq(strategies.userId, ctx.user.id)];

			if (!input?.includeInactive) {
				conditions.push(eq(strategies.isActive, true));
			}

			const results = await ctx.db.query.strategies.findMany({
				where: and(...conditions),
				orderBy: [desc(strategies.createdAt)],
				with: {
					rules: {
						orderBy: [strategyRules.order],
					},
				},
			});

			// Get trade counts and stats for each strategy
			const strategiesWithStats = await Promise.all(
				results.map(async (strategy) => {
					// Get trade count for this strategy
					const tradeCountResult = await ctx.db
						.select({ count: sql<number>`count(*)` })
						.from(trades)
						.where(
							and(
								eq(trades.strategyId, strategy.id),
								eq(trades.userId, ctx.user.id),
								isNull(trades.deletedAt),
							),
						);

					const tradeCount = tradeCountResult[0]?.count ?? 0;

					// For public strategies, get engagement data (votes and downloads)
					let engagement: { voteScore: number; downloadCount: number } | null =
						null;
					if (strategy.isPublic) {
						// Get vote score
						const voteResult = await ctx.db
							.select({
								score: sql<number>`COALESCE(SUM(${strategyVotes.vote}), 0)`,
							})
							.from(strategyVotes)
							.where(eq(strategyVotes.strategyId, strategy.id));

						// Get download count
						const downloadResult = await ctx.db
							.select({ count: sql<number>`count(*)` })
							.from(strategyDownloads)
							.where(eq(strategyDownloads.originalStrategyId, strategy.id));

						engagement = {
							voteScore: voteResult[0]?.score ?? 0,
							downloadCount: downloadResult[0]?.count ?? 0,
						};
					}

					return {
						...strategy,
						riskParameters: strategy.riskParameters
							? JSON.parse(strategy.riskParameters)
							: null,
						scalingRules: strategy.scalingRules
							? JSON.parse(strategy.scalingRules)
							: null,
						trailingRules: strategy.trailingRules
							? JSON.parse(strategy.trailingRules)
							: null,
						engagement,
						_count: {
							rules: strategy.rules.length,
							trades: tradeCount,
						},
					};
				}),
			);

			return strategiesWithStats;
		}),

	// Get a single strategy by ID
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.id),
					eq(strategies.userId, ctx.user.id),
				),
				with: {
					rules: {
						orderBy: [strategyRules.order],
					},
				},
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			return {
				...strategy,
				coverImageUrl: getCoverImageUrl(strategy.coverImageKey),
				riskParameters: strategy.riskParameters
					? JSON.parse(strategy.riskParameters)
					: null,
				scalingRules: strategy.scalingRules
					? JSON.parse(strategy.scalingRules)
					: null,
				trailingRules: strategy.trailingRules
					? JSON.parse(strategy.trailingRules)
					: null,
			};
		}),

	// Create a new strategy
	create: protectedProcedure
		.input(createStrategySchema)
		.mutation(async ({ ctx, input }) => {
			const { rules, riskParameters, scalingRules, trailingRules, ...data } =
				input;

			const [newStrategy] = await ctx.db
				.insert(strategies)
				.values({
					...data,
					userId: ctx.user.id,
					riskParameters: riskParameters
						? JSON.stringify(riskParameters)
						: null,
					scalingRules: scalingRules ? JSON.stringify(scalingRules) : null,
					trailingRules: trailingRules ? JSON.stringify(trailingRules) : null,
				})
				.returning();

			if (!newStrategy) {
				throw new Error("Failed to create strategy");
			}

			// Create rules if provided
			if (rules && rules.length > 0) {
				await ctx.db.insert(strategyRules).values(
					rules.map((rule) => ({
						strategyId: newStrategy.id,
						text: rule.text,
						category: rule.category,
						order: rule.order,
					})),
				);
			}

			return newStrategy;
		}),

	// Update a strategy
	update: protectedProcedure
		.input(updateStrategySchema)
		.mutation(async ({ ctx, input }) => {
			const {
				id,
				rules,
				riskParameters,
				scalingRules,
				trailingRules,
				coverImageKey,
				...data
			} = input;

			// Verify ownership
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(eq(strategies.id, id), eq(strategies.userId, ctx.user.id)),
			});

			if (!existingStrategy) {
				throw new Error("Strategy not found");
			}

			// Check if cover image key is changing and old key exists - delete old S3 object
			const oldCoverImageKey = existingStrategy.coverImageKey;
			if (
				coverImageKey !== undefined &&
				oldCoverImageKey &&
				oldCoverImageKey !== coverImageKey &&
				isS3Configured()
			) {
				try {
					await deleteObject(oldCoverImageKey);
				} catch {
					// Log but don't fail the update if S3 delete fails
					console.error(
						`Failed to delete old cover image: ${oldCoverImageKey}`,
					);
				}
			}

			// Prepare update data
			const updateData: Record<string, unknown> = { ...data };

			// Handle cover image key explicitly since we extracted it
			if (coverImageKey !== undefined) {
				updateData.coverImageKey = coverImageKey;
			}

			if (riskParameters !== undefined) {
				updateData.riskParameters = riskParameters
					? JSON.stringify(riskParameters)
					: null;
			}
			if (scalingRules !== undefined) {
				updateData.scalingRules = scalingRules
					? JSON.stringify(scalingRules)
					: null;
			}
			if (trailingRules !== undefined) {
				updateData.trailingRules = trailingRules
					? JSON.stringify(trailingRules)
					: null;
			}

			const [updated] = await ctx.db
				.update(strategies)
				.set(updateData)
				.where(eq(strategies.id, id))
				.returning();

			// Update rules if provided
			if (rules !== undefined) {
				// Delete existing rules
				await ctx.db
					.delete(strategyRules)
					.where(eq(strategyRules.strategyId, id));

				// Insert new rules
				if (rules.length > 0) {
					await ctx.db.insert(strategyRules).values(
						rules.map((rule) => ({
							strategyId: id,
							text: rule.text,
							category: rule.category,
							order: rule.order,
						})),
					);
				}
			}

			return updated;
		}),

	// Auto-save a strategy (silent save without cache invalidation)
	autosave: protectedProcedure
		.input(autosaveStrategySchema)
		.mutation(async ({ ctx, input }) => {
			const {
				id,
				rules,
				riskParameters,
				scalingRules,
				trailingRules,
				coverImageKey,
				instruments,
				categoryTags,
				...data
			} = input;

			// Verify ownership
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(eq(strategies.id, id), eq(strategies.userId, ctx.user.id)),
				columns: { id: true, coverImageKey: true },
			});

			if (!existingStrategy) {
				throw new Error("Strategy not found");
			}

			// Check if cover image key is changing and old key exists - delete old S3 object
			const oldCoverImageKey = existingStrategy.coverImageKey;
			if (
				coverImageKey !== undefined &&
				oldCoverImageKey &&
				oldCoverImageKey !== coverImageKey &&
				isS3Configured()
			) {
				try {
					await deleteObject(oldCoverImageKey);
				} catch {
					// Log but don't fail the update if S3 delete fails
					console.error(
						`Failed to delete old cover image: ${oldCoverImageKey}`,
					);
				}
			}

			// Prepare update data
			const updateData: Record<string, unknown> = { ...data };

			// Handle cover image key explicitly since we extracted it
			if (coverImageKey !== undefined) {
				updateData.coverImageKey = coverImageKey;
			}

			// Handle instruments array
			if (instruments !== undefined) {
				updateData.instruments = instruments;
			}

			// Handle category tags array
			if (categoryTags !== undefined) {
				updateData.categoryTags = categoryTags;
			}

			if (riskParameters !== undefined) {
				updateData.riskParameters = riskParameters
					? JSON.stringify(riskParameters)
					: null;
			}
			if (scalingRules !== undefined) {
				updateData.scalingRules = scalingRules
					? JSON.stringify(scalingRules)
					: null;
			}
			if (trailingRules !== undefined) {
				updateData.trailingRules = trailingRules
					? JSON.stringify(trailingRules)
					: null;
			}

			const [updated] = await ctx.db
				.update(strategies)
				.set(updateData)
				.where(eq(strategies.id, id))
				.returning({ updatedAt: strategies.updatedAt });

			// Update rules if provided (same logic as regular update)
			if (rules !== undefined) {
				// Delete existing rules
				await ctx.db
					.delete(strategyRules)
					.where(eq(strategyRules.strategyId, id));

				// Insert new rules
				if (rules.length > 0) {
					await ctx.db.insert(strategyRules).values(
						rules.map((rule) => ({
							strategyId: id,
							text: rule.text,
							category: rule.category,
							order: rule.order,
						})),
					);
				}
			}

			// Return only the updatedAt timestamp for UI confirmation
			// This is a "silent save" - no cache invalidation needed
			return { updatedAt: updated?.updatedAt ?? new Date() };
		}),

	// Delete a strategy (soft delete by setting inactive)
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.id),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!existingStrategy) {
				throw new Error("Strategy not found");
			}

			// Hard delete the strategy and cascade to rules
			await ctx.db.delete(strategies).where(eq(strategies.id, input.id));

			// Also remove strategy association from trades
			await ctx.db
				.update(trades)
				.set({ strategyId: null })
				.where(
					and(eq(trades.strategyId, input.id), eq(trades.userId, ctx.user.id)),
				);

			return { success: true };
		}),

	// Duplicate a strategy
	duplicate: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const original = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.id),
					eq(strategies.userId, ctx.user.id),
				),
				with: {
					rules: true,
				},
			});

			if (!original) {
				throw new Error("Strategy not found");
			}

			// Create new strategy
			const [newStrategy] = await ctx.db
				.insert(strategies)
				.values({
					userId: ctx.user.id,
					name: `${original.name} (Copy)`,
					description: original.description,
					color: original.color,
					entryCriteria: original.entryCriteria,
					exitRules: original.exitRules,
					riskParameters: original.riskParameters,
					scalingRules: original.scalingRules,
					trailingRules: original.trailingRules,
					isActive: true,
				})
				.returning();

			if (!newStrategy) {
				throw new Error("Failed to duplicate strategy");
			}

			// Duplicate rules
			if (original.rules.length > 0) {
				await ctx.db.insert(strategyRules).values(
					original.rules.map((rule) => ({
						strategyId: newStrategy.id,
						text: rule.text,
						category: rule.category,
						order: rule.order,
					})),
				);
			}

			return newStrategy;
		}),

	// Get strategy statistics
	getStats: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify ownership
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.id),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Get user's breakeven threshold
			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);

			// Get all closed trades for this strategy
			const strategyTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.strategyId, input.id),
					eq(trades.userId, ctx.user.id),
					eq(trades.status, "closed"),
					isNull(trades.deletedAt),
				),
			});

			// Use shared stats calculator
			const stats = calculateAggregateStats(strategyTrades, beThreshold);

			return {
				totalTrades: stats.totalTrades,
				wins: stats.wins,
				losses: stats.losses,
				breakevens: stats.breakevens,
				winRate: stats.winRate,
				totalPnl: stats.totalPnl,
				avgPnl: stats.avgPnl,
				profitFactor: stats.profitFactor,
				avgWin: stats.avgWin,
				avgLoss: stats.avgLoss,
			};
		}),

	// Get rule compliance for a strategy
	getRuleCompliance: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify ownership
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.id),
					eq(strategies.userId, ctx.user.id),
				),
				with: {
					rules: true,
				},
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Get all trades with this strategy
			const strategyTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.strategyId, input.id),
					eq(trades.userId, ctx.user.id),
					isNull(trades.deletedAt),
				),
				with: {
					ruleChecks: true,
				},
			});

			// Calculate compliance per trade
			const tradeCompliance = strategyTrades.map((trade) => {
				const totalRules = strategy.rules.length;
				if (totalRules === 0) {
					return { tradeId: trade.id, compliance: 100 };
				}

				const checkedRules = trade.ruleChecks.filter((rc) => rc.checked).length;
				const compliance = (checkedRules / totalRules) * 100;

				return { tradeId: trade.id, compliance };
			});

			// Calculate average compliance
			const avgCompliance =
				tradeCompliance.length > 0
					? tradeCompliance.reduce((sum, tc) => sum + tc.compliance, 0) /
						tradeCompliance.length
					: 0;

			// Calculate compliance per rule
			const ruleCompliance = strategy.rules.map((rule) => {
				const checkedCount = strategyTrades.reduce((count, trade) => {
					const check = trade.ruleChecks.find((rc) => rc.ruleId === rule.id);
					return check?.checked ? count + 1 : count;
				}, 0);

				const compliance =
					strategyTrades.length > 0
						? (checkedCount / strategyTrades.length) * 100
						: 0;

				return {
					ruleId: rule.id,
					ruleText: rule.text,
					category: rule.category,
					checkedCount,
					totalTrades: strategyTrades.length,
					compliance,
				};
			});

			return {
				totalTrades: strategyTrades.length,
				avgCompliance,
				tradeCompliance,
				ruleCompliance,
			};
		}),

	// Check/uncheck a rule for a trade
	checkRule: protectedProcedure
		.input(
			z.object({
				tradeId: z.string(),
				ruleId: z.string(),
				checked: z.boolean(),
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
				throw new Error("Trade not found");
			}

			// Upsert the rule check
			await ctx.db
				.insert(tradeRuleChecks)
				.values({
					tradeId: input.tradeId,
					ruleId: input.ruleId,
					checked: input.checked,
					checkedAt: input.checked ? new Date() : null,
				})
				.onConflictDoUpdate({
					target: [tradeRuleChecks.tradeId, tradeRuleChecks.ruleId],
					set: {
						checked: input.checked,
						checkedAt: input.checked ? new Date() : null,
					},
				});

			return { success: true };
		}),

	// Bulk check rules for a trade
	bulkCheckRules: protectedProcedure
		.input(
			z.object({
				tradeId: z.string(),
				ruleChecks: z.array(
					z.object({
						ruleId: z.string(),
						checked: z.boolean(),
					}),
				),
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
				throw new Error("Trade not found");
			}

			// Delete existing checks for this trade
			await ctx.db
				.delete(tradeRuleChecks)
				.where(eq(tradeRuleChecks.tradeId, input.tradeId));

			// Insert new checks
			if (input.ruleChecks.length > 0) {
				await ctx.db.insert(tradeRuleChecks).values(
					input.ruleChecks.map((rc) => ({
						tradeId: input.tradeId,
						ruleId: rc.ruleId,
						checked: rc.checked,
						checkedAt: rc.checked ? new Date() : null,
					})),
				);
			}

			return { success: true };
		}),

	// Get rule checks for a trade
	getTradeRuleChecks: protectedProcedure
		.input(z.object({ tradeId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify trade ownership
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
				with: {
					strategy: {
						with: {
							rules: {
								orderBy: [strategyRules.order],
							},
						},
					},
					ruleChecks: true,
				},
			});

			if (!trade) {
				throw new Error("Trade not found");
			}

			if (!trade.strategy) {
				return { strategy: null, rules: [], checks: [], compliance: 0 };
			}

			const rules = trade.strategy.rules;
			const checks = trade.ruleChecks;

			// Calculate compliance
			const totalRules = rules.length;
			const checkedRules = checks.filter((c) => c.checked).length;
			const compliance = totalRules > 0 ? (checkedRules / totalRules) * 100 : 0;

			return {
				strategy: {
					id: trade.strategy.id,
					name: trade.strategy.name,
					color: trade.strategy.color,
				},
				rules,
				checks,
				compliance,
			};
		}),

	// Get simple list of strategies for dropdowns
	getSimpleList: protectedProcedure.query(async ({ ctx }) => {
		const results = await ctx.db.query.strategies.findMany({
			where: and(
				eq(strategies.userId, ctx.user.id),
				eq(strategies.isActive, true),
			),
			columns: {
				id: true,
				name: true,
				color: true,
			},
			orderBy: [strategies.name],
		});

		return results;
	}),

	// Get stats for all strategies at once (batch)
	getAllStats: protectedProcedure.query(async ({ ctx }) => {
		// Get user's breakeven threshold
		const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);

		// Get all active strategies
		const allStrategies = await ctx.db.query.strategies.findMany({
			where: and(
				eq(strategies.userId, ctx.user.id),
				eq(strategies.isActive, true),
			),
			columns: {
				id: true,
				name: true,
				color: true,
			},
		});

		// Get all closed trades with strategies (include fields needed for R-multiple)
		const allTrades = await ctx.db.query.trades.findMany({
			where: and(
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
			),
			columns: {
				id: true,
				strategyId: true,
				netPnl: true,
				entryPrice: true,
				stopLoss: true,
				quantity: true,
			},
		});

		// Calculate stats for each strategy using shared module
		const statsMap = allStrategies.map((strategy) => {
			const strategyTrades = allTrades.filter(
				(t) => t.strategyId === strategy.id,
			);

			// Use shared stats calculator
			const stats = calculateAggregateStats(strategyTrades, beThreshold);

			return {
				strategyId: strategy.id,
				strategyName: strategy.name,
				strategyColor: strategy.color,
				...stats,
			};
		});

		return statsMap;
	}),

	// Get comparative P&L data for charting (cumulative P&L over time per strategy)
	getComparativeData: protectedProcedure.query(async ({ ctx }) => {
		// Get all active strategies
		const allStrategies = await ctx.db.query.strategies.findMany({
			where: and(
				eq(strategies.userId, ctx.user.id),
				eq(strategies.isActive, true),
			),
			columns: {
				id: true,
				name: true,
				color: true,
			},
		});

		// Get all closed trades with strategies, ordered by exit time
		const allTrades = await ctx.db.query.trades.findMany({
			where: and(
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
			),
			columns: {
				id: true,
				strategyId: true,
				netPnl: true,
				exitTime: true,
			},
			orderBy: [trades.exitTime],
		});

		// Build cumulative P&L curves for each strategy
		const curves = allStrategies.map((strategy) => {
			const strategyTrades = allTrades
				.filter(
					(t): t is typeof t & { exitTime: Date } =>
						t.strategyId === strategy.id && t.exitTime !== null,
				)
				.sort(
					(a, b) =>
						new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime(),
				);

			let cumulative = 0;
			const dataPoints = strategyTrades.map((trade, index) => {
				cumulative += trade.netPnl ? parseFloat(trade.netPnl) : 0;
				return {
					tradeNumber: index + 1,
					date: trade.exitTime,
					pnl: cumulative,
				};
			});

			return {
				strategyId: strategy.id,
				strategyName: strategy.name,
				strategyColor: strategy.color ?? "#d4ff00",
				dataPoints,
			};
		});

		return curves;
	}),

	// Get presigned URL for strategy cover image upload
	getImageUploadUrl: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().int().positive(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify S3 is configured
			if (!isS3Configured()) {
				throw new Error(
					"File uploads are not configured. S3 settings are missing.",
				);
			}

			// Verify strategy ownership
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.strategyId),
					eq(strategies.userId, ctx.user.id),
				),
				columns: { id: true },
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Validate mime type is an allowed image type
			if (
				!ALLOWED_IMAGE_TYPES.includes(
					input.mimeType as (typeof ALLOWED_IMAGE_TYPES)[number],
				)
			) {
				throw new Error(
					`Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
				);
			}

			// Validate file size (5MB limit)
			if (input.size > MAX_COVER_IMAGE_SIZE) {
				throw new Error(
					`File too large. Maximum size is ${MAX_COVER_IMAGE_SIZE / (1024 * 1024)}MB`,
				);
			}

			// Generate S3 key: strategies/{userId}/{strategyId}/cover-{timestamp}.{ext}
			const ext = getFileExtension(input.filename, input.mimeType);
			const timestamp = Date.now();
			const key = `strategies/${ctx.user.id}/${input.strategyId}/cover-${timestamp}.${ext}`;

			// Generate presigned PUT URL (valid for 1 hour)
			const presignedUrl = getPresignedUploadUrl(key, 3600);

			// Generate public URL
			const publicUrl = getPublicUrl(key);

			return {
				presignedUrl,
				publicUrl,
				key,
			};
		}),

	// Publish a strategy to the marketplace
	publish: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				isAnonymous: z.boolean().optional().default(false),
				instruments: z.array(z.string()).optional(),
				categoryTags: z.array(z.string()).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Get strategy with ownership check
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.id),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Validate required fields for publishing
			if (!strategy.name || strategy.name.trim() === "") {
				throw new Error("Strategy must have a name to be published");
			}
			if (!strategy.description || strategy.description.trim() === "") {
				throw new Error("Strategy must have a description to be published");
			}

			// Count closed trades for this strategy
			const tradeCountResult = await ctx.db
				.select({ count: sql<number>`count(*)` })
				.from(trades)
				.where(
					and(
						eq(trades.strategyId, input.id),
						eq(trades.userId, ctx.user.id),
						eq(trades.status, "closed"),
						isNull(trades.deletedAt),
					),
				);

			const tradeCount = tradeCountResult[0]?.count ?? 0;

			if (tradeCount < MIN_TRADES_TO_PUBLISH) {
				throw new Error(
					`Strategy must have at least ${MIN_TRADES_TO_PUBLISH} closed trades to be published. Currently has ${tradeCount} trades.`,
				);
			}

			// Get all closed trades for stats computation
			const strategyTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.strategyId, input.id),
					eq(trades.userId, ctx.user.id),
					eq(trades.status, "closed"),
					isNull(trades.deletedAt),
				),
				columns: {
					netPnl: true,
					entryPrice: true,
					stopLoss: true,
					quantity: true,
					symbol: true,
					instrumentType: true,
				},
			});

			// Compute stats using shared analytics
			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);
			const stats = calculateAggregateStats(strategyTrades, beThreshold);

			// Build cached stats object
			const cachedStats = {
				totalTrades: stats.totalTrades,
				wins: stats.wins,
				losses: stats.losses,
				winRate: stats.winRate,
				profitFactor:
					stats.profitFactor === Infinity ? null : stats.profitFactor,
				avgR: stats.avgRMultiple,
				avgWin: stats.avgWin,
				avgLoss: stats.avgLoss,
				computedAt: new Date().toISOString(),
			};

			// Update strategy to published state
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					isPublic: true,
					isAnonymous: input.isAnonymous,
					instruments: input.instruments ?? strategy.instruments,
					categoryTags: input.categoryTags ?? strategy.categoryTags,
					cachedStats: JSON.stringify(cachedStats),
				})
				.where(eq(strategies.id, input.id))
				.returning();

			if (!updated) {
				throw new Error("Failed to publish strategy");
			}

			return {
				...updated,
				riskParameters: updated.riskParameters
					? JSON.parse(updated.riskParameters)
					: null,
				scalingRules: updated.scalingRules
					? JSON.parse(updated.scalingRules)
					: null,
				trailingRules: updated.trailingRules
					? JSON.parse(updated.trailingRules)
					: null,
				cachedStats,
			};
		}),

	// Unpublish a strategy from the marketplace
	unpublish: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.id),
					eq(strategies.userId, ctx.user.id),
				),
				columns: { id: true },
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Update strategy to unpublished state
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					isPublic: false,
				})
				.where(eq(strategies.id, input.id))
				.returning();

			if (!updated) {
				throw new Error("Failed to unpublish strategy");
			}

			return {
				...updated,
				riskParameters: updated.riskParameters
					? JSON.parse(updated.riskParameters)
					: null,
				scalingRules: updated.scalingRules
					? JSON.parse(updated.scalingRules)
					: null,
				trailingRules: updated.trailingRules
					? JSON.parse(updated.trailingRules)
					: null,
			};
		}),

	// ==========================================================================
	// INDIVIDUAL RULE MANAGEMENT (for auto-save edit page)
	// ==========================================================================

	/** Add a new rule to a strategy */
	addRule: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				text: z.string().min(1, "Rule text is required"),
				category: z.enum(["entry", "exit", "risk", "management"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId, text, category } = input;

			// Verify strategy ownership
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Get max order for this strategy's rules
			const existingRules = await ctx.db.query.strategyRules.findMany({
				where: eq(strategyRules.strategyId, strategyId),
				orderBy: [desc(strategyRules.order)],
				limit: 1,
			});

			const newOrder =
				existingRules.length > 0 ? (existingRules[0]?.order ?? 0) + 1 : 0;

			// Insert new rule
			const [newRule] = await ctx.db
				.insert(strategyRules)
				.values({
					strategyId,
					text,
					category,
					order: newOrder,
				})
				.returning();

			return newRule;
		}),

	/** Update an existing rule */
	updateRule: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				text: z.string().min(1, "Rule text is required").optional(),
				category: z.enum(["entry", "exit", "risk", "management"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updates } = input;

			// Verify rule exists and user owns the strategy
			const rule = await ctx.db.query.strategyRules.findFirst({
				where: eq(strategyRules.id, id),
				with: {
					strategy: true,
				},
			});

			if (!rule || rule.strategy.userId !== ctx.user.id) {
				throw new Error("Rule not found");
			}

			// Update the rule
			const [updated] = await ctx.db
				.update(strategyRules)
				.set(updates)
				.where(eq(strategyRules.id, id))
				.returning();

			return updated;
		}),

	/** Delete a rule */
	deleteRule: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify rule exists and user owns the strategy
			const rule = await ctx.db.query.strategyRules.findFirst({
				where: eq(strategyRules.id, input.id),
				with: {
					strategy: true,
				},
			});

			if (!rule || rule.strategy.userId !== ctx.user.id) {
				throw new Error("Rule not found");
			}

			// Delete the rule
			await ctx.db.delete(strategyRules).where(eq(strategyRules.id, input.id));

			return { success: true };
		}),

	/** Reorder rules within a strategy */
	reorderRules: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				ruleOrders: z.array(
					z.object({
						id: z.string(),
						order: z.number(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId, ruleOrders } = input;

			// Verify strategy ownership
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Update each rule's order
			await Promise.all(
				ruleOrders.map(({ id, order }) =>
					ctx.db
						.update(strategyRules)
						.set({ order })
						.where(
							and(
								eq(strategyRules.id, id),
								eq(strategyRules.strategyId, strategyId),
							),
						),
				),
			);

			return { success: true };
		}),
});
