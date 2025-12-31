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
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { getOHLCForTimeRange } from "@/lib/market-data-service";
import {
	directionEnum,
	emotionalStateEnum,
	executionTypeEnum,
	exitReasonEnum,
	instrumentTypeEnum,
	tradeStatusEnum,
} from "@/lib/schemas";
import { calculateAggregateStats } from "@/lib/stats-calculations";
import { calculateMAEMFE } from "@/lib/trade-calculations";
import {
	getActiveAccountsSubquery,
	getUserBreakevenThreshold,
} from "@/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { tradeExecutions, trades, tradeTags } from "@/server/db/schema";

// Input schemas
const createTradeSchema = z.object({
	symbol: z.string().min(1),
	instrumentType: instrumentTypeEnum,
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
	tagIds: z.array(z.number()).optional(),
	accountId: z.number(), // Required: Link to trading account
	externalId: z.string().optional(), // For tracking imported trades
	strategyId: z.number().optional(), // Link to strategy
});

const updateTradeSchema = z.object({
	id: z.number(),
	symbol: z.string().optional(),
	instrumentType: instrumentTypeEnum.optional(),
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
	strategyId: z.number().nullish(),
});

// Schema for adding a partial exit / execution
const addExecutionSchema = z.object({
	tradeId: z.number(),
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
	instrumentType: instrumentTypeEnum,
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
	accountId: z.number(),
	trades: z.array(batchImportTradeSchema).min(1).max(1000), // Limit batch size
});

