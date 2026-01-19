import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { env } from "@/env";
import { calculateAggregateStats } from "@/lib/analytics";
import {
	ALL_INSTRUMENT_VALUES,
	COVER_IMAGE_ACCEPTED_TYPES,
	COVER_IMAGE_MAX_SIZE_BYTES,
	COVER_IMAGE_MAX_SIZE_MB,
	STRATEGY_CATEGORIES,
} from "@/lib/constants/marketplace";
import {
	deleteObject,
	getPresignedUploadUrl,
	getS3Bucket,
	isS3Configured,
} from "@/lib/storage/s3";
import { getUserBreakevenThreshold } from "@/server/api/helpers";
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

/**
 * Construct the public URL for an S3 object.
 * Uses the custom domain if configured, otherwise falls back to the S3 endpoint.
 */
function getPublicUrl(key: string): string {
	// Use custom domain if configured (e.g., for CDN)
	if (env.S3_PUBLIC_URL) {
		return `${env.S3_PUBLIC_URL}/${key}`;
	}

	// Fall back to S3 endpoint + bucket
	const bucket = getS3Bucket();
	const endpoint = env.S3_ENDPOINT ?? "";

	// Remove trailing slash from endpoint if present
	const cleanEndpoint = endpoint.replace(/\/$/, "");

	return `${cleanEndpoint}/${bucket}/${key}`;
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
	entryCriteria: z.string().nullish(),
	exitRules: z.string().nullish(),
	riskParameters: riskParametersSchema.nullish(),
	scalingRules: scalingRulesSchema.nullish(),
	trailingRules: trailingRulesSchema.nullish(),
	isActive: z.boolean().optional(),
	rules: z.array(strategyRuleSchema).optional(),
});

