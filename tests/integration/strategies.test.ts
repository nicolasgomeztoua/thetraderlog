/**
 * Integration tests for strategies router endpoints.
 *
 * Tests the autosave and getAutoCompliance mutations/queries
 * added in US-034 and US-035.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	createTestTrade,
	createUnauthenticatedCaller,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("strategies router", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;
	let userId: string;
	let accountId: string;
	let strategyId: string;

	beforeAll(async () => {
		await truncateAllTables();

		// Setup main test user
		const { user, account } = await setupTrader();
		userId = user.id;
		accountId = account.id;
		caller = await createTestCaller(user.clerkId, user);

		// Setup another user to test ownership validation
		const { user: otherUser } = await setupTrader({
			user: { email: "other@test.com" },
		});
		otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

		// Create a test strategy
		const strategy = await caller.strategies.create({
			name: "Test Strategy",
			description: "A test strategy",
			color: "#d4ff00",
			isActive: true,
			riskParameters: {
				minRRRatio: 2,
				maxRiskPerTrade: { type: "dollars", value: 500 },
			},
		});
		strategyId = strategy.id;
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =========================================================================
	// AUTOSAVE TESTS
	// =========================================================================

	describe("autosave", () => {
		it("should update only provided fields (sparse update)", async () => {
			// First, get the current state
			const before = await caller.strategies.getById({ id: strategyId });
			expect(before.name).toBe("Test Strategy");
			expect(before.description).toBe("A test strategy");

			// Autosave with only name change
			const result = await caller.strategies.autosave({
				id: strategyId,
				name: "Updated Strategy Name",
			});

			// Should return updatedAt
			expect(result.updatedAt).toBeInstanceOf(Date);

			// Verify only name changed, description preserved
			const after = await caller.strategies.getById({ id: strategyId });
			expect(after.name).toBe("Updated Strategy Name");
			expect(after.description).toBe("A test strategy"); // Unchanged
		});

		it("should return updatedAt timestamp", async () => {
			const before = new Date();

			const result = await caller.strategies.autosave({
				id: strategyId,
				description: "Updated description",
			});

			const after = new Date();

			expect(result.updatedAt).toBeInstanceOf(Date);
			expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(result.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("should reject if not owner", async () => {
			await expect(
				otherCaller.strategies.autosave({
					id: strategyId,
					name: "Hacked Name",
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should update riskParameters when provided", async () => {
			const result = await caller.strategies.autosave({
				id: strategyId,
				riskParameters: {
					minRRRatio: 3,
					maxRiskPerTrade: { type: "percent", value: 2 },
					dailyLossLimit: { type: "dollars", value: 1000 },
				},
			});

			expect(result.updatedAt).toBeInstanceOf(Date);

			const after = await caller.strategies.getById({ id: strategyId });
			expect(after.riskParameters?.minRRRatio).toBe(3);
			expect(after.riskParameters?.maxRiskPerTrade?.type).toBe("percent");
			expect(after.riskParameters?.maxRiskPerTrade?.value).toBe(2);
			expect(after.riskParameters?.dailyLossLimit?.value).toBe(1000);
		});

		it("should replace rules array when provided", async () => {
			// First add some rules
			await caller.strategies.autosave({
				id: strategyId,
				rules: [
					{ text: "Rule 1", category: "entry", order: 0 },
					{ text: "Rule 2", category: "exit", order: 1 },
				],
			});

			let strategy = await caller.strategies.getById({ id: strategyId });
			expect(strategy.rules.length).toBe(2);

			// Replace with new rules
			await caller.strategies.autosave({
				id: strategyId,
				rules: [{ text: "New Rule", category: "risk", order: 0 }],
			});

			strategy = await caller.strategies.getById({ id: strategyId });
			expect(strategy.rules.length).toBe(1);
			expect(strategy.rules[0]?.text).toBe("New Rule");
			expect(strategy.rules[0]?.category).toBe("risk");
		});

		it("should allow clearing nullable fields to null", async () => {
			// Set a description first
			await caller.strategies.autosave({
				id: strategyId,
				description: "Some description",
			});

			let strategy = await caller.strategies.getById({ id: strategyId });
			expect(strategy.description).toBe("Some description");

			// Clear to null
			await caller.strategies.autosave({
				id: strategyId,
				description: null,
			});

			strategy = await caller.strategies.getById({ id: strategyId });
			expect(strategy.description).toBeNull();
		});
	});

	// =========================================================================
	// GET AUTO-COMPLIANCE TESTS
	// =========================================================================

	describe("getAutoCompliance", () => {
		let complianceStrategyId: string;

		beforeAll(async () => {
			// Create a strategy with risk parameters for compliance testing
			const complianceStrategy = await caller.strategies.create({
				name: "Compliance Test Strategy",
				color: "#00ff00",
				riskParameters: {
					minRRRatio: 2, // Require 2:1 R:R
					maxRiskPerTrade: { type: "dollars", value: 500 },
					targetRMultiples: [1, 2, 3],
				},
			});
			complianceStrategyId = complianceStrategy.id;
		});

		it("should return 100% compliance when no trades exist", async () => {
			const result = await caller.strategies.getAutoCompliance({
				strategyId: complianceStrategyId,
			});

			expect(result.totalTrades).toBe(0);
			expect(result.overallCompliance).toBe(100);
			expect(result.parameterCompliance).toEqual([]);
			expect(result.failingTrades).toEqual([]);
		});

		it("should calculate correct compliance for passing trades", async () => {
			// Create a trade that passes all checks
			// ES: $50/point, 10 point stop = $500 risk
			// Entry 5000, SL 4990, TP 5020 = 2:1 R:R
			await createTestTrade(userId, accountId, {
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				strategyId: complianceStrategyId,
				entryPrice: "5000",
				exitPrice: "5020",
				stopLoss: "4990",
				takeProfit: "5020",
				quantity: "1",
				realizedPnl: "1000", // +2R
				netPnl: "1000",
			});

			const result = await caller.strategies.getAutoCompliance({
				strategyId: complianceStrategyId,
			});

			expect(result.totalTrades).toBe(1);
			expect(result.overallCompliance).toBe(100);
			expect(result.failingTrades.length).toBe(0);

			// Check individual parameter compliance
			const minRRCheck = result.parameterCompliance.find(
				(p) => p.param === "minRRRatio",
			);
			expect(minRRCheck?.compliance).toBe(100);
			expect(minRRCheck?.passed).toBe(1);
			expect(minRRCheck?.failed).toBe(0);

			const maxRiskCheck = result.parameterCompliance.find(
				(p) => p.param === "maxRiskPerTrade",
			);
			expect(maxRiskCheck?.compliance).toBe(100);
		});

		it("should track failing trades", async () => {
			// Create a trade that fails minRRRatio check
			// Entry 5000, SL 4990, TP 5005 = 0.5:1 R:R (fails 2:1 requirement)
			await createTestTrade(userId, accountId, {
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				strategyId: complianceStrategyId,
				entryPrice: "5000",
				exitPrice: "5005",
				stopLoss: "4990",
				takeProfit: "5005",
				quantity: "1",
				realizedPnl: "250",
				netPnl: "250",
			});

			const result = await caller.strategies.getAutoCompliance({
				strategyId: complianceStrategyId,
			});

			expect(result.totalTrades).toBe(2); // Previous trade + this one
			expect(result.failingTrades.length).toBeGreaterThan(0);

			// Find the failing trade
			const failingTrade = result.failingTrades.find(
				(t) =>
					t.failedChecks.some((c) => c.param === "minRRRatio") &&
					t.symbol === "ES",
			);
			expect(failingTrade).toBeDefined();
		});

		it("should handle trades without SL/TP gracefully", async () => {
			// Create a trade without stop loss (unable to check risk parameters)
			await createTestTrade(userId, accountId, {
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				strategyId: complianceStrategyId,
				entryPrice: "5000",
				exitPrice: "5010",
				quantity: "1",
				realizedPnl: "500",
				netPnl: "500",
				// No stopLoss or takeProfit
			});

			const result = await caller.strategies.getAutoCompliance({
				strategyId: complianceStrategyId,
			});

			// Should have trades with "unable" counts
			const minRRCheck = result.parameterCompliance.find(
				(p) => p.param === "minRRRatio",
			);
			expect(minRRCheck?.unable).toBeGreaterThan(0);
		});

		it("should return empty compliance when no risk parameters configured", async () => {
			// Create a strategy without risk parameters
			const noParamsStrategy = await caller.strategies.create({
				name: "No Params Strategy",
				color: "#ff0000",
			});

			const result = await caller.strategies.getAutoCompliance({
				strategyId: noParamsStrategy.id,
			});

			expect(result.overallCompliance).toBe(100);
			expect(result.parameterCompliance).toEqual([]);
		});

		it("should reject if strategy not found", async () => {
			await expect(
				caller.strategies.getAutoCompliance({
					strategyId: "non-existent-id",
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should reject if not owner", async () => {
			await expect(
				otherCaller.strategies.getAutoCompliance({
					strategyId: complianceStrategyId,
				}),
			).rejects.toThrow("Strategy not found");
		});
	});

	// =========================================================================
	// AUTH TESTS
	// =========================================================================

	describe("authentication", () => {
		it("should reject unauthenticated autosave requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(
				unauthCaller.strategies.autosave({
					id: strategyId,
					name: "Hacked",
				}),
			).rejects.toThrow();
		});

		it("should reject unauthenticated getAutoCompliance requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(
				unauthCaller.strategies.getAutoCompliance({
					strategyId: strategyId,
				}),
			).rejects.toThrow();
		});
	});

	// =========================================================================
	// CONDITIONAL CHECKLIST TESTS (US-038)
	// =========================================================================

	describe("conditional checklists", () => {
		it("should generate conditional rule when strategy has moveToBreakeven", async () => {
			const strategyWithBreakeven = await caller.strategies.create({
				name: "Breakeven Strategy",
				color: "#00ff00",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.5,
						offsetTicks: 2,
					},
				},
			});

			const strategy = await caller.strategies.getById({
				id: strategyWithBreakeven.id,
			});

			// Should have a conditional_breakeven rule
			const breakevenRule = strategy.rules.find(
				(r) => r.category === "conditional_breakeven",
			);
			expect(breakevenRule).toBeDefined();
			expect(breakevenRule?.text).toContain("breakeven");
			expect(breakevenRule?.text).toContain("1.5R");
			expect(breakevenRule?.text).toContain("+2 ticks offset");
		});

		it("should generate conditional rule without offset when offsetTicks is 0", async () => {
			const strategyNoOffset = await caller.strategies.create({
				name: "Breakeven No Offset Strategy",
				color: "#00ff00",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 2,
						offsetTicks: 0,
					},
				},
			});

			const strategy = await caller.strategies.getById({
				id: strategyNoOffset.id,
			});

			const breakevenRule = strategy.rules.find(
				(r) => r.category === "conditional_breakeven",
			);
			expect(breakevenRule).toBeDefined();
			expect(breakevenRule?.text).toContain("2R");
			expect(breakevenRule?.text).not.toContain("offset");
		});

		it("should generate multiple conditional rules for scaleOut rules", async () => {
			const strategyWithScaling = await caller.strategies.create({
				name: "Scaling Strategy",
				color: "#00ff00",
				scalingRules: {
					scaleOut: [
						{ trigger: "1R", sizePercent: 25 },
						{ trigger: "2R", sizePercent: 50 },
						{ trigger: "3R", sizePercent: 25 },
					],
				},
			});

			const strategy = await caller.strategies.getById({
				id: strategyWithScaling.id,
			});

			// Should have 3 conditional_scale rules
			const scaleRules = strategy.rules.filter(
				(r) => r.category === "conditional_scale",
			);
			expect(scaleRules.length).toBe(3);

			// Check that each scale out rule is represented
			expect(
				scaleRules.some((r) => r.text.includes("25%") && r.text.includes("1R")),
			).toBe(true);
			expect(
				scaleRules.some((r) => r.text.includes("50%") && r.text.includes("2R")),
			).toBe(true);
			expect(
				scaleRules.some((r) => r.text.includes("25%") && r.text.includes("3R")),
			).toBe(true);
		});

		it("should generate trail stop conditional rules", async () => {
			const strategyWithTrails = await caller.strategies.create({
				name: "Trail Strategy",
				color: "#00ff00",
				trailingRules: {
					trailStops: [
						{ triggerR: 2, method: "fixed_ticks", value: 10 },
						{ triggerR: 3, method: "atr_multiple", value: 1.5 },
					],
				},
			});

			const strategy = await caller.strategies.getById({
				id: strategyWithTrails.id,
			});

			// Should have 2 conditional_trail rules
			const trailRules = strategy.rules.filter(
				(r) => r.category === "conditional_trail",
			);
			expect(trailRules.length).toBe(2);

			// Check that each trail rule is represented
			expect(
				trailRules.some(
					(r) => r.text.includes("2R") && r.text.includes("fixed ticks"),
				),
			).toBe(true);
			expect(
				trailRules.some(
					(r) => r.text.includes("3R") && r.text.includes("ATR multiple"),
				),
			).toBe(true);
		});

		it("should preserve manual rules when updating with trailing rules", async () => {
			// Create strategy with manual rules
			const strategyWithRules = await caller.strategies.create({
				name: "Manual and Conditional",
				color: "#00ff00",
				rules: [
					{ text: "Wait for confirmation", category: "entry", order: 0 },
					{ text: "Use proper position size", category: "risk", order: 1 },
				],
			});

			// Now add trailing rules
			await caller.strategies.update({
				id: strategyWithRules.id,
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1,
					},
				},
			});

			const strategy = await caller.strategies.getById({
				id: strategyWithRules.id,
			});

			// Should still have manual rules
			const manualRules = strategy.rules.filter(
				(r) => !r.category.startsWith("conditional_"),
			);
			expect(manualRules.length).toBe(2);

			// Should also have conditional rule
			const conditionalRules = strategy.rules.filter((r) =>
				r.category.startsWith("conditional_"),
			);
			expect(conditionalRules.length).toBe(1);
		});

		it("should regenerate conditional rules when trailingRules are updated", async () => {
			// Create with initial trailing rules
			const strategy = await caller.strategies.create({
				name: "Update Trailing",
				color: "#00ff00",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1,
					},
				},
			});

			// Verify initial conditional rule
			let fetched = await caller.strategies.getById({ id: strategy.id });
			expect(
				fetched.rules.filter((r) => r.category === "conditional_breakeven")
					.length,
			).toBe(1);

			// Update trailing rules to include more
			await caller.strategies.autosave({
				id: strategy.id,
				trailingRules: {
					moveToBreakeven: {
						triggerR: 2,
					},
					trailStops: [{ triggerR: 3, method: "swing_low", value: 0 }],
				},
			});

			// Verify updated conditional rules
			fetched = await caller.strategies.getById({ id: strategy.id });
			const conditionalRules = fetched.rules.filter((r) =>
				r.category.startsWith("conditional_"),
			);

			// Should have 1 breakeven + 1 trail
			expect(conditionalRules.length).toBe(2);
			expect(
				conditionalRules.some((r) => r.category === "conditional_breakeven"),
			).toBe(true);
			expect(
				conditionalRules.some((r) => r.category === "conditional_trail"),
			).toBe(true);
		});

		it("should clear conditional rules when trailingRules are removed", async () => {
			// Create with trailing rules
			const strategy = await caller.strategies.create({
				name: "Remove Trailing",
				color: "#00ff00",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1,
					},
				},
			});

			// Verify conditional rule exists
			let fetched = await caller.strategies.getById({ id: strategy.id });
			expect(
				fetched.rules.filter((r) => r.category.startsWith("conditional_"))
					.length,
			).toBe(1);

			// Remove trailing rules by setting to null
			await caller.strategies.autosave({
				id: strategy.id,
				trailingRules: null,
			});

			// Verify conditional rules are gone
			fetched = await caller.strategies.getById({ id: strategy.id });
			expect(
				fetched.rules.filter((r) => r.category.startsWith("conditional_"))
					.length,
			).toBe(0);
		});

		it("should allow checking conditional rules via tradeRuleChecks", async () => {
			// Create strategy with conditional rule
			const conditionalStrategy = await caller.strategies.create({
				name: "Checkable Conditional",
				color: "#00ff00",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1,
					},
				},
			});

			// Create a trade with this strategy
			const trade = await createTestTrade(userId, accountId, {
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				strategyId: conditionalStrategy.id,
				entryPrice: "5000",
				exitPrice: "5020",
				stopLoss: "4990",
				quantity: "1",
				realizedPnl: "1000",
				netPnl: "1000",
			});

			// Get rule checks for this trade
			const ruleChecksData = await caller.strategies.getTradeRuleChecks({
				tradeId: trade.id,
			});

			// Should have the conditional rule available
			expect(ruleChecksData.rules.length).toBeGreaterThan(0);
			const conditionalRule = ruleChecksData.rules.find(
				(r) => r.category === "conditional_breakeven",
			);
			expect(conditionalRule).toBeDefined();

			// Should be able to check the conditional rule
			await caller.strategies.checkRule({
				tradeId: trade.id,
				ruleId: conditionalRule?.id ?? "",
				checked: true,
			});

			// Verify it was checked
			const updatedData = await caller.strategies.getTradeRuleChecks({
				tradeId: trade.id,
			});
			const check = updatedData.checks.find(
				(c) => c.ruleId === conditionalRule?.id,
			);
			expect(check?.checked).toBe(true);
		});
	});
});
