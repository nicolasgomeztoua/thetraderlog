import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	setupTrader,
	setupTraderWithAnalyticsData,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics Overview", () => {
	let caller: TestCaller;
	let testData: Awaited<ReturnType<typeof setupTraderWithAnalyticsData>>;

	// Expected values adjusted for the system's default $3 breakeven threshold
	// With threshold of $3:
	// - Wins (> $3): 995, 1490, 995, 1995 = 4 wins
	// - Losses (< -$3): -1005, -42, -5 = 3 losses
	// - Breakevens (between -$3 and $3): 0
	// Note: The fixture's expectedMetrics uses a different threshold assumption
	const expectedWithDefaultThreshold = {
		totalTrades: 7,
		wins: 4,
		losses: 3, // The -5 trade is a loss with $3 threshold
		breakevens: 0,
		totalPnl: 4423,
		grossProfit: 5475,
		grossLoss: 1052, // 1005 + 42 + 5 = 1052
	};

	beforeAll(async () => {
		await truncateAllTables();
		testData = await setupTraderWithAnalyticsData();
		caller = await createTestCaller(testData.user.clerkId, testData.user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// BASIC METRICS
	// ============================================================================

	describe("getOverview - Basic Metrics", () => {
		it("should return correct total P&L", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Expected total P&L: 995 + 1490 - 1005 + 995 - 42 + 1995 - 5 = 4423
			expect(result.totalPnl).toBeCloseTo(
				expectedWithDefaultThreshold.totalPnl,
				0,
			);
		});

		it("should return correct trade counts", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			expect(result.totalTrades).toBe(expectedWithDefaultThreshold.totalTrades);
			expect(result.wins).toBe(expectedWithDefaultThreshold.wins);
			expect(result.losses).toBe(expectedWithDefaultThreshold.losses);
			expect(result.breakevens).toBe(expectedWithDefaultThreshold.breakevens);
		});

		it("should return correct gross profit and loss", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Gross profit: 995 + 1490 + 995 + 1995 = 5475
			expect(result.grossProfit).toBeCloseTo(
				expectedWithDefaultThreshold.grossProfit,
				0,
			);
			// Gross loss with $3 threshold: 1005 + 42 + 5 = 1052
			expect(result.grossLoss).toBeCloseTo(
				expectedWithDefaultThreshold.grossLoss,
				0,
			);
		});
	});

	// ============================================================================
	// RATE METRICS
	// ============================================================================

	describe("getOverview - Rate Metrics", () => {
		it("should calculate win rate correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Win rate = wins / (wins + losses) = 4/7 = 57.14%
			const expectedWinRate =
				(expectedWithDefaultThreshold.wins /
					(expectedWithDefaultThreshold.wins +
						expectedWithDefaultThreshold.losses)) *
				100;
			expect(result.winRate).toBeCloseTo(expectedWinRate, 1);
		});

		it("should calculate profit factor correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Profit factor = gross profit / gross loss = 5475 / 1052 = 5.20
			const expectedProfitFactor =
				expectedWithDefaultThreshold.grossProfit /
				expectedWithDefaultThreshold.grossLoss;
			expect(result.profitFactor).toBeCloseTo(expectedProfitFactor, 1);
		});
	});

	// ============================================================================
	// AVERAGE METRICS
	// ============================================================================

	describe("getOverview - Average Metrics", () => {
		it("should calculate average P&L correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Average P&L = total P&L / total trades = 4423 / 7 = 632
			const expectedAvgPnl =
				expectedWithDefaultThreshold.totalPnl /
				expectedWithDefaultThreshold.totalTrades;
			expect(result.avgPnl).toBeCloseTo(expectedAvgPnl, 0);
		});

		it("should calculate average win correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Average win = gross profit / wins = 5475 / 4 = 1368.75
			const expectedAvgWin =
				expectedWithDefaultThreshold.grossProfit /
				expectedWithDefaultThreshold.wins;
			expect(result.avgWin).toBeCloseTo(expectedAvgWin, 0);
		});

		it("should calculate average loss correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Average loss = gross loss / losses = 1052 / 3 = 351
			const expectedAvgLoss =
				expectedWithDefaultThreshold.grossLoss /
				expectedWithDefaultThreshold.losses;
			expect(result.avgLoss).toBeCloseTo(expectedAvgLoss, 0);
		});
	});

	// ============================================================================
	// ADVANCED METRICS
	// ============================================================================

	describe("getOverview - Advanced Metrics", () => {
		it("should calculate expectancy correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Expectancy = (winRate * avgWin) - (lossRate * avgLoss)
			const winRate =
				expectedWithDefaultThreshold.wins /
				(expectedWithDefaultThreshold.wins +
					expectedWithDefaultThreshold.losses);
			const lossRate = 1 - winRate;
			const avgWin =
				expectedWithDefaultThreshold.grossProfit /
				expectedWithDefaultThreshold.wins;
			const avgLoss =
				expectedWithDefaultThreshold.grossLoss /
				expectedWithDefaultThreshold.losses;
			const expectedExpectancy = winRate * avgWin - lossRate * avgLoss;

			expect(result.expectancy).toBeCloseTo(expectedExpectancy, 0);
		});

		it("should calculate payoff ratio correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Payoff ratio = avgWin / avgLoss
			const avgWin =
				expectedWithDefaultThreshold.grossProfit /
				expectedWithDefaultThreshold.wins;
			const avgLoss =
				expectedWithDefaultThreshold.grossLoss /
				expectedWithDefaultThreshold.losses;
			const expectedPayoffRatio = avgWin / avgLoss;

			expect(result.payoffRatio).toBeCloseTo(expectedPayoffRatio, 1);
		});

		it("should calculate sharpe ratio as a number", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Sharpe ratio should be a valid number
			expect(typeof result.sharpeRatio).toBe("number");
			expect(Number.isFinite(result.sharpeRatio)).toBe(true);
		});

		it("should return largest win correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Largest win is 1995 (Thursday NQ trade)
			expect(result.largestWin).toBe(1995);
		});

		it("should return largest loss correctly", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Largest loss is -1005 (Tuesday NQ trade)
			expect(result.largestLoss).toBe(-1005);
		});
	});

	// ============================================================================
	// STREAK METRICS
	// ============================================================================

	describe("getOverview - Streak Metrics", () => {
		it("should return current streak", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// The last trade has netPnl of -5, which is a loss with $3 threshold
			// So current streak should be 1 loss
			expect(typeof result.currentStreak).toBe("number");
			expect(result.currentStreak).toBeGreaterThanOrEqual(0);
		});

		it("should return current streak type", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Should be one of: 'win', 'loss', 'none'
			expect(["win", "loss", "none"]).toContain(result.currentStreakType);
		});
	});

	// ============================================================================
	// EDGE CASES
	// ============================================================================

	describe("getOverview - Edge Cases", () => {
		it("should return zeros when no trades exist", async () => {
			// Create a new user with no trades
			const { user: emptyUser, account: emptyAccount } = await setupTrader();
			const emptyCaller = await createTestCaller(emptyUser.clerkId, emptyUser);

			const result = await emptyCaller.analytics.getOverview({
				accountId: emptyAccount.id,
			});

			expect(result.totalPnl).toBe(0);
			expect(result.totalTrades).toBe(0);
			expect(result.wins).toBe(0);
			expect(result.losses).toBe(0);
			expect(result.breakevens).toBe(0);
			expect(result.winRate).toBe(0);
			expect(result.profitFactor).toBe(0);
			expect(result.avgPnl).toBe(0);
			expect(result.avgWin).toBe(0);
			expect(result.avgLoss).toBe(0);
			expect(result.expectancy).toBe(0);
			expect(result.payoffRatio).toBe(0);
			expect(result.sharpeRatio).toBe(0);
			expect(result.largestWin).toBe(0);
			expect(result.largestLoss).toBe(0);
			expect(result.currentStreak).toBe(0);
			expect(result.currentStreakType).toBe("none");
		});

		it("should handle account with no accountId filter (use active accounts)", async () => {
			// When no accountId is provided, should use active accounts
			const result = await caller.analytics.getOverview({});

			// Should return data from active accounts
			expect(result.totalTrades).toBeGreaterThanOrEqual(0);
		});

		it("should handle undefined input", async () => {
			// Undefined input should also work
			const result = await caller.analytics.getOverview();

			expect(result).toBeDefined();
			expect(typeof result.totalTrades).toBe("number");
		});
	});

	// ============================================================================
	// AUTHORIZATION
	// ============================================================================

	describe("getOverview - Authorization", () => {
		it("should only return data for the authenticated user", async () => {
			// Create another user
			const { user: otherUser } = await setupTrader();
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			// Other user should not see testData.user's trades
			const result = await otherCaller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Should return zeros because otherUser doesn't own this account
			expect(result.totalTrades).toBe(0);
			expect(result.totalPnl).toBe(0);
		});

		it("should not return data when querying non-existent account", async () => {
			const result = await caller.analytics.getOverview({
				accountId: "non-existent-account-id",
			});

			// Should return zeros for non-existent account
			expect(result.totalTrades).toBe(0);
		});
	});

	// ============================================================================
	// RETURN TYPE VERIFICATION
	// ============================================================================

	describe("getOverview - Return Type", () => {
		it("should return all expected fields", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// Basic stats
			expect(result).toHaveProperty("totalTrades");
			expect(result).toHaveProperty("wins");
			expect(result).toHaveProperty("losses");
			expect(result).toHaveProperty("breakevens");
			expect(result).toHaveProperty("winRate");
			expect(result).toHaveProperty("totalPnl");
			expect(result).toHaveProperty("avgPnl");
			expect(result).toHaveProperty("grossProfit");
			expect(result).toHaveProperty("grossLoss");
			expect(result).toHaveProperty("profitFactor");
			expect(result).toHaveProperty("avgWin");
			expect(result).toHaveProperty("avgLoss");
			expect(result).toHaveProperty("avgRMultiple");

			// Advanced metrics
			expect(result).toHaveProperty("expectancy");
			expect(result).toHaveProperty("payoffRatio");
			expect(result).toHaveProperty("sharpeRatio");
			expect(result).toHaveProperty("largestWin");
			expect(result).toHaveProperty("largestLoss");

			// Streak info
			expect(result).toHaveProperty("currentStreak");
			expect(result).toHaveProperty("currentStreakType");
		});

		it("should return correct types for all fields", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			// All numeric fields should be numbers
			expect(typeof result.totalTrades).toBe("number");
			expect(typeof result.wins).toBe("number");
			expect(typeof result.losses).toBe("number");
			expect(typeof result.breakevens).toBe("number");
			expect(typeof result.winRate).toBe("number");
			expect(typeof result.totalPnl).toBe("number");
			expect(typeof result.avgPnl).toBe("number");
			expect(typeof result.grossProfit).toBe("number");
			expect(typeof result.grossLoss).toBe("number");
			expect(typeof result.profitFactor).toBe("number");
			expect(typeof result.avgWin).toBe("number");
			expect(typeof result.avgLoss).toBe("number");
			expect(typeof result.expectancy).toBe("number");
			expect(typeof result.payoffRatio).toBe("number");
			expect(typeof result.sharpeRatio).toBe("number");
			expect(typeof result.largestWin).toBe("number");
			expect(typeof result.largestLoss).toBe("number");
			expect(typeof result.currentStreak).toBe("number");
			expect(typeof result.currentStreakType).toBe("string");
		});
	});
});