export const tradesRouter = createTRPCRouter({
	// Get all trades for current user
	getAll: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).default(50),
					cursor: z.number().nullish(),
					direction: z.enum(["forward", "backward"]).optional(), // tRPC infinite query pagination direction
					status: tradeStatusEnum.nullish(),
					symbol: z.string().nullish(),
					tradeDirection: directionEnum.nullish(),
					startDate: z.iso.datetime().nullish(),
					endDate: z.iso.datetime().nullish(),
					accountId: z.number().nullish(),
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
					tagIds: z.array(z.number()).nullish(),
					exitReason: exitReasonEnum.nullish(),
					strategyId: z.number().nullish(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const limit = input?.limit ?? 50;

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
				conditions.push(lte(trades.entryTime, new Date(input.endDate)));
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

			if (input?.cursor) {
				conditions.push(sql`${trades.id} < ${input.cursor}`);
			}

			let items = await ctx.db.query.trades.findMany({
				where: and(...conditions),
				orderBy: [desc(trades.id)],
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
				const beThreshold = 3.0; // Default, could fetch from user settings
				items = items.filter((trade) => {
					const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
					if (input.result === "win") return pnl > beThreshold;
					if (input.result === "loss") return pnl < -beThreshold;
					return Math.abs(pnl) <= beThreshold;
				});
			}

			let nextCursor: number | undefined;
			if (items.length > limit) {
				const nextItem = items.pop();
				nextCursor = nextItem?.id;
			}

			return {
				items,
				nextCursor,
			};
		}),

	// Get a single trade by ID
	getById: protectedProcedure
		.input(z.object({ id: z.number() }))
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
					screenshots: true,
					account: true,
					strategy: true,
					ruleChecks: true,
				},
			});

			if (!trade) {
				throw new Error("Trade not found");
			}

			return trade;
		}),

	// Create a new trade
	// User provides PnL directly for closed trades (we don't calculate it)
	create: protectedProcedure
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

			return newTrade;
		}),

	// Batch import trades (much faster for CSV imports)
	// Uses broker-reported profit instead of calculating PnL ourselves
	batchImport: protectedProcedure
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

				return {
					userId: ctx.user.id,
					accountId,
					symbol: trade.symbol,
					instrumentType: trade.instrumentType,
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
				};
			});

			// Insert all trades in a single batch
			const insertedTrades = await ctx.db
				.insert(trades)
				.values(tradeRecords)
				.returning({ id: trades.id, status: trades.status });

			// Get IDs of closed trades that need MAE/MFE calculation
			const closedTradeIds = insertedTrades
				.filter((t) => t.status === "closed")
				.map((t) => t.id);

			// Trigger Inngest background job to calculate MAE/MFE
			if (closedTradeIds.length > 0) {
				await inngest.send({
					name: "import/process",
					data: {
						tradeIds: closedTradeIds,
						userId: ctx.user.id,
					},
				});
			}

			return {
				imported: insertedTrades.length,
				total: tradesToImport.length,
				tradeIds: insertedTrades.map((t) => t.id),
				processingCount: closedTradeIds.length,
			};
		}),

	// Update a trade
	// Note: For imported trades, core fields (price, quantity, PnL) should be locked on the frontend.
	// PnL is NOT recalculated - we trust the broker's reported PnL for imports,
	// and for manual trades, users provide PnL directly.
	update: protectedProcedure
		.input(updateTradeSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			// Verify ownership
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error("Trade not found");
			}

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

			return updated;
		}),

	// Close a trade
	// User provides the realized PnL directly (we don't calculate it)
	close: protectedProcedure
		.input(
			z.object({
				id: z.number(),
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
				throw new Error("Trade not found");
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

			return updated;
		}),

	// Soft delete a trade
	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error("Trade not found");
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
		.input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
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
				throw new Error("Some trades not found or don't belong to you");
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
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.id),
					eq(trades.userId, ctx.user.id),
					isNotNull(trades.deletedAt),
				),
			});

			if (!existingTrade) {
				throw new Error("Deleted trade not found");
			}

			await ctx.db
				.update(trades)
				.set({ deletedAt: null })
				.where(eq(trades.id, input.id));

			return { success: true };
		}),

	// Permanently delete a trade (hard delete)
	permanentDelete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error("Trade not found");
			}

			await ctx.db.delete(trades).where(eq(trades.id, input.id));
			return { success: true };
		}),

	// Empty trash - permanently delete all trashed trades
	emptyTrash: protectedProcedure
		.input(z.object({ accountId: z.number().optional() }).optional())
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
					accountId: z.number().optional(),
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
					accountId: z.number().optional(), // Filter by account
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
				conditions.push(lte(trades.entryTime, new Date(input.endDate)));
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
		.input(z.object({ tradeId: z.number() }))
		.query(async ({ ctx, input }) => {
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

			const executions = await ctx.db.query.tradeExecutions.findMany({
				where: eq(tradeExecutions.tradeId, input.tradeId),
				orderBy: [desc(tradeExecutions.executedAt)],
			});

			return executions;
		}),

	// Add a new execution (partial exit, scale in/out)
	// User provides PnL directly for exit/scale_out (we don't calculate it)
	addExecution: protectedProcedure
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
				throw new Error("Trade not found");
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
	deleteExecution: protectedProcedure
		.input(z.object({ executionId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			// Get the execution and verify trade ownership
			const execution = await ctx.db.query.tradeExecutions.findFirst({
				where: eq(tradeExecutions.id, input.executionId),
				with: { trade: true },
			});

			if (!execution || execution.trade.userId !== ctx.user.id) {
				throw new Error("Execution not found");
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
	updateTrailingStop: protectedProcedure
		.input(
			z.object({
				tradeId: z.number(),
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
				throw new Error("Trade not found");
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
	updateRating: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				rating: z.number().min(0).max(5),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error("Trade not found");
			}

			const [updated] = await ctx.db
				.update(trades)
				.set({ rating: input.rating })
				.where(eq(trades.id, input.id))
				.returning();

			return updated;
		}),

	// Bulk update ratings
	bulkUpdateRating: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.number()).min(1).max(100),
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
				throw new Error("Some trades not found or don't belong to you");
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
	markReviewed: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				isReviewed: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error("Trade not found");
			}

			const [updated] = await ctx.db
				.update(trades)
				.set({ isReviewed: input.isReviewed })
				.where(eq(trades.id, input.id))
				.returning();

			return updated;
		}),

	// Update trade strategy
	updateStrategy: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				strategyId: z.number().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingTrade = await ctx.db.query.trades.findFirst({
				where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
			});

			if (!existingTrade) {
				throw new Error("Trade not found");
			}

			const [updated] = await ctx.db
				.update(trades)
				.set({ strategyId: input.strategyId })
				.where(eq(trades.id, input.id))
				.returning();

			return updated;
		}),

	// Bulk mark as reviewed
	bulkMarkReviewed: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.number()).min(1).max(100),
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
				throw new Error("Some trades not found or don't belong to you");
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
		.input(z.object({ accountId: z.number().optional() }).optional())
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
	calculateMAEMFE: protectedProcedure
		.input(z.object({ tradeId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const LOG_TAG = "[MAE/MFE]";

			console.log(`${LOG_TAG} Starting calculation for trade ${input.tradeId}`);

			// Get the trade
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
				),
			});

			if (!trade) {
				console.error(`${LOG_TAG} Trade ${input.tradeId} not found`);
				throw new Error("Trade not found");
			}

			console.log(
				`${LOG_TAG} Trade details:`,
				JSON.stringify({
					id: trade.id,
					symbol: trade.symbol,
					direction: trade.direction,
					instrumentType: trade.instrumentType,
					status: trade.status,
					entryPrice: trade.entryPrice,
					exitPrice: trade.exitPrice,
					entryTime: trade.entryTime?.toISOString(),
					exitTime: trade.exitTime?.toISOString(),
					quantity: trade.quantity,
				}),
			);

			if (trade.status !== "closed" || !trade.exitTime || !trade.exitPrice) {
				console.error(
					`${LOG_TAG} Trade ${input.tradeId} is not closed or missing exit data`,
				);
				throw new Error("Trade must be closed to calculate MAE/MFE");
			}

			// Mark as pending while we calculate
			await ctx.db
				.update(trades)
				.set({ marketDataQuality: "pending" })
				.where(eq(trades.id, input.tradeId));

			console.log(`${LOG_TAG} Marked trade ${input.tradeId} as pending`);

			try {
				// Fetch market data for the trade duration
				console.log(
					`${LOG_TAG} Fetching OHLC data for ${trade.symbol} from ${trade.entryTime.toISOString()} to ${trade.exitTime.toISOString()}`,
				);

				const { bars, dataQuality } = await getOHLCForTimeRange(
					trade.symbol,
					"1min", // 1-minute bars for best available precision
					trade.entryTime,
					trade.exitTime,
				);

				const lastBar = bars.at(-1);
				console.log(
					`${LOG_TAG} OHLC fetch result:`,
					JSON.stringify({
						barCount: bars.length,
						dataQuality,
						firstBar: bars[0]
							? { time: new Date(bars[0].timestamp).toISOString() }
							: null,
						lastBar: lastBar
							? { time: new Date(lastBar.timestamp).toISOString() }
							: null,
					}),
				);

				if (bars.length === 0) {
					// No data available
					console.log(
						`${LOG_TAG} No bars returned, marking trade ${input.tradeId} as unavailable`,
					);
					await ctx.db
						.update(trades)
						.set({ marketDataQuality: "unavailable" })
						.where(eq(trades.id, input.tradeId));

					return {
						success: false,
						dataQuality: "unavailable" as const,
						message: "No market data available for this trade period",
					};
				}

				// Calculate MAE/MFE
				console.log(`${LOG_TAG} Calculating MAE/MFE metrics...`);
				const metrics = calculateMAEMFE(
					bars,
					parseFloat(trade.entryPrice),
					parseFloat(trade.exitPrice),
					trade.direction,
					parseFloat(trade.quantity),
					trade.symbol,
					trade.instrumentType,
				);

				console.log(
					`${LOG_TAG} Calculated metrics:`,
					JSON.stringify({
						maePrice: metrics.maePrice,
						mfePrice: metrics.mfePrice,
						maeAmount: metrics.maeAmount,
						mfeAmount: metrics.mfeAmount,
						efficiency: metrics.efficiency,
					}),
				);

				// Store the results permanently
				const [updated] = await ctx.db
					.update(trades)
					.set({
						maePrice: metrics.maePrice.toString(),
						mfePrice: metrics.mfePrice.toString(),
						maeAmount: metrics.maeAmount.toFixed(2),
						mfeAmount: metrics.mfeAmount.toFixed(2),
						tradeEfficiency: metrics.efficiency.toFixed(2),
						marketDataQuality: dataQuality,
					})
					.where(eq(trades.id, input.tradeId))
					.returning();

				console.log(
					`${LOG_TAG} SUCCESS: Stored MAE/MFE for trade ${input.tradeId}`,
				);

				return {
					success: true,
					dataQuality,
					metrics: {
						maePrice: metrics.maePrice,
						mfePrice: metrics.mfePrice,
						maeAmount: metrics.maeAmount,
						mfeAmount: metrics.mfeAmount,
						efficiency: metrics.efficiency,
						maePoints: metrics.maePoints,
						mfePoints: metrics.mfePoints,
					},
					trade: updated,
				};
			} catch (error) {
				// Mark as unavailable on error
				console.error(
					`${LOG_TAG} ERROR for trade ${input.tradeId}:`,
					error instanceof Error ? error.message : error,
				);

				await ctx.db
					.update(trades)
					.set({ marketDataQuality: "unavailable" })
					.where(eq(trades.id, input.tradeId));

				console.error(`${LOG_TAG} MAE/MFE calculation error:`, error);
				throw new Error("Failed to calculate MAE/MFE");
			}
		}),

	/**
	 * Bulk calculate MAE/MFE for multiple trades
	 * Useful for processing imported trades in batches
	 */
	bulkCalculateMAEMFE: protectedProcedure
		.input(
			z.object({
				tradeIds: z.array(z.number()).min(1).max(100),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Get all trades
			const tradesToProcess = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					eq(trades.status, "closed"),
					sql`${trades.id} IN (${sql.join(
						input.tradeIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			});

			const results = {
				processed: 0,
				success: 0,
				failed: 0,
				skipped: 0,
			};

			// Process trades sequentially to avoid rate limiting
			for (const trade of tradesToProcess) {
				results.processed++;

				if (!trade.exitTime || !trade.exitPrice) {
					results.skipped++;
					continue;
				}

				try {
					// Fetch market data
					const { bars, dataQuality } = await getOHLCForTimeRange(
						trade.symbol,
						"5min",
						trade.entryTime,
						trade.exitTime,
					);

					if (bars.length === 0) {
						await ctx.db
							.update(trades)
							.set({ marketDataQuality: "unavailable" })
							.where(eq(trades.id, trade.id));
						results.failed++;
						continue;
					}

					// Calculate MAE/MFE
					const metrics = calculateMAEMFE(
						bars,
						parseFloat(trade.entryPrice),
						parseFloat(trade.exitPrice),
						trade.direction,
						parseFloat(trade.quantity),
						trade.symbol,
						trade.instrumentType,
					);

					// Store results
					await ctx.db
						.update(trades)
						.set({
							maePrice: metrics.maePrice.toString(),
							mfePrice: metrics.mfePrice.toString(),
							maeAmount: metrics.maeAmount.toFixed(2),
							mfeAmount: metrics.mfeAmount.toFixed(2),
							tradeEfficiency: metrics.efficiency.toFixed(2),
							marketDataQuality: dataQuality,
						})
						.where(eq(trades.id, trade.id));

					results.success++;
				} catch (error) {
					console.error(
						`MAE/MFE calculation failed for trade ${trade.id}:`,
						error,
					);
					await ctx.db
						.update(trades)
						.set({ marketDataQuality: "unavailable" })
						.where(eq(trades.id, trade.id));
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
					accountId: z.number().optional(),
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
				tradeIds: z.array(z.number()).min(1).max(1000),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Count trades that have marketDataQuality set (processed)
			const processedTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					inArray(trades.id, input.tradeIds),
					isNotNull(trades.marketDataQuality),
				),
				columns: { id: true },
			});

			const total = input.tradeIds.length;
			const processed = processedTrades.length;
			const isComplete = processed === total;

			return {
				total,
				processed,
				isComplete,
				progress: total > 0 ? Math.round((processed / total) * 100) : 100,
			};
		}),
});
