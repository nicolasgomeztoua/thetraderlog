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
});
