import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import type { RiskParameters } from "@/components/strategy/risk-config";
import type { ScalingRules } from "@/components/strategy/scaling-config";
import type { TrailingRules } from "@/components/strategy/trailing-config";
import { calculateAggregateStats } from "@/lib/analytics";
import {
	ERR_STRATEGY_CREATE_FAILED,
	ERR_STRATEGY_DUPLICATE_FAILED,
	ERR_STRATEGY_NOT_FOUND,
	ERR_TRADE_NO_STRATEGY,
	ERR_TRADE_NOT_FOUND,
} from "@/lib/constants/errors";
import {
	buildEvaluationContext,
	calculateMfeInR,
	evaluateAutoCondition,
	generateRulesFromConfig,
	isRuleRelevant,
} from "@/lib/strategy";
import type { AutoCondition, AutoEvaluationResult } from "@/lib/strategy/types";
import { getUserBreakevenThreshold } from "@/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type * as schema from "@/server/db/schema";
import {
	strategies,
	strategyRules,
	tradeRuleChecks,
	trades,
} from "@/server/db/schema";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Syncs auto-generated rules from strategy configuration.
 * Called internally after create/update to ensure rules reflect config.
 */
async function syncGeneratedRulesInternal(
	db: PostgresJsDatabase<typeof schema>,
	strategyId: string,
	riskParams: RiskParameters | null,
	scalingRulesConfig: ScalingRules | null,
	trailingRulesConfig: TrailingRules | null,
): Promise<{ added: number; updated: number; deleted: number }> {
	// Get existing rules for this strategy
	const existingRules = await db.query.strategyRules.findMany({
		where: eq(strategyRules.strategyId, strategyId),
	});

	// Generate desired rules from config
	const desiredRules = generateRulesFromConfig(
		riskParams,
		scalingRulesConfig,
		trailingRulesConfig,
	);

	// Get existing generated rules (isGenerated: true)
	const existingGeneratedRules = existingRules.filter(
		(rule) => rule.isGenerated,
	);

	// Build a map of existing rules by configSource for comparison
	const existingBySource = new Map(
		existingGeneratedRules.map((rule) => [rule.configSource, rule]),
	);

	// Track changes
	let added = 0;
	let updated = 0;
	let deleted = 0;

	// Determine max order from existing rules (both manual and generated)
	const maxOrder = existingRules.reduce(
		(max, rule) => Math.max(max, rule.order),
		-1,
	);
	let nextOrder = maxOrder + 1;

	// Process desired rules: add new or update existing
	for (const desiredRule of desiredRules) {
		const existing = existingBySource.get(desiredRule.configSource);

		if (existing) {
			// Check if hash changed (config was updated)
			if (existing.sourceConfigHash !== desiredRule.sourceConfigHash) {
				// Update the rule
				await db
					.update(strategyRules)
					.set({
						text: desiredRule.text,
						category: desiredRule.category,
						ruleType: desiredRule.ruleType,
						autoCondition: desiredRule.autoCondition
							? JSON.stringify(desiredRule.autoCondition)
							: null,
						sourceConfigHash: desiredRule.sourceConfigHash,
					})
					.where(eq(strategyRules.id, existing.id));
				updated++;
			}
			// Remove from map to track what's left (orphaned)
			existingBySource.delete(desiredRule.configSource);
		} else {
			// Add new rule
			await db.insert(strategyRules).values({
				strategyId,
				text: desiredRule.text,
				category: desiredRule.category,
				order: nextOrder++,
				ruleType: desiredRule.ruleType,
				configSource: desiredRule.configSource,
				autoCondition: desiredRule.autoCondition
					? JSON.stringify(desiredRule.autoCondition)
					: null,
				isGenerated: true,
				sourceConfigHash: desiredRule.sourceConfigHash,
			});
			added++;
		}
	}

	// Delete orphaned generated rules (in existingBySource but not in desiredRules)
	for (const orphanedRule of existingBySource.values()) {
		await db.delete(strategyRules).where(eq(strategyRules.id, orphanedRule.id));
		deleted++;
	}

	return { added, updated, deleted };
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
			enabled: z.boolean().optional(),
		})
		.optional(),
	maxRiskPerTrade: z
		.object({
			type: z.enum(["dollars", "percent"]),
			value: z.number(),
			enabled: z.boolean().optional(),
		})
		.optional(),
	dailyLossLimit: z
		.object({
			type: z.enum(["dollars", "percent"]),
			value: z.number(),
			enabled: z.boolean().optional(),
		})
		.optional(),
	maxConcurrentPositions: z.number().optional(),
	maxConcurrentPositionsEnabled: z.boolean().optional(),
	minRRRatio: z.number().optional(),
	minRRRatioEnabled: z.boolean().optional(),
	targetRMultiples: z.array(z.number()).optional(),
});