const autosaveStrategySchema = z.object({
	id: z.string(),
	clientUpdatedAt: z.string(), // ISO timestamp for conflict detection
	name: z.string().min(1).max(100).optional(),
	description: z.string().nullish(),
	color: z.string().optional(),
	entryCriteria: z.string().nullish(),
	exitRules: z.string().nullish(),
	riskParameters: riskParametersSchema.nullish(),
	scalingRules: scalingRulesSchema.nullish(),
	trailingRules: trailingRulesSchema.nullish(),
	isActive: z.boolean().optional(),
	rules: z.array(strategyRuleSchema).optional(),
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
				...data
			} = input;

			// Verify ownership
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(eq(strategies.id, id), eq(strategies.userId, ctx.user.id)),
			});

			if (!existingStrategy) {
				throw new Error("Strategy not found");
			}

			// Prepare update data
			const updateData: Record<string, unknown> = { ...data };

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

	// =============================================================================
	// COVER IMAGE ENDPOINTS
	// =============================================================================

	/**
	 * Get a presigned URL for uploading a strategy cover image.
	 * Validates ownership, mime type, and file size before generating the URL.
	 */
	getCoverImageUploadUrl: protectedProcedure
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

			// Verify user owns the strategy
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Validate mime type
			if (
				!COVER_IMAGE_ACCEPTED_TYPES.includes(
					input.mimeType as (typeof COVER_IMAGE_ACCEPTED_TYPES)[number],
				)
			) {
				throw new Error(
					`Invalid file type. Accepted types: ${COVER_IMAGE_ACCEPTED_TYPES.join(", ")}`,
				);
			}

			// Validate file size
			if (input.size > COVER_IMAGE_MAX_SIZE_BYTES) {
				throw new Error(
					`File too large. Maximum size is ${COVER_IMAGE_MAX_SIZE_MB}MB`,
				);
			}

			// Generate a unique key for the file
			// Format: images/{userId}/strategy-covers/{strategyId}/{nanoid}-{filename}
			const uuid = nanoid();
			const key = `images/${ctx.user.id}/strategy-covers/${input.strategyId}/${uuid}-${input.filename}`;

			// Generate presigned PUT URL (valid for 1 hour)
			const presignedUrl = getPresignedUploadUrl(key, 3600);

			// Generate public URL for embedding
			const publicUrl = getPublicUrl(key);

			return {
				presignedUrl,
				key,
				publicUrl,
			};
		}),

	/**
	 * Confirm a cover image upload and update the strategy.
	 * Deletes the old cover image from S3 if one exists.
	 */
	confirmCoverImage: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				key: z.string(),
				url: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns the strategy
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Delete old cover image from S3 if exists (graceful failure)
			if (strategy.coverImageKey) {
				try {
					await deleteObject(strategy.coverImageKey);
				} catch {
					// Gracefully ignore deletion failures - the old image will remain orphaned
					console.error(
						`Failed to delete old cover image: ${strategy.coverImageKey}`,
					);
				}
			}

			// Update strategy with new cover image
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					coverImageUrl: input.url,
					coverImageKey: input.key,
				})
				.where(eq(strategies.id, input.strategyId))
				.returning();

			return updated;
		}),

	/**
	 * Delete a strategy's cover image.
	 * Removes the image from S3 and clears the strategy's cover image fields.
	 */
	deleteCoverImage: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns the strategy
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Delete S3 object if exists (graceful failure)
			if (strategy.coverImageKey) {
				try {
					await deleteObject(strategy.coverImageKey);
				} catch {
					// Gracefully ignore deletion failures - continue with DB update
					console.error(
						`Failed to delete cover image from S3: ${strategy.coverImageKey}`,
					);
				}
			}

			// Clear cover image fields
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					coverImageUrl: null,
					coverImageKey: null,
				})
				.where(eq(strategies.id, input.strategyId))
				.returning();

			return updated;
		}),

	// =============================================================================
	// AUTO-SAVE ENDPOINT
	// =============================================================================

	/**
	 * Auto-save strategy changes with optimistic concurrency control.
	 * Compares clientUpdatedAt with server's updatedAt to detect conflicts.
	 */
	autosave: protectedProcedure
		.input(autosaveStrategySchema)
		.mutation(async ({ ctx, input }) => {
			const {
				id,
				clientUpdatedAt,
				rules,
				riskParameters,
				scalingRules,
				trailingRules,
				...data
			} = input;

			// Verify ownership and get current version
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(eq(strategies.id, id), eq(strategies.userId, ctx.user.id)),
			});

			if (!existingStrategy) {
				throw new Error("Strategy not found");
			}

			// Compare timestamps for conflict detection
			const clientTimestamp = new Date(clientUpdatedAt).getTime();
			const serverTimestamp = existingStrategy.updatedAt
				? new Date(existingStrategy.updatedAt).getTime()
				: 0;

			// If client version is older than server version, return conflict
			if (clientTimestamp < serverTimestamp) {
				return {
					success: false,
					conflict: true,
					serverVersion: {
						...existingStrategy,
						riskParameters: existingStrategy.riskParameters
							? JSON.parse(existingStrategy.riskParameters)
							: null,
						scalingRules: existingStrategy.scalingRules
							? JSON.parse(existingStrategy.scalingRules)
							: null,
						trailingRules: existingStrategy.trailingRules
							? JSON.parse(existingStrategy.trailingRules)
							: null,
					},
				};
			}

			// Prepare update data
			const updateData: Record<string, unknown> = { ...data };

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

			// Update strategy
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

			return {
				success: true,
				savedAt: updated?.updatedAt?.toISOString() ?? new Date().toISOString(),
				strategy: updated
					? {
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
						}
					: null,
			};
		}),

	// =============================================================================
	// MARKETPLACE ENDPOINTS
	// =============================================================================

	/**
	 * Publish a strategy to the marketplace.
	 * Validates instruments and categories before publishing.
	 */
	publish: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				instruments: z
					.array(z.string())
					.min(1, "At least one instrument is required"),
				categoryTags: z
					.array(z.string())
					.min(1, "At least one category is required"),
				isAnonymous: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns the strategy
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Validate instruments
			const validInstrumentValues: readonly string[] = ALL_INSTRUMENT_VALUES;
			const validCategoryValues: readonly string[] = STRATEGY_CATEGORIES.map(
				(c) => c.value,
			);

			const invalidInstruments = input.instruments.filter(
				(i) => !validInstrumentValues.includes(i),
			);
			if (invalidInstruments.length > 0) {
				throw new Error(
					`Invalid instrument(s): ${invalidInstruments.join(", ")}`,
				);
			}

			// Validate category tags
			const invalidCategories = input.categoryTags.filter(
				(c) => !validCategoryValues.includes(c),
			);
			if (invalidCategories.length > 0) {
				throw new Error(`Invalid category(s): ${invalidCategories.join(", ")}`);
			}

			// Update strategy for publishing
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					isPublic: true,
					isAnonymous: input.isAnonymous,
					instruments: JSON.stringify(input.instruments),
					categoryTags: JSON.stringify(input.categoryTags),
					publishedAt: strategy.publishedAt ?? new Date(), // Keep original publish date if re-publishing
				})
				.where(eq(strategies.id, input.strategyId))
				.returning();

			return updated;
		}),

	/**
	 * Unpublish a strategy from the marketplace.
	 * Keeps instruments, categoryTags, and publishedAt intact for easy re-publishing.
	 */
	unpublish: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns the strategy
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			// Set isPublic to false (keep other marketplace fields intact)
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					isPublic: false,
				})
				.where(eq(strategies.id, input.strategyId))
				.returning();

			return updated;
		}),

	/**
	 * Vote on a marketplace strategy.
	 * Supports upvote, downvote, or removing a vote.
	 */
	vote: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				voteType: z.enum(["up", "down"]).nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Get the strategy to validate it's public and not owned by the user
			const strategy = await ctx.db.query.strategies.findFirst({
				where: eq(strategies.id, input.strategyId),
			});

			if (!strategy) {
				throw new Error("Strategy not found");
			}

			if (!strategy.isPublic) {
				throw new Error("Cannot vote on a private strategy");
			}

			if (strategy.userId === ctx.user.id) {
				throw new Error("Cannot vote on your own strategy");
			}

			// Get existing vote if any
			const existingVote = await ctx.db.query.strategyVotes.findFirst({
				where: and(
					eq(strategyVotes.strategyId, input.strategyId),
					eq(strategyVotes.userId, ctx.user.id),
				),
			});

			// Handle vote removal (null)
			if (input.voteType === null) {
				if (existingVote) {
					await ctx.db
						.delete(strategyVotes)
						.where(eq(strategyVotes.id, existingVote.id));
				}
			}
			// Handle same vote type -> toggle off
			else if (existingVote?.voteType === input.voteType) {
				await ctx.db
					.delete(strategyVotes)
					.where(eq(strategyVotes.id, existingVote.id));
			}
			// Handle different vote type or new vote -> upsert
			else if (existingVote) {
				await ctx.db
					.update(strategyVotes)
					.set({ voteType: input.voteType })
					.where(eq(strategyVotes.id, existingVote.id));
			} else {
				await ctx.db.insert(strategyVotes).values({
					strategyId: input.strategyId,
					userId: ctx.user.id,
					voteType: input.voteType,
				});
			}

			// Calculate and return vote counts
			const votes = await ctx.db.query.strategyVotes.findMany({
				where: eq(strategyVotes.strategyId, input.strategyId),
			});

			const upvotes = votes.filter((v) => v.voteType === "up").length;
			const downvotes = votes.filter((v) => v.voteType === "down").length;
			const netVotes = upvotes - downvotes;

			// Get current user's vote
			const userVote = await ctx.db.query.strategyVotes.findFirst({
				where: and(
					eq(strategyVotes.strategyId, input.strategyId),
					eq(strategyVotes.userId, ctx.user.id),
				),
			});

			return {
				upvotes,
				downvotes,
				netVotes,
				userVote: userVote?.voteType ?? null,
			};
		}),

	/**
	 * Download/copy a marketplace strategy to the user's collection.
	 * Creates a full copy with sourceStrategyId set to the original.
	 * Idempotent - returns existing copy if already downloaded.
	 */
	download: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Get the source strategy with rules
			const sourceStrategy = await ctx.db.query.strategies.findFirst({
				where: eq(strategies.id, input.strategyId),
				with: {
					rules: true,
				},
			});

			if (!sourceStrategy) {
				throw new Error("Strategy not found");
			}

			if (!sourceStrategy.isPublic) {
				throw new Error("Cannot download a private strategy");
			}

			if (sourceStrategy.userId === ctx.user.id) {
				throw new Error("You already own this strategy");
			}

			// Check if already downloaded (idempotent)
			const existingDownload = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.userId, ctx.user.id),
					eq(strategies.sourceStrategyId, input.strategyId),
				),
			});

			if (existingDownload) {
				// Return the existing copy
				return existingDownload;
			}

			// Create a full copy of the strategy
			const [newStrategy] = await ctx.db
				.insert(strategies)
				.values({
					userId: ctx.user.id,
					name: `${sourceStrategy.name} (Copy)`,
					description: sourceStrategy.description,
					color: sourceStrategy.color,
					entryCriteria: sourceStrategy.entryCriteria,
					exitRules: sourceStrategy.exitRules,
					riskParameters: sourceStrategy.riskParameters,
					scalingRules: sourceStrategy.scalingRules,
					trailingRules: sourceStrategy.trailingRules,
					coverImageUrl: sourceStrategy.coverImageUrl, // Reference same image
					// Don't copy coverImageKey - we don't own the S3 object
					sourceStrategyId: input.strategyId,
					isPublic: false,
					isAnonymous: false,
					instruments: null,
					categoryTags: null,
					publishedAt: null,
					isActive: true,
				})
				.returning();

			if (!newStrategy) {
				throw new Error("Failed to create strategy copy");
			}

			// Copy rules
			if (sourceStrategy.rules.length > 0) {
				await ctx.db.insert(strategyRules).values(
					sourceStrategy.rules.map((rule) => ({
						strategyId: newStrategy.id,
						text: rule.text,
						category: rule.category,
						order: rule.order,
					})),
				);
			}

			// Create download record
			await ctx.db.insert(strategyDownloads).values({
				strategyId: input.strategyId,
				userId: ctx.user.id,
				copiedStrategyId: newStrategy.id,
			});

			return newStrategy;
		}),

	// =============================================================================
	// MARKETPLACE DISCOVERY ENDPOINTS
	// =============================================================================

	/**
	 * List marketplace strategies with search, filtering, sorting, and pagination.
	 * Returns public strategies with aggregated vote/download counts.
	 */
	marketplaceList: protectedProcedure
		.input(
			z.object({
				search: z.string().optional(),
				instruments: z.array(z.string()).optional(),
				categories: z.array(z.string()).optional(),
				sortBy: z
					.enum(["votes", "downloads", "newest", "updated"])
					.default("votes"),
				cursor: z.string().optional(), // Format: "sortValue:id"
				limit: z.number().min(1).max(50).default(20),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Build base conditions
			const conditions = [eq(strategies.isPublic, true)];

			// Search filter (name or description)
			if (input.search?.trim()) {
				conditions.push(
					or(
						ilike(strategies.name, `%${input.search}%`),
						ilike(strategies.description, `%${input.search}%`),
					) ?? sql`true`,
				);
			}

			// Get all public strategies matching filters
			const publicStrategies = await ctx.db.query.strategies.findMany({
				where: and(...conditions),
				with: {
					user: {
						columns: {
							id: true,
							name: true,
						},
					},
					votes: true,
					downloads: true,
				},
			});

			// Filter by instruments and categories (stored as JSON arrays)
			let filteredStrategies = publicStrategies;

			if (input.instruments && input.instruments.length > 0) {
				filteredStrategies = filteredStrategies.filter((s) => {
					if (!s.instruments) return false;
					const strategyInstruments = JSON.parse(s.instruments) as string[];
					return input.instruments?.some((i) =>
						strategyInstruments.includes(i),
					);
				});
			}

			if (input.categories && input.categories.length > 0) {
				filteredStrategies = filteredStrategies.filter((s) => {
					if (!s.categoryTags) return false;
					const strategyCategories = JSON.parse(s.categoryTags) as string[];
					return input.categories?.some((c) => strategyCategories.includes(c));
				});
			}

			// Calculate aggregates and add metadata
			const strategiesWithStats = filteredStrategies.map((s) => {
				const upvotes = s.votes.filter((v) => v.voteType === "up").length;
				const downvotes = s.votes.filter((v) => v.voteType === "down").length;
				const netVotes = upvotes - downvotes;
				const downloadCount = s.downloads.length;
				const userVote = s.votes.find((v) => v.userId === ctx.user.id);

				return {
					id: s.id,
					name: s.name,
					description: s.description,
					color: s.color,
					coverImageUrl: s.coverImageUrl,
					instruments: s.instruments ? JSON.parse(s.instruments) : [],
					categoryTags: s.categoryTags ? JSON.parse(s.categoryTags) : [],
					publishedAt: s.publishedAt,
					updatedAt: s.updatedAt,
					authorId: s.userId,
					authorName: s.isAnonymous ? "Anonymous" : (s.user?.name ?? "Unknown"),
					isAnonymous: s.isAnonymous,
					upvotes,
					downvotes,
					netVotes,
					downloadCount,
					currentUserVote: userVote?.voteType ?? null,
				};
			});

			// Sort
			type StrategyWithStats = (typeof strategiesWithStats)[number];
			const sortFn = (a: StrategyWithStats, b: StrategyWithStats) => {
				switch (input.sortBy) {
					case "votes":
						return b.netVotes - a.netVotes;
					case "downloads":
						return b.downloadCount - a.downloadCount;
					case "newest":
						return (
							(b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
						);
					case "updated":
						return (
							(b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
						);
					default:
						return 0;
				}
			};

			strategiesWithStats.sort(sortFn);

			// Apply cursor pagination
			let startIndex = 0;
			if (input.cursor) {
				const cursorIndex = strategiesWithStats.findIndex(
					(s) => s.id === input.cursor,
				);
				if (cursorIndex !== -1) {
					startIndex = cursorIndex + 1;
				}
			}

			const paginatedStrategies = strategiesWithStats.slice(
				startIndex,
				startIndex + input.limit,
			);

			// Determine next cursor
			const hasMore = startIndex + input.limit < strategiesWithStats.length;
			const nextCursor = hasMore
				? paginatedStrategies[paginatedStrategies.length - 1]?.id
				: undefined;

			return {
				strategies: paginatedStrategies,
				nextCursor,
			};
		}),
});
