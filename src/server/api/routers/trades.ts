import {
	and,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { calculateAggregateStats } from "@/lib/analytics";
import {
	FEATURE_CSV_IMPORT_EXPORT,
	FEATURE_TRADE_MANAGEMENT,
} from "@/lib/constants/billing";
import {
	ERR_ATTACHMENT_CREATE_FAILED,
	ERR_ATTACHMENT_NOT_FOUND,
	ERR_DELETED_TRADE_NOT_FOUND,
	ERR_EXECUTION_NOT_FOUND,
	ERR_MAEMFE_CALCULATE_FAILED,
	ERR_S3_NOT_CONFIGURED,
	ERR_TRADE_NOT_FOUND,
	ERR_TRADES_BULK_NOT_FOUND,
} from "@/lib/constants/errors";
import {
	SEARCH_DEFAULT_LIMIT,
	SEARCH_MIN_QUERY_LENGTH,
} from "@/lib/constants/search";
import type { SortField } from "@/lib/constants/trade-log";
import { logger } from "@/lib/logger";
import { calculateAndStoreMAEMFE } from "@/lib/market-data/maemfe";
import {
	directionEnum,
	emotionalStateEnum,
	executionTypeEnum,
	exitReasonEnum,
	tradeStatusEnum,
} from "@/lib/shared";
import {
	deleteObject,
	getPresignedDownloadUrl,
	getPresignedUploadUrl,
	isS3Configured,
	transformHtmlWithPresignedUrls,
} from "@/lib/storage/s3";
import { buildEvaluationContext, evaluateAutoCondition } from "@/lib/strategy";
import type { AutoCondition } from "@/lib/strategy/types";
import { calculateActualRMultiple } from "@/lib/trades/calculations";
import { computeTradeHash } from "@/lib/trades/hash";
import { updateTradeSearchVector } from "@/lib/trades/search";
import {
	getActiveAccountsSubquery,
	getUserBreakevenThreshold,
} from "@/server/api/helpers";
import {
	decodeCursor,
	encodeCursor,
	extractSortValue,
} from "@/server/api/helpers/cursor";
import {
	buildCursorCondition,
	buildOrderByClause,
} from "@/server/api/helpers/sort-builder";
import {
	createTRPCRouter,
	protectedProcedure,
	requireFeature,
} from "@/server/api/trpc";
import type { db as DbType } from "@/server/db";
import {
	strategyRules,
	tradeAttachments,
	tradeExecutions,
	tradeRuleChecks,
	trades,
	tradeTags,
} from "@/server/db/schema";
import { processTradeMAEMFE } from "@/trigger/process-trade-maemfe";

// Database type for helper function
type Db = typeof DbType;

// Type for attachment from database
interface AttachmentRecord {
	id: string;
	tradeId: string;
	url: string; // Contains S3 key
	key: string;
	filename: string;
	mimeType: string;
	size: number;
	caption: string | null;
	createdAt: Date;
}

// Helper to generate presigned URLs for attachments on-demand
function withPresignedUrls<T extends { attachments: AttachmentRecord[] }>(
	trade: T,
): T {
	if (!isS3Configured()) {
		return trade;
	}

	return {
		...trade,
		attachments: trade.attachments.map((attachment) => ({
			...attachment,
			// Generate fresh presigned URL from the stored key
			url: getPresignedDownloadUrl(attachment.key ?? attachment.url, 3600), // 1 hour expiry
		})),
	};
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Auto-evaluate strategy rules when a trade is closed.
 * Evaluates non-manual rules and stores results in tradeRuleChecks.
 * Errors are caught and logged - they should not prevent trade close.
 *
 * @param db - Drizzle database instance
 * @param tradeId - The ID of the trade that was closed
 * @param userId - The user's ID
 */
async function autoEvaluateTradeRules(
	db: Db,
	tradeId: string,
	userId: string,
): Promise<void> {
	try {
		// Fetch the closed trade with strategy and rules
		const trade = await db.query.trades.findFirst({
			where: and(
				eq(trades.id, tradeId),
				eq(trades.userId, userId),
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
			},
		});

		// Skip if trade not found or has no strategy
		if (!trade || !trade.strategy) {
			return;
		}

		// Filter to rules that should be auto-evaluated (not manual)
		const rulesToEvaluate = trade.strategy.rules.filter(
			(rule) => rule.ruleType !== "manual",
		);

		if (rulesToEvaluate.length === 0) {
			return;
		}

		// Build evaluation context with all required data
		const context = await buildEvaluationContext(
			db,
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
			userId,
		);

		// Evaluate each rule
		for (const rule of rulesToEvaluate) {
			// Skip rules without auto condition
			if (!rule.autoCondition) {
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

			// Upsert the trade rule check with evaluation result
			await db
				.insert(tradeRuleChecks)
				.values({
					tradeId,
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
						// Don't update userOverride - preserve existing overrides
					},
				});
		}
	} catch (error) {
		// Log but don't throw — trade close should not fail due to evaluation errors
		logger.error("Failed to auto-evaluate trade rules", error, {
			tradeId,
			userId,
		});
	}
}

// Input schemas
const createTradeSchema = z.object({
	symbol: z.string().min(1),
	direction: directionEnum,
	entryPrice: z.string(),
	entryTime: z.iso.datetime(),
	quantity: z.string(),
	// Exit fields (for closed trades)
	exitPrice: z.string().optional(),
	exitTime: z.iso.datetime().optional(),
	// P&L (user-provided for closed trades)
	realizedPnl: z.string().optional(), // User provides PnL directly
	// Risk management
	stopLoss: z.string().optional(),
	takeProfit: z.string().optional(),
	// Fees
	fees: z.string().optional(),
	// Metadata
	setupType: z.string().optional(),
	emotionalState: emotionalStateEnum.optional(),
	notes: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	accountId: z.string(), // Required: Link to trading account
	externalId: z.string().optional(), // For tracking imported trades
	strategyId: z.string().optional(), // Link to strategy
});

const updateTradeSchema = z.object({
	id: z.string(),
	symbol: z.string().optional(),
	direction: directionEnum.optional(),
	entryPrice: z.string().optional(),
	exitPrice: z.string().optional(),
	exitTime: z.iso.datetime().optional(),
	quantity: z.string().optional(),
	stopLoss: z.string().optional(),
	takeProfit: z.string().optional(),
	stopLossHit: z.boolean().optional(),
	takeProfitHit: z.boolean().optional(),
	realizedPnl: z.string().optional(),
	fees: z.string().optional(),
	netPnl: z.string().optional(),
	setupType: z.string().optional(),
	emotionalState: emotionalStateEnum.nullish(),
	notes: z.string().optional(),
	status: tradeStatusEnum.optional(),
	// Trailing stop fields
	trailedStopLoss: z.string().nullish(),
	wasTrailed: z.boolean().optional(),
	// Exit reason
	exitReason: exitReasonEnum.nullish(),
	// Rating and review
	rating: z.number().min(1).max(5).optional().nullable(),
	isReviewed: z.boolean().optional(),
	// Strategy
	strategyId: z.string().nullish(),
});

// Schema for adding a partial exit / execution
const addExecutionSchema = z.object({
	tradeId: z.string(),
	executionType: executionTypeEnum,
	price: z.string(),
	quantity: z.string(),
	executedAt: z.iso.datetime(),
	fees: z.string().optional(),
	notes: z.string().optional(),
	realizedPnl: z.string().optional(), // User provides PnL for exit/scale_out
});

// Batch import schema for CSV imports
const batchImportTradeSchema = z.object({
	symbol: z.string().min(1),
	direction: directionEnum,
	entryPrice: z.string(),
	entryTime: z.string(), // ISO string
	exitPrice: z.string().optional(),
	exitTime: z.string().optional(), // ISO string
	quantity: z.string(),
	stopLoss: z.string().optional(),
	takeProfit: z.string().optional(),
	stopLossHit: z.boolean().optional(), // Pre-determined from orders data
	takeProfitHit: z.boolean().optional(), // Pre-determined from orders data
	fees: z.string().optional(),
	notes: z.string().optional(),
	externalId: z.string().optional(),
	profit: z.string().optional(), // Broker-reported profit (use this instead of calculating)
});

const batchImportSchema = z.object({
	accountId: z.string(),
	trades: z.array(batchImportTradeSchema).min(1).max(1000), // Limit batch size
});

export const tradesRouter = createTRPCRouter({
	// Get all trades for current user
	getAll: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).default(50),
					cursor: z.string().nullish(),
					direction: z.enum(["forward", "backward"]).optional(), // tRPC infinite query pagination direction
					status: tradeStatusEnum.nullish(),
					symbol: z.string().nullish(),
					tradeDirection: directionEnum.nullish(),
					startDate: z.iso.datetime().nullish(),
					endDate: z.iso.datetime().nullish(),
					accountId: z.string().nullish(),
					search: z.string().nullish(), // Server-side search
					includeDeleted: z.boolean().nullish(), // Include soft-deleted trades
					// Advanced filters
					result: z.enum(["win", "loss", "breakeven"]).nullish(), // Filter-specific, not a DB enum
					minPnl: z.number().nullish(),
					maxPnl: z.number().nullish(),
					rating: z.number().min(1).max(5).nullish(),
					minRating: z.number().min(1).max(5).nullish(),
					maxRating: z.number().min(1).max(5).nullish(),
					isReviewed: z.boolean().nullish(),
					setupType: z.string().nullish(),
					dayOfWeek: z.array(z.number().min(0).max(6)).nullish(), // 0=Sunday, 6=Saturday
					tagIds: z.array(z.string()).nullish(),
					exitReason: exitReasonEnum.nullish(),
					strategyId: z.string().nullish(),
					minRMultiple: z.number().nullish(),
					maxRMultiple: z.number().nullish(),
					// Server-side sorting
					sortField: z
						.enum([
							"symbol",
							"side",
							"entry",
							"exit",
							"size",
							"pnl",
							"result",
							"rating",
							"reviewed",
							"setup",
							"fees",
							"duration",
							"account",
							"strategy",
							"rMultiple",
						])
						.default("entry"),
					sortDirection: z.enum(["asc", "desc"]).default("desc"),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const limit = input?.limit ?? 50;
			const sortField = (input?.sortField ?? "entry") as SortField;
			const sortDirection = input?.sortDirection ?? "desc";

			const conditions = [eq(trades.userId, ctx.user.id)];

			// Exclude deleted trades by default
			if (!input?.includeDeleted) {
				conditions.push(isNull(trades.deletedAt));
			}

			// Filter by account if specified, otherwise only include trades from active accounts
			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				// Only include trades from active accounts when querying across all accounts
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}
			if (input?.status) {
				conditions.push(eq(trades.status, input.status));
			}
			if (input?.symbol) {
				conditions.push(ilike(trades.symbol, `%${input.symbol}%`));
			}
			if (input?.tradeDirection) {
				conditions.push(eq(trades.direction, input.tradeDirection));
			}
			if (input?.startDate) {
				conditions.push(gte(trades.entryTime, new Date(input.startDate)));
			}
			if (input?.endDate) {
				// Set to end of day to make the end date inclusive
				const endOfDay = new Date(input.endDate);
				endOfDay.setHours(23, 59, 59, 999);
				conditions.push(lte(trades.entryTime, endOfDay));
			}
			// Server-side search: symbol, setupType, or notes
			if (input?.search) {
				const searchTerm = `%${input.search}%`;
				const searchCondition = or(
					ilike(trades.symbol, searchTerm),
					ilike(trades.setupType, searchTerm),
					ilike(trades.notes, searchTerm),
				);
				if (searchCondition) {
					conditions.push(searchCondition);
				}
			}

			// Advanced filters
			if (input?.minPnl != null) {
				conditions.push(gte(trades.netPnl, input.minPnl.toString()));
			}
			if (input?.maxPnl != null) {
				conditions.push(lte(trades.netPnl, input.maxPnl.toString()));
			}
			if (input?.rating != null) {
				conditions.push(eq(trades.rating, input.rating));
			}
			if (input?.minRating != null) {
				conditions.push(gte(trades.rating, input.minRating));
			}
			if (input?.maxRating != null) {
				conditions.push(lte(trades.rating, input.maxRating));
			}
			if (input?.isReviewed != null) {
				conditions.push(eq(trades.isReviewed, input.isReviewed));
			}
			if (input?.setupType) {
				conditions.push(eq(trades.setupType, input.setupType));
			}
			if (input?.exitReason) {
				conditions.push(eq(trades.exitReason, input.exitReason));
			}
			if (input?.strategyId) {
				conditions.push(eq(trades.strategyId, input.strategyId));
			}
			if (input?.dayOfWeek && input.dayOfWeek.length > 0) {
				// PostgreSQL EXTRACT(DOW FROM date) returns 0=Sunday, 6=Saturday
				const dayConditions = input.dayOfWeek.map(
					(day) => sql`EXTRACT(DOW FROM ${trades.entryTime}) = ${day}`,
				);
				const dayFilter = or(...dayConditions);
				if (dayFilter) {
					conditions.push(dayFilter);
				}
			}

			// Handle compound cursor for sorted pagination
			if (input?.cursor) {
				try {
					const cursor = decodeCursor(input.cursor);
					conditions.push(
						buildCursorCondition(
							cursor.sortValue,
							cursor.id,
							sortField,
							sortDirection,
						),
					);
				} catch {
					// Invalid cursor, ignore and start from beginning
				}
			}

			// Build dynamic ORDER BY clause
			const orderByClause = buildOrderByClause(sortField, sortDirection);

			let items = await ctx.db.query.trades.findMany({
				where: and(...conditions),
				orderBy: orderByClause,
				limit: limit + 1,
				with: {
					tradeTags: {
						with: {
							tag: true,
						},
					},
					account: true,
					strategy: true,
				},
			});

			// Filter by tag IDs (post-query filter since it's a junction table)
			if (input?.tagIds && input.tagIds.length > 0) {
				const filterTagIds = input.tagIds;
				items = items.filter((trade) => {
					const tradeTagIds = trade.tradeTags.map((tt) => tt.tagId);
					return filterTagIds.some((id) => tradeTagIds.includes(id));
				});
			}

			// Filter by result (win/loss/breakeven) post-query
			if (input?.result) {
				const beThreshold = await getUserBreakevenThreshold(
					ctx.db,
					ctx.user.id,
				);
				items = items.filter((trade) => {
					const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
					if (input.result === "win") return pnl > beThreshold;
					if (input.result === "loss") return pnl < -beThreshold;
					return Math.abs(pnl) <= beThreshold;
				});
			}

			// Filter by R-Multiple post-query (requires entryPrice, stopLoss, netPnl, quantity)
			if (input?.minRMultiple != null || input?.maxRMultiple != null) {
				items = items.filter((trade) => {
					// R-Multiple requires stop loss, net P&L, and quantity
					if (!trade.stopLoss || !trade.netPnl || !trade.quantity) {
						return false;
					}

					// Use shared utility for consistent R-multiple calculation
					const rMultiple = calculateActualRMultiple(
						parseFloat(trade.netPnl),
						parseFloat(trade.entryPrice),
						parseFloat(trade.stopLoss),
						parseFloat(trade.quantity),
						trade.symbol,
					);

					if (rMultiple === null) return false;

					if (input.minRMultiple != null && rMultiple < input.minRMultiple) {
						return false;
					}
					if (input.maxRMultiple != null && rMultiple > input.maxRMultiple) {
						return false;
					}
					return true;
				});
			}

			let nextCursor: string | undefined;
			if (items.length > limit) {
				const nextItem = items.pop();
				if (nextItem) {
					// Create compound cursor with sort value for deterministic pagination
					const sortValue = extractSortValue(nextItem, sortField);
					nextCursor = encodeCursor({ sortValue, id: nextItem.id });
				}
			}

			// Transform S3 keys in notes to presigned URLs for each item
			const transformedItems = items.map((item) => ({
				...item,
				notes: transformHtmlWithPresignedUrls(item.notes),
			}));

			return {
				items: transformedItems,
				nextCursor,
			};
		}),

	// Get a single trade by ID
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const trade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
				with: {
					executions: true,
					tradeTags: {
						with: {
							tag: true,
						},
					},
					account: true,
					strategy: true,
					ruleChecks: true,
					attachments: true,
				},
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			// Transform S3 keys in notes and attachments to presigned URLs
			const tradeWithPresignedAttachments = withPresignedUrls(trade);
			return {
				...tradeWithPresignedAttachments,
				notes: transformHtmlWithPresignedUrls(trade.notes),
			};
		}),

	// Create a new trade
	// User provides PnL directly for closed trades (we don't calculate it)
	create: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(createTradeSchema)
		.mutation(async ({ ctx, input }) => {
			const { tagIds, externalId, realizedPnl: inputPnl, ...tradeData } = input;

			// Determine if trade is closed (has exit price)
			const isClosed = !!input.exitPrice && !!input.exitTime;

			// Use user-provided PnL
			const fees = parseFloat(input.fees || "0");
			const realizedPnl = inputPnl || null;
			const netPnl =
				realizedPnl !== null
					? (parseFloat(realizedPnl) - fees).toFixed(2)
					: null;

			// Check if SL/TP was hit based on exit price
			let stopLossHit = false;
			let takeProfitHit = false;

			if (isClosed && input.exitPrice) {
				if (input.stopLoss) {
					const sl = parseFloat(input.stopLoss);
					const exit = parseFloat(input.exitPrice);
					if (input.direction === "long") {
						stopLossHit = exit <= sl;
					} else {
						stopLossHit = exit >= sl;
					}
				}
				if (input.takeProfit) {
					const tp = parseFloat(input.takeProfit);
					const exit = parseFloat(input.exitPrice);
					if (input.direction === "long") {
						takeProfitHit = exit >= tp;
					} else {
						takeProfitHit = exit <= tp;
					}
				}
			}

			const [newTrade] = await ctx.db
				.insert(trades)
				.values({
					...tradeData,
					userId: ctx.user.id,
					entryTime: new Date(input.entryTime),
					exitTime: input.exitTime ? new Date(input.exitTime) : null,
					status: isClosed ? "closed" : "open",
					importSource: externalId ? "csv" : "manual",
					externalId: externalId || null,
					realizedPnl,
					netPnl,
					stopLossHit,
					takeProfitHit,
				})
				.returning();

			// Add tags if provided
			if (tagIds && tagIds.length > 0 && newTrade) {
				await ctx.db.insert(tradeTags).values(
					tagIds.map((tagId) => ({
						tradeId: newTrade.id,
						tagId,
					})),
				);
			}

			// Update search vector if trade has notes (non-blocking)
			if (newTrade?.notes) {
				updateTradeSearchVector(ctx.db, {
					tradeId: newTrade.id,
					notes: newTrade.notes,
				}).catch((err) =>
					logger.error("Failed to update trade search vector", err, {
						tradeId: newTrade.id,
					}),
				);
			}

			return newTrade;
		}),

	// Batch import trades (much faster for CSV imports)
	// Uses broker-reported profit instead of calculating PnL ourselves
	batchImport: requireFeature(FEATURE_CSV_IMPORT_EXPORT)
		.input(batchImportSchema)
		.mutation(async ({ ctx, input }) => {
			const { accountId, trades: tradesToImport } = input;

			// Prepare all trade records using broker-provided profit
			const tradeRecords = tradesToImport.map((trade) => {
				const isClosed = !!trade.exitPrice && !!trade.exitTime;

				// Use broker-reported profit directly
				const fees = parseFloat(trade.fees || "0");
				const realizedPnl = trade.profit || null;
				const netPnl =
					realizedPnl !== null
						? (parseFloat(realizedPnl) - fees).toFixed(2)
						: null;

				// Use provided SL/TP hit values if available (from Orders CSV), otherwise determine from exit price
				let stopLossHit = trade.stopLossHit ?? false;
				let takeProfitHit = trade.takeProfitHit ?? false;

				if (isClosed && trade.exitPrice) {
					// Only determine SL/TP hit if not already provided
					if (trade.stopLossHit === undefined && trade.stopLoss) {
						const sl = parseFloat(trade.stopLoss);
						const exit = parseFloat(trade.exitPrice);
						if (trade.direction === "long") {
							stopLossHit = exit <= sl;
						} else {
							stopLossHit = exit >= sl;
						}
					}
					if (trade.takeProfitHit === undefined && trade.takeProfit) {
						const tp = parseFloat(trade.takeProfit);
						const exit = parseFloat(trade.exitPrice);
						if (trade.direction === "long") {
							takeProfitHit = exit >= tp;
						} else {
							takeProfitHit = exit <= tp;
						}
					}
				}

				// Compute trade hash for duplicate detection (only for closed trades)
				// Open trades without exit data cannot be reliably deduplicated
				let tradeHash: string | null = null;
				if (isClosed && trade.exitPrice && trade.exitTime) {
					tradeHash = computeTradeHash({
						accountId,
						symbol: trade.symbol,
						direction: trade.direction,
						entryPrice: trade.entryPrice,
						entryTime: new Date(trade.entryTime),
						exitPrice: trade.exitPrice,
						exitTime: new Date(trade.exitTime),
						quantity: trade.quantity,
					});
				}

				return {
					userId: ctx.user.id,
					accountId,
					symbol: trade.symbol,
					direction: trade.direction,
					entryPrice: trade.entryPrice,
					entryTime: new Date(trade.entryTime),
					exitPrice: trade.exitPrice || null,
					exitTime: trade.exitTime ? new Date(trade.exitTime) : null,
					quantity: trade.quantity,
					stopLoss: trade.stopLoss || null,
					takeProfit: trade.takeProfit || null,
					fees: trade.fees || null,
					notes: trade.notes || null,
					externalId: trade.externalId || null,
					status: isClosed ? ("closed" as const) : ("open" as const),
					importSource: "csv" as const,
					realizedPnl,
					netPnl,
					stopLossHit,
					takeProfitHit,
					tradeHash,
				};
			});

			// Collect hashes for duplicate detection (only non-null hashes)
			const hashesToCheck = tradeRecords
				.map((r) => r.tradeHash)
				.filter((hash): hash is string => hash !== null);

			// Query for existing trades with these hashes in the same account
			let existingHashes = new Set<string>();
			if (hashesToCheck.length > 0) {
				const existingTrades = await ctx.db
					.select({ tradeHash: trades.tradeHash })
					.from(trades)
					.where(
						and(
							eq(trades.accountId, accountId),
							eq(trades.userId, ctx.user.id),
							isNull(trades.deletedAt),
							inArray(trades.tradeHash, hashesToCheck),
						),
					);
				existingHashes = new Set(
					existingTrades
						.map((t) => t.tradeHash)
						.filter((h): h is string => h !== null),
				);
			}

			// Filter out duplicates (trades whose hash already exists)
			const newTradeRecords = tradeRecords.filter((record) => {
				// If no hash (open trade), always include
				if (record.tradeHash === null) {
					return true;
				}
				// If hash exists in database, skip (duplicate)
				return !existingHashes.has(record.tradeHash);
			});

			// Track skipped count
			const skippedCount = tradeRecords.length - newTradeRecords.length;

			// Insert only non-duplicate trades
			let insertedTrades: { id: string; status: "open" | "closed" }[] = [];
			if (newTradeRecords.length > 0) {
				insertedTrades = await ctx.db
					.insert(trades)
					.values(newTradeRecords)
					.returning({ id: trades.id, status: trades.status });
			}

			// Get IDs of closed trades that need MAE/MFE calculation
			const closedTradeIds = insertedTrades
				.filter((t) => t.status === "closed")
				.map((t) => t.id);

			// Trigger background jobs to calculate MAE/MFE via Trigger.dev
			// batchTrigger supports up to 1000 payloads per call
			if (closedTradeIds.length > 0) {
				const BATCH_SIZE = 1000;
				for (let i = 0; i < closedTradeIds.length; i += BATCH_SIZE) {
					const batch = closedTradeIds.slice(i, i + BATCH_SIZE);
					await processTradeMAEMFE.batchTrigger(
						batch.map((tradeId) => ({
							payload: { tradeId, userId: ctx.user.id },
						})),
					);
				}
			}

			return {
				imported: insertedTrades.length,
				skipped: skippedCount,
				total: tradesToImport.length,
				tradeIds: insertedTrades.map((t) => t.id),
				processingCount: closedTradeIds.length,
			};
		}),

	// Update a trade
	// Note: For imported trades, core fields (price, quantity, PnL) should be locked on the frontend.
	// PnL is NOT recalculated - we trust the broker's reported PnL for imports,
	// and for manual trades, users provide PnL directly.
	update: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(updateTradeSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			// Verify ownership
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			// Check if trade is being closed (status changing to 'closed')
			const isBeingClosed =
				updateData.status === "closed" && existingTrade.status !== "closed";

			const [updated] = await ctx.db
				.update(trades)
				.set({
					...updateData,
					exitTime: updateData.exitTime
						? new Date(updateData.exitTime)
						: undefined,
				})
				.where(eq(trades.id, id))
				.returning();

			// Auto-evaluate strategy rules when trade is closed
			if (isBeingClosed && existingTrade.strategyId) {
				await autoEvaluateTradeRules(ctx.db, id, ctx.user.id);
			}

			// Update search vector if notes changed (non-blocking)
			if (updateData.notes !== undefined && updated) {
				updateTradeSearchVector(ctx.db, {
					tradeId: id,
					notes: updated.notes,
				}).catch((err) =>
					logger.error("Failed to update trade search vector", err, {
						tradeId: id,
					}),
				);
			}

			return updated;
		}),

	// Close a trade
	// User provides the realized PnL directly (we don't calculate it)
	// Ungated: users must be able to close existing open trades even after downgrading
	close: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				exitPrice: z.string(),
				exitTime: z.iso.datetime(),
				fees: z.string().optional(),
				realizedPnl: z.string(), // User provides PnL directly
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			const fees = parseFloat(input.fees ?? "0");
			const realizedPnl = parseFloat(input.realizedPnl);
			const netPnl = realizedPnl - fees;
			const exitPrice = parseFloat(input.exitPrice);

			// Check if SL/TP was hit based on exit price
			const stopLossHit =
				existingTrade.stopLoss &&
				((existingTrade.direction === "long" &&
					exitPrice <= parseFloat(existingTrade.stopLoss)) ||
					(existingTrade.direction === "short" &&
						exitPrice >= parseFloat(existingTrade.stopLoss)));

			const takeProfitHit =
				existingTrade.takeProfit &&
				((existingTrade.direction === "long" &&
					exitPrice >= parseFloat(existingTrade.takeProfit)) ||
					(existingTrade.direction === "short" &&
						exitPrice <= parseFloat(existingTrade.takeProfit)));

			const [updated] = await ctx.db
				.update(trades)
				.set({
					exitPrice: input.exitPrice,
					exitTime: new Date(input.exitTime),
					status: "closed",
					realizedPnl: realizedPnl.toString(),
					fees: fees.toString(),
					netPnl: netPnl.toString(),
					stopLossHit: Boolean(stopLossHit),
					takeProfitHit: Boolean(takeProfitHit),
				})
				.where(eq(trades.id, input.id))
				.returning();

			// Auto-evaluate strategy rules after trade is closed
			// This runs in the background after the trade is saved with final data
			if (existingTrade.strategyId) {
				await autoEvaluateTradeRules(ctx.db, input.id, ctx.user.id);
			}

			return updated;
		}),

	// Soft delete a trade
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			// Soft delete by setting deletedAt timestamp
			await ctx.db
				.update(trades)
				.set({ deletedAt: new Date() })
				.where(eq(trades.id, input.id));

			return { success: true };
		}),

	// Bulk soft delete trades
	deleteMany: protectedProcedure
		.input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
		.mutation(async ({ ctx, input }) => {
			// Verify all trades belong to user before deleting
			const existingTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					sql`${trades.id} IN (${sql.join(
						input.ids.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			});

			if (existingTrades.length !== input.ids.length) {
				throw new Error(ERR_TRADES_BULK_NOT_FOUND);
			}

			// Soft delete all
			await ctx.db
				.update(trades)
				.set({ deletedAt: new Date() })
				.where(
					and(
						eq(trades.userId, ctx.user.id),
						sql`${trades.id} IN (${sql.join(
							input.ids.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					),
				);

			return { success: true, deleted: input.ids.length };
		}),

	// Restore a soft-deleted trade
	restore: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.id),
					eq(trades.userId, ctx.user.id),
					isNotNull(trades.deletedAt),
				),
			});

			if (!existingTrade) {
				throw new Error(ERR_DELETED_TRADE_NOT_FOUND);
			}

			await ctx.db
				.update(trades)
				.set({ deletedAt: null })
				.where(eq(trades.id, input.id));

			return { success: true };
		}),

	// Permanently delete a trade (hard delete)
	permanentDelete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			await ctx.db.delete(trades).where(eq(trades.id, input.id));
			return { success: true };
		}),

	// Empty trash - permanently delete all trashed trades
	emptyTrash: protectedProcedure
		.input(z.object({ accountId: z.string().optional() }).optional())
		.mutation(async ({ ctx, input }) => {
			const conditions = [
				eq(trades.userId, ctx.user.id),
				isNotNull(trades.deletedAt),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			}

			const result = await ctx.db
				.delete(trades)
				.where(and(...conditions))
				.returning({ id: trades.id });

			return { success: true, deleted: result.length };
		}),

	// Get deleted trades (trash)
	getDeleted: protectedProcedure
		.input(
			z
				.object({
					accountId: z.string().optional(),
					limit: z.number().min(1).max(100).default(50),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(trades.userId, ctx.user.id),
				isNotNull(trades.deletedAt),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			}

			const items = await ctx.db.query.trades.findMany({
				where: and(...conditions),
				orderBy: [desc(trades.deletedAt)],
				limit: input?.limit ?? 50,
				with: {
					account: true,
				},
			});

			return items;
		}),

	// Get trade statistics
	getStats: protectedProcedure
		.input(
			z
				.object({
					startDate: z.iso.datetime().optional(),
					endDate: z.iso.datetime().optional(),
					accountId: z.string().optional(), // Filter by account
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			// Get user's breakeven threshold setting
			const beThreshold = await getUserBreakevenThreshold(ctx.db, ctx.user.id);

			const conditions = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt), // Exclude deleted trades from stats
			];

			// Filter by account if specified, otherwise only include trades from active accounts
			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			} else {
				// Only include trades from active accounts when querying across all accounts
				const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
				conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
			}
			if (input?.startDate) {
				conditions.push(gte(trades.entryTime, new Date(input.startDate)));
			}
			if (input?.endDate) {
				// Set to end of day to make the end date inclusive
				const endOfDay = new Date(input.endDate);
				endOfDay.setHours(23, 59, 59, 999);
				conditions.push(lte(trades.entryTime, endOfDay));
			}

			const closedTrades = await ctx.db.query.trades.findMany({
				where: and(...conditions),
			});

			// Use shared stats calculator
			const stats = calculateAggregateStats(closedTrades, beThreshold);

			return {
				...stats,
				breakevenThreshold: beThreshold,
			};
		}),

	// ============================================================================
	// EXECUTION MANAGEMENT (Partial Exits / Scale In/Out)
	// ============================================================================

	// Get all executions for a trade
	getExecutions: protectedProcedure
		.input(z.object({ tradeId: z.string() }))
		.query(async ({ ctx, input }) => {
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

			const executions = await ctx.db.query.tradeExecutions.findMany({
				where: eq(tradeExecutions.tradeId, input.tradeId),
				orderBy: [desc(tradeExecutions.executedAt)],
			});

			return executions;
		}),

	// Add a new execution (partial exit, scale in/out)
	// User provides PnL directly for exit/scale_out (we don't calculate it)
	addExecution: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(addExecutionSchema)
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

			// Use user-provided PnL for exits
			const realizedPnl =
				(input.executionType === "exit" ||
					input.executionType === "scale_out") &&
				input.realizedPnl
					? input.realizedPnl
					: undefined;

			const [execution] = await ctx.db
				.insert(tradeExecutions)
				.values({
					tradeId: input.tradeId,
					executionType: input.executionType,
					price: input.price,
					quantity: input.quantity,
					executedAt: new Date(input.executedAt),
					fees: input.fees ?? "0",
					realizedPnl,
					notes: input.notes,
				})
				.returning();

			// If this is a partial exit, update the trade's remaining quantity
			if (
				input.executionType === "exit" ||
				input.executionType === "scale_out"
			) {
				const currentRemaining = trade.remainingQuantity
					? parseFloat(trade.remainingQuantity)
					: parseFloat(trade.quantity);
				const newRemaining = currentRemaining - parseFloat(input.quantity);

				await ctx.db
					.update(trades)
					.set({
						isPartiallyExited: true,
						remainingQuantity: newRemaining.toString(),
					})
					.where(eq(trades.id, input.tradeId));
			}

			// If this is a scale in, update the trade's quantity
			if (input.executionType === "scale_in") {
				const currentQty = parseFloat(trade.quantity);
				const newQty = currentQty + parseFloat(input.quantity);

				await ctx.db
					.update(trades)
					.set({
						quantity: newQty.toString(),
						remainingQuantity: newQty.toString(),
					})
					.where(eq(trades.id, input.tradeId));
			}

			return execution;
		}),

	// Delete an execution
	// Ungated: users must be able to delete executions on owned trades even after downgrading
	deleteExecution: protectedProcedure
		.input(z.object({ executionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Get the execution and verify trade ownership
			const execution = await ctx.db.query.tradeExecutions.findFirst({
				where: eq(tradeExecutions.id, input.executionId),
				with: { trade: true },
			});

			if (!execution || execution.trade.userId !== ctx.user.id) {
				throw new Error(ERR_EXECUTION_NOT_FOUND);
			}

			await ctx.db
				.delete(tradeExecutions)
				.where(eq(tradeExecutions.id, input.executionId));

			// Recalculate remaining quantity
			const remainingExecutions = await ctx.db.query.tradeExecutions.findMany({
				where: and(
					eq(tradeExecutions.tradeId, execution.tradeId),
					or(
						eq(tradeExecutions.executionType, "exit"),
						eq(tradeExecutions.executionType, "scale_out"),
					),
				),
			});

			const totalExited = remainingExecutions.reduce(
				(sum, e) => sum + parseFloat(e.quantity),
				0,
			);
			const originalQty = parseFloat(execution.trade.quantity);

			await ctx.db
				.update(trades)
				.set({
					isPartiallyExited: remainingExecutions.length > 0,
					remainingQuantity: (originalQty - totalExited).toString(),
				})
				.where(eq(trades.id, execution.tradeId));

			return { success: true };
		}),

	// Update trailing stop on a trade
	updateTrailingStop: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(
			z.object({
				tradeId: z.string(),
				trailedStopLoss: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			const [updated] = await ctx.db
				.update(trades)
				.set({
					trailedStopLoss: input.trailedStopLoss,
					wasTrailed: true,
				})
				.where(eq(trades.id, input.tradeId))
				.returning();

			return updated;
		}),

	// ============================================================================
	// RATING & REVIEW MANAGEMENT
	// ============================================================================

	// Update trade rating (0-5 stars, 0 = no rating)
	// Ungated: rating is a review annotation on owned data, not a feature-creation operation
	updateRating: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				rating: z.number().min(0).max(5),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			const [updated] = await ctx.db
				.update(trades)
				.set({ rating: input.rating })
				.where(eq(trades.id, input.id))
				.returning();

			return updated;
		}),

	// Bulk update ratings
	// Ungated: rating is a review annotation on owned data
	bulkUpdateRating: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.string()).min(1).max(100),
				rating: z.number().min(1).max(5).nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify all trades belong to user
			const existingTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					sql`${trades.id} IN (${sql.join(
						input.ids.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			});

			if (existingTrades.length !== input.ids.length) {
				throw new Error(ERR_TRADES_BULK_NOT_FOUND);
			}

			await ctx.db
				.update(trades)
				.set({ rating: input.rating })
				.where(
					and(
						eq(trades.userId, ctx.user.id),
						sql`${trades.id} IN (${sql.join(
							input.ids.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					),
				);

			return { success: true, updated: input.ids.length };
		}),

	// Mark trade as reviewed
	// Ungated: review status is a cleanup annotation on owned data
	markReviewed: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				isReviewed: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			const [updated] = await ctx.db
				.update(trades)
				.set({ isReviewed: input.isReviewed })
				.where(eq(trades.id, input.id))
				.returning();

			return updated;
		}),

	// Update trade strategy
	updateStrategy: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(
			z.object({
				id: z.string(),
				strategyId: z.string().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			const [updated] = await ctx.db
				.update(trades)
				.set({ strategyId: input.strategyId })
				.where(eq(trades.id, input.id))
				.returning();

			return updated;
		}),

	// Bulk mark as reviewed
	// Ungated: review status is a cleanup annotation on owned data
	bulkMarkReviewed: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.string()).min(1).max(100),
				isReviewed: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify all trades belong to user
			const existingTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					sql`${trades.id} IN (${sql.join(
						input.ids.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			});

			if (existingTrades.length !== input.ids.length) {
				throw new Error(ERR_TRADES_BULK_NOT_FOUND);
			}

			await ctx.db
				.update(trades)
				.set({ isReviewed: input.isReviewed })
				.where(
					and(
						eq(trades.userId, ctx.user.id),
						sql`${trades.id} IN (${sql.join(
							input.ids.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					),
				);

			return { success: true, updated: input.ids.length };
		}),

	// Get unreviewed trades count
	getUnreviewedCount: protectedProcedure
		.input(z.object({ accountId: z.string().optional() }).optional())
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				eq(trades.isReviewed, false),
				isNull(trades.deletedAt),
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			}

			const result = await ctx.db
				.select({ count: sql<number>`count(*)` })
				.from(trades)
				.where(and(...conditions));

			return result[0]?.count ?? 0;
		}),

	// ============================================================================
	// MAE/MFE ANALYSIS
	// ============================================================================

	/**
	 * Calculate and store MAE/MFE for a closed trade
	 * This fetches market data, calculates the metrics, and stores them permanently.
	 * Can be called on-demand or automatically when a trade is closed.
	 */
	calculateMAEMFE: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(z.object({ tradeId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// First verify the user owns this trade
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
				columns: { id: true },
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			// Use the shared service for calculation
			const result = await calculateAndStoreMAEMFE(input.tradeId, {
				skipAlreadyProcessed: false, // User explicitly requested recalculation
			});

			if (!result.success && result.message !== "Already processed") {
				throw new Error(result.message ?? ERR_MAEMFE_CALCULATE_FAILED);
			}

			return {
				success: result.success,
				dataQuality: result.dataQuality,
				metrics: result.metrics
					? {
							maePrice: result.metrics.maePrice,
							mfePrice: result.metrics.mfePrice,
							maeAmount: result.metrics.maeAmount,
							mfeAmount: result.metrics.mfeAmount,
							maePoints: result.metrics.maePoints,
							mfePoints: result.metrics.mfePoints,
						}
					: undefined,
				trade: result.trade,
			};
		}),

	/**
	 * Bulk calculate MAE/MFE for multiple trades
	 * Useful for processing imported trades in batches
	 */
	bulkCalculateMAEMFE: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(
			z.object({
				tradeIds: z.array(z.string()).min(1).max(100),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First verify user owns all the trades
			const userTradeIds = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					sql`${trades.id} IN (${sql.join(
						input.tradeIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
				columns: { id: true },
			});

			const validTradeIds = new Set(userTradeIds.map((t) => t.id));

			const results = {
				processed: 0,
				success: 0,
				failed: 0,
				skipped: 0,
			};

			// Process trades sequentially to avoid rate limiting
			for (const tradeId of input.tradeIds) {
				results.processed++;

				// Skip if user doesn't own this trade
				if (!validTradeIds.has(tradeId)) {
					results.skipped++;
					continue;
				}

				// Use the shared service for calculation
				const result = await calculateAndStoreMAEMFE(tradeId, {
					skipAlreadyProcessed: true,
				});

				if (result.success) {
					results.success++;
				} else if (result.message === "Already processed") {
					results.skipped++;
				} else {
					results.failed++;
				}
			}

			return results;
		}),

	/**
	 * Get trades that need MAE/MFE calculation
	 * Returns closed trades without MAE/MFE data
	 */
	getTradesNeedingMAEMFE: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).default(50),
					accountId: z.string().optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(trades.userId, ctx.user.id),
				eq(trades.status, "closed"),
				isNull(trades.deletedAt),
				isNull(trades.marketDataQuality), // No MAE/MFE calculated yet
			];

			if (input?.accountId) {
				conditions.push(eq(trades.accountId, input.accountId));
			}

			const tradesNeedingCalc = await ctx.db.query.trades.findMany({
				where: and(...conditions),
				orderBy: [desc(trades.exitTime)], // Most recent first
				limit: input?.limit ?? 50,
				columns: {
					id: true,
					symbol: true,
					entryTime: true,
					exitTime: true,
					direction: true,
				},
			});

			return tradesNeedingCalc;
		}),

	/**
	 * Get import processing progress
	 * Used by frontend to poll and show progress toast
	 */
	getImportProgress: protectedProcedure
		.input(
			z.object({
				tradeIds: z.array(z.string()).min(1).max(1000),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Use COUNT for efficiency instead of fetching rows
			const [result] = await ctx.db
				.select({ count: sql<number>`count(*)::int` })
				.from(trades)
				.where(
					and(
						eq(trades.userId, ctx.user.id),
						inArray(trades.id, input.tradeIds),
						isNotNull(trades.marketDataQuality),
					),
				);

			const total = input.tradeIds.length;
			const processed = result?.count ?? 0;

			return {
				total,
				processed,
				isComplete: processed === total,
				progress: total > 0 ? Math.round((processed / total) * 100) : 100,
			};
		}),

	// ============================================================================
	// ATTACHMENT MANAGEMENT
	// ============================================================================

	// Get a presigned URL for uploading a file to S3
	getUploadUrl: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(
			z.object({
				tradeId: z.string(),
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().int().positive(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(ERR_S3_NOT_CONFIGURED);
			}

			// Verify user owns the trade
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			// Generate a unique key for the file
			// Format: trades/{userId}/{tradeId}/{uuid}-{filename}
			const uuid = nanoid();
			const key = `trades/${ctx.user.id}/${input.tradeId}/${uuid}-${input.filename}`;

			// Generate presigned PUT URL (valid for 1 hour)
			const presignedUrl = getPresignedUploadUrl(key, 3600);

			return {
				presignedUrl,
				key,
			};
		}),

	// Confirm an upload completed and create database record
	confirmUpload: requireFeature(FEATURE_TRADE_MANAGEMENT)
		.input(
			z.object({
				tradeId: z.string(),
				key: z.string(),
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().int().positive(),
				caption: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(ERR_S3_NOT_CONFIGURED);
			}

			// Verify user owns the trade
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			// Store the key, not the presigned URL - URLs will be generated on-demand
			// when fetching attachments to avoid expiration issues
			const [attachment] = await ctx.db
				.insert(tradeAttachments)
				.values({
					tradeId: input.tradeId,
					url: input.key, // Store key in url field - will generate presigned URL on read
					key: input.key,
					filename: input.filename,
					mimeType: input.mimeType,
					size: input.size,
					caption: input.caption ?? null,
				})
				.returning();

			if (!attachment) {
				throw new Error(ERR_ATTACHMENT_CREATE_FAILED);
			}

			// Generate presigned URL for immediate use (e.g., inserting into editor)
			const presignedUrl = isS3Configured()
				? getPresignedDownloadUrl(input.key, 3600)
				: attachment.url;

			return { ...attachment, url: presignedUrl };
		}),

	// Delete an attachment (from S3 and database)
	// Ungated: users must be able to delete attachments on owned trades even after downgrading
	deleteAttachment: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Find the attachment and verify ownership through trade
			const attachment = await ctx.db.query.tradeAttachments.findFirst({
				where: eq(tradeAttachments.id, input.id),
				with: {
					trade: true,
				},
			});

			if (!attachment) {
				throw new Error(ERR_ATTACHMENT_NOT_FOUND);
			}

			// Verify user owns the trade that contains this attachment
			if (attachment.trade.userId !== ctx.user.id) {
				throw new Error(ERR_ATTACHMENT_NOT_FOUND);
			}

			// Delete from S3 if configured
			if (isS3Configured() && attachment.key) {
				try {
					await deleteObject(attachment.key);
				} catch {
					// Log error but continue with database deletion
					// The file may have already been deleted or not exist
					logger.error("Failed to delete S3 object", undefined, {
						key: attachment.key,
					});
				}
			}

			// Delete from database
			await ctx.db
				.delete(tradeAttachments)
				.where(eq(tradeAttachments.id, input.id));

			return { success: true };
		}),

	// Full-text search across trade notes
	searchNotes: protectedProcedure
		.input(
			z.object({
				query: z.string().min(SEARCH_MIN_QUERY_LENGTH),
				limit: z.number().int().min(1).max(50).default(SEARCH_DEFAULT_LIMIT),
			}),
		)
		.query(async ({ ctx, input }) => {
			const results = await ctx.db.execute<{
				id: string;
				symbol: string;
				entry_time: Date;
				snippet: string;
				rank: number;
			}>(
				sql`WITH search_query AS (
					SELECT plainto_tsquery('english', ${input.query}) AS q
				)
				(SELECT
					t.id,
					t.symbol,
					t.entry_time,
					ts_headline('english', COALESCE(t.search_plain_text, ''), sq.q,
						'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'
					) AS snippet,
					ts_rank(t.search_vector, sq.q, 1) AS rank
				FROM trade t, search_query sq
				WHERE t.user_id = ${ctx.user.id}
					AND t.deleted_at IS NULL
					AND t.search_vector @@ sq.q)
				UNION ALL
				(SELECT
					sub.id,
					sub.symbol,
					sub.entry_time,
					ts_headline('english', sub.plain_text, sq.q,
						'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'
					) AS snippet,
					ts_rank(sub.vec, sq.q, 1) AS rank
				FROM search_query sq,
				LATERAL (
					SELECT
						t.id,
						t.symbol,
						t.entry_time,
						replace(replace(replace(replace(replace(
							regexp_replace(COALESCE(t.notes, ''), '<[^>]*>', ' ', 'g'),
							'&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'
						) AS plain_text,
						to_tsvector('english', replace(replace(replace(replace(replace(
							regexp_replace(COALESCE(t.notes, ''), '<[^>]*>', ' ', 'g'),
							'&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'
						)) AS vec
					FROM trade t
					WHERE t.user_id = ${ctx.user.id}
						AND t.deleted_at IS NULL
						AND t.search_vector IS NULL
						AND t.notes IS NOT NULL
					ORDER BY t.entry_time DESC
					LIMIT 500
				) sub
				WHERE sub.vec @@ sq.q)
				ORDER BY rank DESC, entry_time DESC
				LIMIT ${input.limit}`,
			);

			return (Array.isArray(results) ? results : []).map((row) => ({
				tradeId: row.id,
				symbol: row.symbol,
				entryTime: row.entry_time,
				snippet: row.snippet,
				rank: row.rank,
			}));
		}),
});
