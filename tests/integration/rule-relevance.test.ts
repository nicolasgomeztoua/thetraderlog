/**
 * Integration tests for rule relevance logic.
 *
 * These tests verify that the getTradeRuleChecks endpoint correctly
 * filters rules based on MFE (Maximum Favorable Excursion) relevance.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	FULL_ACCESS_AUTH,
	getTestDb,
	schema,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("rule-relevance", () => {
	let caller: TestCaller;
	let userId: string;
	let accountId: string;

	beforeAll(async () => {
		await truncateAllTables();
		const { user, account } = await setupTrader({
			account: { initialBalance: "100000" },
		});
		caller = await createTestCaller(user.clerkId, user, FULL_ACCESS_AUTH);
		userId = user.id;
		accountId = account.id;
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("Breakeven Trigger Relevance", () => {
		it("should mark breakevenTrigger rule as relevant when MFE >= triggerR", async () => {
			// Create strategy with breakeven trigger at 1R
			const strategy = await caller.strategies.create({
				name: "BE Trigger Relevance Test - Above",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// Create trade with MFE at 1.5R (above trigger)
			// Entry 5000, stop 4990 (10 pt risk), MFE at 5015 = 1.5R
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
					realizedPnl: "600.00",
					netPnl: "597.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// The breakeven rule should be in the relevant list
			expect(result.rules.length).toBeGreaterThan(0);
			const beRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("breakeven"),
			);
			expect(beRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(beRule?.id);
		});

		it("should mark breakevenTrigger rule as NOT relevant when MFE < triggerR", async () => {
			// Create strategy with breakeven trigger at 1R
			const strategy = await caller.strategies.create({
				name: "BE Trigger Relevance Test - Below",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// Create trade with MFE at 0.5R (below trigger)
			// Entry 5000, stop 4990 (10 pt risk), MFE at 5005 = 0.5R
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
					mfePrice: "5005.00",
					mfeAmount: "250.00",
					realizedPnl: "-250.00",
					netPnl: "-252.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// The breakeven rule should NOT be in the relevant list
			expect(result.rules.length).toBeGreaterThan(0);
			const beRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("breakeven"),
			);
			expect(beRule).toBeDefined();
			expect(result.relevantRuleIds).not.toContain(beRule?.id);
		});

		it("should mark breakevenTrigger rule as relevant when MFE equals exactly triggerR", async () => {
			// Create strategy with breakeven trigger at 1R
			const strategy = await caller.strategies.create({
				name: "BE Trigger Relevance Test - Exact",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			// Create trade with MFE at exactly 1R
			// Entry 5000, stop 4990 (10 pt risk), MFE at 5010 = exactly 1R
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
					exitPrice: "5008.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: "5010.00",
					mfeAmount: "500.00",
					realizedPnl: "400.00",
					netPnl: "397.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// At exactly triggerR, rule should be relevant
			const beRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("breakeven"),
			);
			expect(beRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(beRule?.id);
		});
	});

	describe("Risk Rules Always Relevant", () => {
		it("should mark maxRiskPerTrade rule as always relevant regardless of MFE", async () => {
			// Create strategy with max risk rule
			const strategy = await caller.strategies.create({
				name: "Max Risk Always Relevant Test",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Create trade with low MFE (shouldn't affect relevance)
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
					stopLoss: "4995.00",
					mfePrice: "5002.00", // Very low MFE
					mfeAmount: "100.00",
					realizedPnl: "-500.00",
					netPnl: "-502.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Max risk rule should always be relevant
			const riskRule = result.rules.find(
				(r) =>
					r.text.toLowerCase().includes("risk") &&
					r.text.toLowerCase().includes("max"),
			);
			expect(riskRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(riskRule?.id);
		});

		it("should mark minRRRatio rule as always relevant regardless of MFE", async () => {
			const strategy = await caller.strategies.create({
				name: "Min RR Always Relevant Test",
				riskParameters: {
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
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
					exitPrice: "4990.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					takeProfit: "5020.00",
					mfePrice: "5001.00", // Minimal MFE
					mfeAmount: "50.00",
					realizedPnl: "-500.00",
					netPnl: "-502.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Min RR rule should always be relevant
			const rrRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("r:r"),
			);
			expect(rrRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(rrRule?.id);
		});

		it("should mark dailyLossLimit rule as always relevant regardless of MFE", async () => {
			const strategy = await caller.strategies.create({
				name: "Daily Loss Always Relevant Test",
				riskParameters: {
					dailyLossLimit: {
						type: "dollars",
						value: 1000,
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
					exitPrice: "4990.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: null, // No MFE data at all
					mfeAmount: null,
					realizedPnl: "-500.00",
					netPnl: "-502.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Daily loss limit rule should always be relevant
			const lossLimitRule = result.rules.find(
				(r) =>
					r.text.toLowerCase().includes("daily") &&
					r.text.toLowerCase().includes("loss"),
			);
			expect(lossLimitRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(lossLimitRule?.id);
		});

		it("should mark maxConcurrentPositions rule as always relevant regardless of MFE", async () => {
			const strategy = await caller.strategies.create({
				name: "Max Concurrent Always Relevant Test",
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
					mfePrice: null, // No MFE data
					mfeAmount: null,
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Max concurrent positions rule should always be relevant
			const concurrentRule = result.rules.find(
				(r) =>
					r.text.toLowerCase().includes("concurrent") ||
					r.text.toLowerCase().includes("position"),
			);
			expect(concurrentRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(concurrentRule?.id);
		});
	});

	describe("Trade with No MFE Data", () => {
		it("should return risk rules as relevant but MFE-triggered rules as not relevant", async () => {
			// Create strategy with both always-relevant and MFE-triggered rules
			const strategy = await caller.strategies.create({
				name: "Mixed Rules No MFE Test",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
				},
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
					stopLoss: "4995.00",
					takeProfit: "5020.00",
					mfePrice: null,
					mfeAmount: null,
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Find the risk rules (always relevant)
			const riskRule = result.rules.find(
				(r) =>
					r.text.toLowerCase().includes("risk") &&
					r.text.toLowerCase().includes("max"),
			);
			const rrRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("r:r"),
			);

			// Find the MFE-triggered rule
			const beRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("breakeven"),
			);

			// Risk rules should be relevant
			expect(riskRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(riskRule?.id);

			expect(rrRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(rrRule?.id);

			// BE rule should NOT be relevant (no MFE data means can't have triggered)
			expect(beRule).toBeDefined();
			expect(result.relevantRuleIds).not.toContain(beRule?.id);
		});
	});

	describe("ScaleOut Relevance", () => {
		it("should mark scaleOutAtR rule as relevant when MFE >= targetR", async () => {
			const strategy = await caller.strategies.create({
				name: "Scale Out Relevance Test - Above",
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

			// Create trade with MFE at 1.5R (above target)
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
					quantity: "2",
					stopLoss: "4990.00",
					mfePrice: "5015.00", // 1.5R
					mfeAmount: "1500.00",
					realizedPnl: "1200.00",
					netPnl: "1195.00",
					fees: "5.00",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Scale out rule should be relevant (MFE reached target)
			const scaleRule = result.rules.find(
				(r) =>
					r.text.toLowerCase().includes("scale") ||
					r.text.toLowerCase().includes("take"),
			);
			expect(scaleRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(scaleRule?.id);
		});

		it("should mark scaleOutAtR rule as NOT relevant when MFE < targetR", async () => {
			const strategy = await caller.strategies.create({
				name: "Scale Out Relevance Test - Below",
				scalingRules: {
					scaleOut: [
						{
							trigger: "At +2R take 50%",
							sizePercent: 50,
							enabled: true,
						},
					],
				},
			});

			// Create trade with MFE at 1R (below 2R target)
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
					exitPrice: "5008.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "2",
					stopLoss: "4990.00",
					mfePrice: "5010.00", // Only 1R, target is 2R
					mfeAmount: "1000.00",
					realizedPnl: "800.00",
					netPnl: "795.00",
					fees: "5.00",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Scale out rule should NOT be relevant (MFE didn't reach target)
			const scaleRule = result.rules.find(
				(r) =>
					r.text.toLowerCase().includes("scale") ||
					r.text.toLowerCase().includes("take"),
			);
			expect(scaleRule).toBeDefined();
			expect(result.relevantRuleIds).not.toContain(scaleRule?.id);
		});
	});

	describe("Manual Rules Always Relevant", () => {
		it("should mark manual rules (without autoCondition) as always relevant", async () => {
			// Create strategy with only manual rules
			const strategy = await caller.strategies.create({
				name: "Manual Rules Test",
				rules: [
					{
						text: "Check market sentiment before entry",
						category: "entry",
						order: 0,
					},
					{
						text: "Wait for pullback to support",
						category: "entry",
						order: 1,
					},
				],
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
					mfePrice: null, // No MFE
					mfeAmount: null,
					realizedPnl: "500.00",
					netPnl: "497.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// All manual rules should be relevant
			expect(result.rules.length).toBe(2);
			expect(result.relevantRuleIds.length).toBe(2);
			for (const rule of result.rules) {
				expect(result.relevantRuleIds).toContain(rule.id);
			}
		});
	});

	describe("TrailingStopTrigger Relevance", () => {
		it("should mark trailingStopTrigger rule as relevant when MFE >= triggerR", async () => {
			const strategy = await caller.strategies.create({
				name: "Trailing Stop Relevance Test - Above",
				trailingRules: {
					trailStops: [
						{
							triggerR: 1.5,
							method: "fixed_ticks",
							value: 20,
							enabled: true,
						},
					],
				},
			});

			// Create trade with MFE at 2R (above 1.5R trigger)
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
					exitPrice: "5015.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: "5020.00", // 2R
					mfeAmount: "1000.00",
					realizedPnl: "750.00",
					netPnl: "747.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Trailing stop rule should be relevant
			const trailRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("trail"),
			);
			expect(trailRule).toBeDefined();
			expect(result.relevantRuleIds).toContain(trailRule?.id);
		});

		it("should mark trailingStopTrigger rule as NOT relevant when MFE < triggerR", async () => {
			const strategy = await caller.strategies.create({
				name: "Trailing Stop Relevance Test - Below",
				trailingRules: {
					trailStops: [
						{
							triggerR: 2.0,
							method: "fixed_ticks",
							value: 20,
							enabled: true,
						},
					],
				},
			});

			// Create trade with MFE at 1R (below 2R trigger)
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
					exitPrice: "5008.00",
					entryTime: new Date(),
					exitTime: new Date(),
					quantity: "1",
					stopLoss: "4990.00",
					mfePrice: "5010.00", // Only 1R, trigger is 2R
					mfeAmount: "500.00",
					realizedPnl: "400.00",
					netPnl: "397.50",
					fees: "2.50",
					importSource: "manual",
				})
				.returning();

			const result = await caller.strategies.getTradeRuleChecks({
				tradeId: trade?.id ?? "",
			});

			// Trailing stop rule should NOT be relevant
			const trailRule = result.rules.find((r) =>
				r.text.toLowerCase().includes("trail"),
			);
			expect(trailRule).toBeDefined();
			expect(result.relevantRuleIds).not.toContain(trailRule?.id);
		});
	});
});