const scalingRulesSchema = z.object({
	scaleIn: z
		.array(
			z.object({
				trigger: z.string(),
				sizePercent: z.number(),
				enabled: z.boolean().optional(),
			}),
		)
		.optional(),
	scaleOut: z
		.array(
			z.object({
				trigger: z.string(),
				sizePercent: z.number(),
				enabled: z.boolean().optional(),
			}),
		)
		.optional(),
});

const trailingRulesSchema = z.object({
	moveToBreakeven: z
		.object({
			triggerR: z.number(),
			offsetTicks: z.number().optional(),
			enabled: z.boolean().optional(),
		})
		.optional(),
	trailStops: z
		.array(
			z.object({
				triggerR: z.number(),
				method: z.enum(["fixed_ticks", "atr_multiple", "swing_low"]),
				value: z.number(),
				enabled: z.boolean().optional(),
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
				throw new Error(ERR_STRATEGY_NOT_FOUND);
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
				throw new Error(ERR_STRATEGY_CREATE_FAILED);
			}

			// Create manual rules if provided
			if (rules && rules.length > 0) {
				await ctx.db.insert(strategyRules).values(
					rules.map((rule) => ({
						strategyId: newStrategy.id,
						text: rule.text,
						category: rule.category,
						order: rule.order,
						isGenerated: false,
					})),
				);
			}

			// Sync auto-generated rules from config
			await syncGeneratedRulesInternal(
				ctx.db,
				newStrategy.id,
				riskParameters ?? null,
				scalingRules ?? null,
				trailingRules ?? null,
			);

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
				throw new Error(ERR_STRATEGY_NOT_FOUND);
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

			// Only update strategies table if there's something to update
			let updated = existingStrategy;
			if (Object.keys(updateData).length > 0) {
				const [result] = await ctx.db
					.update(strategies)
					.set(updateData)
					.where(eq(strategies.id, id))
					.returning();
				updated = result ?? existingStrategy;
			}

			// Update manual rules if provided (only delete non-generated rules)
			if (rules !== undefined) {
				// Get existing generated rules to filter out duplicates from input
				const existingGeneratedRules =
					await ctx.db.query.strategyRules.findMany({
						where: and(
							eq(strategyRules.strategyId, id),
							eq(strategyRules.isGenerated, true),
						),
						columns: { text: true },
					});
				const generatedRuleTexts = new Set(
					existingGeneratedRules.map((r) => r.text),
				);

				// Filter out rules that duplicate generated rules (defense-in-depth)
				// This prevents bugs where frontend accidentally sends generated rules back
				const manualOnlyRules = rules.filter(
					(rule) => !generatedRuleTexts.has(rule.text),
				);

				// Delete existing MANUAL rules only (preserve generated rules)
				await ctx.db
					.delete(strategyRules)
					.where(
						and(
							eq(strategyRules.strategyId, id),
							eq(strategyRules.isGenerated, false),
						),
					);

				// Insert new manual rules
				if (manualOnlyRules.length > 0) {
					await ctx.db.insert(strategyRules).values(
						manualOnlyRules.map((rule) => ({
							strategyId: id,
							text: rule.text,
							category: rule.category,
							order: rule.order,
							isGenerated: false,
						})),
					);
				}
			}

			// Sync auto-generated rules from config
			// Get the final config values (from input if provided, otherwise from existing strategy)
			const finalRiskParams: RiskParameters | null =
				riskParameters !== undefined
					? riskParameters
					: existingStrategy.riskParameters
						? JSON.parse(existingStrategy.riskParameters)
						: null;
			const finalScalingRules: ScalingRules | null =
				scalingRules !== undefined
					? scalingRules
					: existingStrategy.scalingRules
						? JSON.parse(existingStrategy.scalingRules)
						: null;
			const finalTrailingRules: TrailingRules | null =
				trailingRules !== undefined
					? trailingRules
					: existingStrategy.trailingRules
						? JSON.parse(existingStrategy.trailingRules)
						: null;

			await syncGeneratedRulesInternal(
				ctx.db,
				id,
				finalRiskParams,
				finalScalingRules,
				finalTrailingRules,
			);

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
				throw new Error(ERR_STRATEGY_NOT_FOUND);
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
				throw new Error(ERR_STRATEGY_NOT_FOUND);
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
				throw new Error(ERR_STRATEGY_DUPLICATE_FAILED);
			}

			// Duplicate rules (preserving all properties including generated rule metadata)
			if (original.rules.length > 0) {
				await ctx.db.insert(strategyRules).values(
					original.rules.map((rule) => ({
						strategyId: newStrategy.id,
						text: rule.text,
						category: rule.category,
						order: rule.order,
						ruleType: rule.ruleType,
						configSource: rule.configSource,
						autoCondition: rule.autoCondition,
						isGenerated: rule.isGenerated,
						sourceConfigHash: rule.sourceConfigHash,
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
				throw new Error(ERR_STRATEGY_NOT_FOUND);
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
				throw new Error(ERR_STRATEGY_NOT_FOUND);
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
				userOverride: z.boolean().optional(),
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

			// Build the values to set
			const setValues: {
				checked: boolean;
				checkedAt: Date | null;
				userOverride?: boolean;
			} = {
				checked: input.checked,
				checkedAt: input.checked ? new Date() : null,
			};

			// Only set userOverride if explicitly provided
			if (input.userOverride !== undefined) {
				setValues.userOverride = input.userOverride;
			}

			// Upsert the rule check
			await ctx.db
				.insert(tradeRuleChecks)
				.values({
					tradeId: input.tradeId,
					ruleId: input.ruleId,
					checked: input.checked,
					checkedAt: input.checked ? new Date() : null,
					userOverride: input.userOverride ?? null,
				})
				.onConflictDoUpdate({
					target: [tradeRuleChecks.tradeId, tradeRuleChecks.ruleId],
					set: setValues,
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
				throw new Error(ERR_TRADE_NOT_FOUND);
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
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			if (!trade.strategy) {
				return {
					strategy: null,
					rules: [],
					checks: [],
					compliance: 0,
					relevantRuleIds: [],
				};
			}

			const rules = trade.strategy.rules;
			const checks = trade.ruleChecks;

			// Calculate MFE in R-multiples for relevance filtering
			const mfeR = calculateMfeInR({
				id: trade.id,
				symbol: trade.symbol,
				direction: trade.direction,
				entryPrice: trade.entryPrice,
				exitPrice: trade.exitPrice,
				quantity: trade.quantity,
				stopLoss: trade.stopLoss,
				takeProfit: trade.takeProfit,
				trailedStopLoss: trade.trailedStopLoss,
				wasTrailed: trade.wasTrailed,
				netPnl: trade.netPnl,
				mfePrice: trade.mfePrice,
				mfeAmount: trade.mfeAmount,
			});

			// Determine which rules are relevant based on MFE
			const relevantRuleIds: string[] = [];
			for (const rule of rules) {
				// Rules without autoCondition (pure manual) are always relevant
				if (!rule.autoCondition) {
					relevantRuleIds.push(rule.id);
					continue;
				}

				// Parse the auto condition and check relevance
				try {
					const condition = JSON.parse(rule.autoCondition) as AutoCondition;
					if (isRuleRelevant(condition, mfeR)) {
						relevantRuleIds.push(rule.id);
					}
				} catch {
					// Invalid JSON - consider the rule relevant (safe default)
					relevantRuleIds.push(rule.id);
				}
			}

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
				relevantRuleIds,
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

	// Sync generated rules from strategy config
	syncGeneratedRules: protectedProcedure
		.input(z.object({ strategyId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Fetch strategy with ownership validation
			const strategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, input.strategyId),
					eq(strategies.userId, ctx.user.id),
				),
				with: {
					rules: true,
				},
			});

			if (!strategy) {
				throw new Error(ERR_STRATEGY_NOT_FOUND);
			}

			// Parse JSON configs
			const riskParams: RiskParameters | null = strategy.riskParameters
				? JSON.parse(strategy.riskParameters)
				: null;
			const scalingRulesConfig: ScalingRules | null = strategy.scalingRules
				? JSON.parse(strategy.scalingRules)
				: null;
			const trailingRulesConfig: TrailingRules | null = strategy.trailingRules
				? JSON.parse(strategy.trailingRules)
				: null;

			// Generate desired rules from config
			const desiredRules = generateRulesFromConfig(
				riskParams,
				scalingRulesConfig,
				trailingRulesConfig,
			);

			// Get existing generated rules (isGenerated: true)
			const existingGeneratedRules = strategy.rules.filter(
				(rule) => rule.isGenerated,
			);

			// Build a map of existing rules by configSource for comparison
			const existingBySource = new Map(
				existingGeneratedRules.map((rule) => [rule.configSource, rule]),
			);

			// Track changes
			let added = 0;
			let updated = 0;
			let deleted = 0;

			// Determine max order from existing rules (both manual and generated)
			const maxOrder = strategy.rules.reduce(
				(max, rule) => Math.max(max, rule.order),
				-1,
			);
			let nextOrder = maxOrder + 1;

			// Process desired rules: add new or update existing
			for (const desiredRule of desiredRules) {
				const existing = existingBySource.get(desiredRule.configSource);

				if (existing) {
					// Check if hash changed (config was updated)
					if (existing.sourceConfigHash !== desiredRule.sourceConfigHash) {
						// Update the rule
						await ctx.db
							.update(strategyRules)
							.set({
								text: desiredRule.text,
								category: desiredRule.category,
								ruleType: desiredRule.ruleType,
								autoCondition: desiredRule.autoCondition
									? JSON.stringify(desiredRule.autoCondition)
									: null,
								sourceConfigHash: desiredRule.sourceConfigHash,
							})
							.where(eq(strategyRules.id, existing.id));
						updated++;
					}
					// Remove from map to track what's left (orphaned)
					existingBySource.delete(desiredRule.configSource);
				} else {
					// Add new rule
					await ctx.db.insert(strategyRules).values({
						strategyId: input.strategyId,
						text: desiredRule.text,
						category: desiredRule.category,
						order: nextOrder++,
						ruleType: desiredRule.ruleType,
						configSource: desiredRule.configSource,
						autoCondition: desiredRule.autoCondition
							? JSON.stringify(desiredRule.autoCondition)
							: null,
						isGenerated: true,
						sourceConfigHash: desiredRule.sourceConfigHash,
					});
					added++;
				}
			}

			// Delete orphaned generated rules (in existingBySource but not in desiredRules)
			for (const orphanedRule of existingBySource.values()) {
				await ctx.db
					.delete(strategyRules)
					.where(eq(strategyRules.id, orphanedRule.id));
				deleted++;
			}

			return { added, updated, deleted };
		}),

	// Update risk parameters with live saving (for edit mode)
	updateRiskParameters: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				riskParameters: riskParametersSchema.nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId, riskParameters } = input;

			// Verify ownership
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!existingStrategy) {
				throw new Error(ERR_STRATEGY_NOT_FOUND);
			}

			// Update only risk parameters
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					riskParameters: riskParameters
						? JSON.stringify(riskParameters)
						: null,
				})
				.where(eq(strategies.id, strategyId))
				.returning();

			// Sync auto-generated rules
			const scalingRulesConfig: ScalingRules | null =
				existingStrategy.scalingRules
					? JSON.parse(existingStrategy.scalingRules)
					: null;
			const trailingRulesConfig: TrailingRules | null =
				existingStrategy.trailingRules
					? JSON.parse(existingStrategy.trailingRules)
					: null;

			await syncGeneratedRulesInternal(
				ctx.db,
				strategyId,
				riskParameters,
				scalingRulesConfig,
				trailingRulesConfig,
			);

			return updated;
		}),

	// Update scaling rules with live saving (for edit mode)
	updateScalingRules: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				scalingRules: scalingRulesSchema.nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId, scalingRules } = input;

			// Verify ownership
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!existingStrategy) {
				throw new Error(ERR_STRATEGY_NOT_FOUND);
			}

			// Update only scaling rules
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					scalingRules: scalingRules ? JSON.stringify(scalingRules) : null,
				})
				.where(eq(strategies.id, strategyId))
				.returning();

			// Sync auto-generated rules
			const riskParams: RiskParameters | null = existingStrategy.riskParameters
				? JSON.parse(existingStrategy.riskParameters)
				: null;
			const trailingRulesConfig: TrailingRules | null =
				existingStrategy.trailingRules
					? JSON.parse(existingStrategy.trailingRules)
					: null;

			await syncGeneratedRulesInternal(
				ctx.db,
				strategyId,
				riskParams,
				scalingRules,
				trailingRulesConfig,
			);

			return updated;
		}),

	// Update trailing rules with live saving (for edit mode)
	updateTrailingRules: protectedProcedure
		.input(
			z.object({
				strategyId: z.string(),
				trailingRules: trailingRulesSchema.nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { strategyId, trailingRules } = input;

			// Verify ownership
			const existingStrategy = await ctx.db.query.strategies.findFirst({
				where: and(
					eq(strategies.id, strategyId),
					eq(strategies.userId, ctx.user.id),
				),
			});

			if (!existingStrategy) {
				throw new Error(ERR_STRATEGY_NOT_FOUND);
			}

			// Update only trailing rules
			const [updated] = await ctx.db
				.update(strategies)
				.set({
					trailingRules: trailingRules ? JSON.stringify(trailingRules) : null,
				})
				.where(eq(strategies.id, strategyId))
				.returning();

			// Sync auto-generated rules
			const riskParams: RiskParameters | null = existingStrategy.riskParameters
				? JSON.parse(existingStrategy.riskParameters)
				: null;
			const scalingRulesConfig: ScalingRules | null =
				existingStrategy.scalingRules
					? JSON.parse(existingStrategy.scalingRules)
					: null;

			await syncGeneratedRulesInternal(
				ctx.db,
				strategyId,
				riskParams,
				scalingRulesConfig,
				trailingRules,
			);

			return updated;
		}),

	// Auto-evaluate rules for a trade
	evaluateTradeRules: protectedProcedure
		.input(z.object({ tradeId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Fetch trade with strategy and rules, verify ownership
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
					isNull(trades.deletedAt),
				),
				with: {
					strategy: {
						with: {
							rules: {
								orderBy: [strategyRules.order],
							},
						},
					},
					account: true,
				},
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			if (!trade.strategy) {
				throw new Error(ERR_TRADE_NO_STRATEGY);
			}

			// Filter to rules that should be auto-evaluated (not manual)
			const rulesToEvaluate = trade.strategy.rules.filter(
				(rule) => rule.ruleType !== "manual",
			);

			if (rulesToEvaluate.length === 0) {
				return { evaluated: 0, results: [] };
			}

			// Fetch existing checks with user overrides - we won't overwrite these
			const existingOverrides = await ctx.db.query.tradeRuleChecks.findMany({
				where: and(
					eq(tradeRuleChecks.tradeId, input.tradeId),
					eq(tradeRuleChecks.userOverride, true),
				),
			});
			const overriddenRuleIds = new Set(existingOverrides.map((c) => c.ruleId));

			// Build evaluation context with all required data
			const context = await buildEvaluationContext(
				ctx.db,
				{
					id: trade.id,
					userId: trade.userId,
					accountId: trade.accountId,
					symbol: trade.symbol,
					direction: trade.direction,
					entryPrice: trade.entryPrice,
					exitPrice: trade.exitPrice,
					entryTime: trade.entryTime,
					exitTime: trade.exitTime,
					quantity: trade.quantity,
					stopLoss: trade.stopLoss,
					takeProfit: trade.takeProfit,
					trailedStopLoss: trade.trailedStopLoss,
					wasTrailed: trade.wasTrailed,
					netPnl: trade.netPnl,
					mfePrice: trade.mfePrice,
					mfeAmount: trade.mfeAmount,
					status: trade.status,
				},
				ctx.user.id,
			);

			// Evaluate each rule and collect results
			const results: Array<{
				ruleId: string;
				result: AutoEvaluationResult;
			}> = [];

			for (const rule of rulesToEvaluate) {
				// Skip rules without auto condition
				if (!rule.autoCondition) {
					continue;
				}

				// Skip rules that user has manually overridden
				if (overriddenRuleIds.has(rule.id)) {
					continue;
				}

				// Parse the auto condition JSON
				let condition: AutoCondition;
				try {
					condition = JSON.parse(rule.autoCondition) as AutoCondition;
				} catch {
					// Invalid JSON, skip this rule
					continue;
				}

				// Evaluate the condition
				const result = evaluateAutoCondition(
					condition,
					{
						id: trade.id,
						symbol: trade.symbol,
						direction: trade.direction,
						entryPrice: trade.entryPrice,
						exitPrice: trade.exitPrice,
						quantity: trade.quantity,
						stopLoss: trade.stopLoss,
						takeProfit: trade.takeProfit,
						trailedStopLoss: trade.trailedStopLoss,
						wasTrailed: trade.wasTrailed,
						netPnl: trade.netPnl,
						mfePrice: trade.mfePrice,
						mfeAmount: trade.mfeAmount,
					},
					context,
				);

				results.push({ ruleId: rule.id, result });

				// Upsert the trade rule check with evaluation result
				await ctx.db
					.insert(tradeRuleChecks)
					.values({
						tradeId: input.tradeId,
						ruleId: rule.id,
						checked: result.passed,
						checkedAt: new Date(),
						evaluationResult: JSON.stringify(result),
						wasAutoEvaluated: true,
					})
					.onConflictDoUpdate({
						target: [tradeRuleChecks.tradeId, tradeRuleChecks.ruleId],
						set: {
							checked: result.passed,
							checkedAt: new Date(),
							evaluationResult: JSON.stringify(result),
							wasAutoEvaluated: true,
						},
					});
			}

			return {
				evaluated: results.length,
				results: results.map((r) => ({
					ruleId: r.ruleId,
					...r.result,
				})),
			};
		}),

	// Get dashboard-level rule compliance for a date range
	// Returns overall compliance, breakdown by category, and top violations
	getDashboardRuleCompliance: protectedProcedure
		.input(
			z.object({
				accountId: z.string().optional(), // Optional account filter
				startDate: z.string(), // YYYY-MM-DD date string
				endDate: z.string(), // YYYY-MM-DD date string
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get user timezone for trade filtering
			const { getUserTimezone } = await import("@/server/api/helpers");
			const { getDayBoundsInTimezone } = await import("@/lib/shared");

			const userTimezone = await getUserTimezone(ctx.db, ctx.user.id);

			// Get date bounds in user's timezone
			const startDateStr = input.startDate.split("T")[0] ?? input.startDate;
			const endDateStr = input.endDate.split("T")[0] ?? input.endDate;

			const { start: rangeStart } = getDayBoundsInTimezone(
				startDateStr,
				userTimezone,
			);
			const { end: rangeEnd } = getDayBoundsInTimezone(
				endDateStr,
				userTimezone,
			);

			// Build trade query conditions
			const tradeConditions = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				gte(trades.entryTime, rangeStart),
				lt(trades.entryTime, rangeEnd),
			];

			// Filter by account if specified
			if (input.accountId) {
				tradeConditions.push(eq(trades.accountId, input.accountId));
			}

			// Get all closed trades in the date range with their rule checks
			const tradesInRange = await ctx.db.query.trades.findMany({
				where: and(...tradeConditions),
				with: {
					ruleChecks: {
						with: {
							rule: true,
						},
					},
					strategy: {
						with: {
							rules: true,
						},
					},
				},
			});

			// Filter to only trades that have a strategy with rules
			const tradesWithStrategies = tradesInRange.filter(
				(trade) => trade.strategy && trade.strategy.rules.length > 0,
			);

			if (tradesWithStrategies.length === 0) {
				return {
					overall: 100,
					byCategory: {
						entry: 100,
						exit: 100,
						risk: 100,
						management: 100,
					},
					violations: [],
					totalTrades: 0,
					tradesWithStrategies: 0,
				};
			}

			// Calculate compliance per trade and aggregate
			let totalChecks = 0;
			let passedChecks = 0;

			// Track by category with explicit type
			type CategoryKey = "entry" | "exit" | "risk" | "management";
			const categoryStats: Record<
				CategoryKey,
				{ total: number; passed: number }
			> = {
				entry: { total: 0, passed: 0 },
				exit: { total: 0, passed: 0 },
				risk: { total: 0, passed: 0 },
				management: { total: 0, passed: 0 },
			};

			// Track violations per rule
			const ruleViolations: Map<
				string,
				{
					ruleId: string;
					ruleName: string;
					ruleCategory: string;
					count: number;
				}
			> = new Map();

			for (const trade of tradesWithStrategies) {
				const strategy = trade.strategy;
				if (!strategy) continue;

				// For each rule in the strategy, check if it was followed
				for (const rule of strategy.rules) {
					const ruleCheck = trade.ruleChecks.find(
						(rc) => rc.ruleId === rule.id,
					);

					// Count this rule as a check
					totalChecks++;
					const category = rule.category as CategoryKey;
					categoryStats[category].total++;

					// Check if the rule was followed
					const wasFollowed = ruleCheck?.checked ?? false;

					if (wasFollowed) {
						passedChecks++;
						categoryStats[category].passed++;
					} else {
						// Track the violation
						const existing = ruleViolations.get(rule.id);
						if (existing) {
							existing.count++;
						} else {
							ruleViolations.set(rule.id, {
								ruleId: rule.id,
								ruleName: rule.text,
								ruleCategory: rule.category,
								count: 1,
							});
						}
					}
				}
			}

			// Calculate percentages
			const overall =
				totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;

			const byCategory = {
				entry:
					categoryStats.entry.total > 0
						? (categoryStats.entry.passed / categoryStats.entry.total) * 100
						: 100,
				exit:
					categoryStats.exit.total > 0
						? (categoryStats.exit.passed / categoryStats.exit.total) * 100
						: 100,
				risk:
					categoryStats.risk.total > 0
						? (categoryStats.risk.passed / categoryStats.risk.total) * 100
						: 100,
				management:
					categoryStats.management.total > 0
						? (categoryStats.management.passed /
								categoryStats.management.total) *
							100
						: 100,
			};

			// Sort violations by count (most frequent first)
			const violations = Array.from(ruleViolations.values()).sort(
				(a, b) => b.count - a.count,
			);

			return {
				overall: Math.round(overall * 100) / 100,
				byCategory: {
					entry: Math.round(byCategory.entry * 100) / 100,
					exit: Math.round(byCategory.exit * 100) / 100,
					risk: Math.round(byCategory.risk * 100) / 100,
					management: Math.round(byCategory.management * 100) / 100,
				},
				violations,
				totalTrades: tradesInRange.length,
				tradesWithStrategies: tradesWithStrategies.length,
			};
		}),
});
