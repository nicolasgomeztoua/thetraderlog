/**
 * Integration tests for strategy auto-evaluation engine.
 *
 * These tests verify that the evaluation engine correctly evaluates
 * trading rules against trade data through the evaluateTradeRules endpoint.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERR_TRADE_NO_STRATEGY } from "@/lib/constants/errors";
import {
	createTestCaller,
	getTestDb,
	schema,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("strategy-evaluation", () => {
	let caller: TestCaller;
	let userId: string;
	let accountId: string;

	beforeAll(async () => {
		await truncateAllTables();
		const { user, account } = await setupTrader({
			account: { initialBalance: "100000" },
		});
		caller = await createTestCaller(user.clerkId, user);
		userId = user.id;
		accountId = account.id;
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("Max Risk Per Trade Evaluator", () => {
		it("should pass when risk is below dollar limit", async () => {
			// Create strategy with max risk rule
			const strategy = await caller.strategies.create({
				name: "Max Risk Dollar Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Create trade with risk below limit
			// ES: $50/point, entry 5000, stop 4995 = 5 points = $250 risk
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4995.00",
					takeProfit: "5020.00",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			// Evaluate rules
			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.evaluated).toBe(1);
			expect(result.results).toHaveLength(1);
			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.dataQuality).toBe("full");
			expect(result.results[0]?.details).toContain("within limit");
		});

		it("should fail when risk exceeds dollar limit", async () => {
			// Create strategy with max risk rule
			const strategy = await caller.strategies.create({
				name: "Max Risk Fail Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 200,
						enabled: true,
					},
				},
			});

			// Create trade with risk above limit
			// ES: $50/point, entry 5000, stop 4990 = 10 points = $500 risk (exceeds $200)
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5005.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					takeProfit: "5020.00",
					realizedPnl: "250.00",
					netPnl: "247.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			// Evaluate rules
			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.evaluated).toBe(1);
			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.details).toContain("exceeds limit");
		});

		it("should pass when risk is at exactly the limit", async () => {
			const strategy = await caller.strategies.create({
				name: "Max Risk Exact Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 250,
						enabled: true,
					},
				},
			});

			// ES: $50/point, entry 5000, stop 4995 = 5 points = $250 risk (exactly at limit)
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4995.00",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
		});
	});

	describe("Min R:R Ratio Evaluator", () => {
		it("should pass when R:R meets minimum requirement", async () => {
			const strategy = await caller.strategies.create({
				name: "Min RR Pass Strategy",
				riskParameters: {
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
				},
			});

			// Entry 5000, stop 4990 (10 pt risk), TP 5030 (30 pt reward) = 3:1 R:R
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5025.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					takeProfit: "5030.00",
					realizedPnl: "1250.00",
					netPnl: "1247.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.evaluated).toBe(1);
			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.actual).toContain("3.00R");
		});

		it("should fail when R:R is below minimum", async () => {
			const strategy = await caller.strategies.create({
				name: "Min RR Fail Strategy",
				riskParameters: {
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
				},
			});

			// Entry 5000, stop 4990 (10 pt risk), TP 5015 (15 pt reward) = 1.5:1 R:R
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5012.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					takeProfit: "5015.00",
					realizedPnl: "600.00",
					netPnl: "597.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.actual).toContain("1.50R");
			expect(result.results[0]?.details).toContain("below minimum");
		});
	});

	describe("Breakeven Trigger Evaluator", () => {
		it("should pass when MFE reached trigger and stop was moved to breakeven", async () => {
			const strategy = await caller.strategies.create({
				name: "BE Trigger Pass Strategy",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// Entry 5000, stop 4990 (10 pt risk), MFE at 5015 (+1.5R)
			// trailedStopLoss at 5000 (breakeven)
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5012.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: "5015.00",
					mfeAmount: "750.00",
					trailedStopLoss: "5000.00",
					wasTrailed: true,
					realizedPnl: "600.00",
					netPnl: "597.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.details).toContain(
				"correctly moved to breakeven",
			);
		});

		it("should fail when MFE reached trigger but stop was not moved to breakeven", async () => {
			const strategy = await caller.strategies.create({
				name: "BE Trigger Fail Strategy",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// MFE reached 1.5R but stop was not moved
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "4990.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: "5015.00",
					mfeAmount: "750.00",
					trailedStopLoss: null,
					wasTrailed: false,
					realizedPnl: "-500.00",
					netPnl: "-502.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.details).toContain("not moved to breakeven");
		});

		it("should pass when MFE did not reach trigger (rule not applicable)", async () => {
			const strategy = await caller.strategies.create({
				name: "BE Trigger NA Strategy",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// MFE only reached 0.5R - trigger not reached
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "4995.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: "5005.00", // Only 0.5R
					mfeAmount: "250.00",
					realizedPnl: "-250.00",
					netPnl: "-252.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.details).toContain("not applicable");
		});
	});

	describe("Scale Out at R Evaluator", () => {
		it("should pass when matching scale out execution exists", async () => {
			const strategy = await caller.strategies.create({
				name: "Scale Out Pass Strategy",
				scalingRules: {
					scaleOut: [
						{
							trigger: "At +1R take 50%",
							sizePercent: 50,
							enabled: true,
						},
					],
				},
			});

			// Create trade with 2 contracts
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5025.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "2",
					stopLoss: "4990.00",
					realizedPnl: "2500.00",
					netPnl: "2495.00",
					fees: "5.00",
					importSource: "manual",
				})
				.returning();

			// Add scale out execution at 1R ($5010, within tolerance)
			// Entry 5000, stop 4990 = 10pt risk. 1R = entry + 10 = 5010
			await db.insert(schema.tradeExecutions).values({
				tradeId: trade?.id ?? "",
				executionType: "scale_out",
				price: "5010.00",
				quantity: "1", // 50% of 2 contracts
				executedAt: new Date(),
			});

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.details).toContain("Scaled out");
		});

		it("should fail when no matching scale out execution exists", async () => {
			const strategy = await caller.strategies.create({
				name: "Scale Out Fail Strategy",
				scalingRules: {
					scaleOut: [
						{
							trigger: "At +1R take 50%",
							sizePercent: 50,
							enabled: true,
						},
					],
				},
			});

			// Create trade without scale out execution
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5025.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "2",
					stopLoss: "4990.00",
					realizedPnl: "2500.00",
					netPnl: "2495.00",
					fees: "5.00",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.details).toContain("No partial exits");
		});
	});

	describe("Daily Loss Limit Evaluator", () => {
		it("should pass when daily loss is within limit", async () => {
			const strategy = await caller.strategies.create({
				name: "Daily Loss Pass Strategy",
				riskParameters: {
					dailyLossLimit: {
						type: "dollars",
						value: 1000,
						enabled: true,
					},
				},
			});

			// Create a trade with small loss
			const db = getTestDb();
			const entryTime = new Date();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "4995.00",
					entryTime,
					exitTime: entryTime,
					quantity: "1",
					stopLoss: "4990.00",
					realizedPnl: "-250.00",
					netPnl: "-252.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.details).toContain("within limit");
		});

		it("should fail when daily loss exceeds limit", async () => {
			const strategy = await caller.strategies.create({
				name: "Daily Loss Fail Strategy",
				riskParameters: {
					dailyLossLimit: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			const db = getTestDb();
			const dayDate = new Date("2024-06-15T14:00:00Z");

			// Create first losing trade of the day
			await db.insert(schema.trades).values({
				userId,
				accountId,
				symbol: "ES",

				direction: "long",
				status: "closed",
				entryPrice: "5000.00",
				exitPrice: "4990.00",
				entryTime: dayDate,
				exitTime: dayDate,
				quantity: "1",
				realizedPnl: "-500.00",
				netPnl: "-502.50",
				fees: "2.50",
				importSource: "manual",
			});

			// Create second losing trade of the day (this one triggers the limit breach)
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "4990.00",
					exitPrice: "4980.00",
					entryTime: new Date(dayDate.getTime() + 60000),
					exitTime: new Date(dayDate.getTime() + 120000),
					quantity: "1",
					stopLoss: "4975.00",
					realizedPnl: "-500.00",
					netPnl: "-502.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.details).toContain("exceeds limit");
		});

		it("should pass when daily P&L is profitable", async () => {
			const strategy = await caller.strategies.create({
				name: "Daily Profit Strategy",
				riskParameters: {
					dailyLossLimit: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5020.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					realizedPnl: "1000.00",
					netPnl: "997.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
		});
	});

	describe("Max Concurrent Positions Evaluator", () => {
		it("should pass when concurrent positions are within limit", async () => {
			const strategy = await caller.strategies.create({
				name: "Max Concurrent Pass Strategy",
				riskParameters: {
					maxConcurrentPositions: 3,
					maxConcurrentPositionsEnabled: true,
				},
			});

			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.details).toContain("1 concurrent");
		});

		it("should fail when concurrent positions exceed limit", async () => {
			const strategy = await caller.strategies.create({
				name: "Max Concurrent Fail Strategy",
				riskParameters: {
					maxConcurrentPositions: 2,
					maxConcurrentPositionsEnabled: true,
				},
			});

			const db = getTestDb();
			const baseTime = new Date("2024-07-01T10:00:00Z");

			// Create two trades that were open before our test trade
			await db.insert(schema.trades).values({
				userId,
				accountId,
				symbol: "NQ",

				direction: "long",
				status: "closed",
				entryPrice: "17500.00",
				exitPrice: "17550.00",
				entryTime: new Date(baseTime.getTime() - 60000), // 1 min before
				exitTime: new Date(baseTime.getTime() + 120000), // 2 min after
				quantity: "1",
				realizedPnl: "1000.00",
				netPnl: "997.50",
				fees: "2.50",
				importSource: "manual",
			});

			await db.insert(schema.trades).values({
				userId,
				accountId,
				symbol: "CL",

				direction: "short",
				status: "closed",
				entryPrice: "80.00",
				exitPrice: "79.50",
				entryTime: new Date(baseTime.getTime() - 30000), // 30s before
				exitTime: new Date(baseTime.getTime() + 90000), // 90s after
				quantity: "1",
				realizedPnl: "500.00",
				netPnl: "497.50",
				fees: "2.50",
				importSource: "manual",
			});

			// Create our test trade - this will be the 3rd concurrent position
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: baseTime,
					exitTime: new Date(baseTime.getTime() + 60000),
					quantity: "1",
					stopLoss: "4990.00",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.details).toContain("exceeding limit");
		});
	});

	describe("Missing Data Handling", () => {
		it("should return unavailable when stop loss is missing for max risk evaluation", async () => {
			const strategy = await caller.strategies.create({
				name: "Missing SL Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Create trade WITHOUT stop loss
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: null, // No stop loss
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.dataQuality).toBe("unavailable");
			expect(result.results[0]?.details).toContain("No stop loss");
		});

		it("should return unavailable when take profit is missing for R:R evaluation", async () => {
			const strategy = await caller.strategies.create({
				name: "Missing TP Strategy",
				riskParameters: {
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
				},
			});

			// Create trade with stop loss but WITHOUT take profit
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					takeProfit: null, // No take profit
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.dataQuality).toBe("unavailable");
			expect(result.results[0]?.details).toContain("No take profit");
		});

		it("should return unavailable when MFE data is missing for breakeven evaluation", async () => {
			const strategy = await caller.strategies.create({
				name: "Missing MFE Strategy",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// Create trade WITHOUT MFE data
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: null, // No MFE data
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(false);
			expect(result.results[0]?.dataQuality).toBe("unavailable");
			expect(result.results[0]?.details).toContain("MFE data unavailable");
		});
	});

	describe("Trade without strategy", () => {
		it("should throw error for trade without strategy", async () => {
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: null, // No strategy
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			await expect(
				caller.strategies.evaluateTradeRules({ tradeId: trade?.id ?? "" }),
			).rejects.toThrow(ERR_TRADE_NO_STRATEGY);
		});
	});

	describe("Manual rules are skipped", () => {
		it("should skip manual rules and only evaluate auto rules", async () => {
			const strategy = await caller.strategies.create({
				name: "Mixed Rules Strategy",
				rules: [
					{
						text: "Check market sentiment before entry",
						category: "entry",
						order: 0,
					},
				],
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4995.00",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			// Should only evaluate the auto rule (max risk), not the manual rule
			expect(result.evaluated).toBe(1);
		});
	});

	describe("Percent-based risk calculations", () => {
		it("should evaluate percent-based max risk against account balance", async () => {
			const strategy = await caller.strategies.create({
				name: "Percent Risk Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "percent",
						value: 1, // 1% of account
						enabled: true,
					},
				},
			});

			// Account balance is $100,000, 1% = $1,000 max risk
			// ES: $50/point, entry 5000, stop 4990 = 10 points = $500 risk (within 1%)
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "long",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "5010.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
			expect(result.results[0]?.expected).toContain("1%");
		});
	});

	describe("Short trade evaluation", () => {
		it("should correctly evaluate risk for short trades", async () => {
			const strategy = await caller.strategies.create({
				name: "Short Trade Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Short trade: entry 5000, stop 5005 = 5 points risk = $250
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "short",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "4990.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "5005.00",
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
		});

		it("should correctly evaluate breakeven for short trades", async () => {
			const strategy = await caller.strategies.create({
				name: "Short BE Strategy",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// Short: entry 5000, stop 5010 (10 pt risk), MFE 4985 (+1.5R)
			// For short, trailed stop should be <= entry (at or below breakeven)
			const db = getTestDb();
			const [trade] = await db
				.insert(schema.trades)
				.values({
					userId,
					accountId,
					strategyId: strategy.id,
					symbol: "ES",

					direction: "short",
					status: "closed",
					entryPrice: "5000.00",
					exitPrice: "4990.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "5010.00",
					mfePrice: "4985.00", // 1.5R for short
					mfeAmount: "750.00",
					trailedStopLoss: "5000.00", // At breakeven
					wasTrailed: true,
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.evaluateTradeRules({
				tradeId: trade?.id ?? "",
			});

			expect(result.results[0]?.passed).toBe(true);
		});
	});
});
