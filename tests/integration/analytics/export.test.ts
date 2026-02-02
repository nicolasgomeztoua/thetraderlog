import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	createTestTrade,
	getAnalyticsFixtureDates,
	setupTrader,
	setupTraderWithAnalyticsData,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

// Get dynamic fixture dates for date range filters
function getFixtureDateRanges() {
	const { baseMonday } = getAnalyticsFixtureDates();

	const monday = new Date(baseMonday);
	const tuesday = new Date(baseMonday);
	tuesday.setUTCDate(tuesday.getUTCDate() + 1);
	const thursday = new Date(baseMonday);
	thursday.setUTCDate(thursday.getUTCDate() + 3);

	// Before the week (no trades expected)
	const beforeWeek = new Date(baseMonday);
	beforeWeek.setUTCDate(beforeWeek.getUTCDate() - 7);

	return {
		mondayStart: new Date(monday.setUTCHours(0, 0, 0, 0)).toISOString(),
		tuesdayEnd: (() => {
			const d = new Date(baseMonday);
			d.setUTCDate(d.getUTCDate() + 1);
			d.setUTCHours(23, 59, 59, 0);
			return d.toISOString();
		})(),
		thursdayStart: new Date(thursday.setUTCHours(0, 0, 0, 0)).toISOString(),
		beforeWeekStart: new Date(beforeWeek.setUTCHours(0, 0, 0, 0)).toISOString(),
		beforeWeekEnd: (() => {
			const d = new Date(beforeWeek);
			d.setUTCDate(d.getUTCDate() + 6);
			d.setUTCHours(23, 59, 59, 0);
			return d.toISOString();
		})(),
	};
}

describe("Analytics Export", () => {
	let caller: TestCaller;
	let testData: Awaited<ReturnType<typeof setupTraderWithAnalyticsData>>;

	beforeAll(async () => {
		await truncateAllTables();
		testData = await setupTraderWithAnalyticsData();
		caller = await createTestCaller(testData.user.clerkId, testData.user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// BASIC EXPORT FUNCTIONALITY
	// ============================================================================

	describe("exportFilteredTrades - Basic", () => {
		it("should return array of trades", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(testData.expectedMetrics.totalTrades);
		});

		it("should return all trades when no filters applied", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result.length).toBe(7);
		});

		it("should order trades by exit time descending", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			// Verify descending order
			for (let i = 1; i < result.length; i++) {
				const prevTrade = result[i - 1];
				const currTrade = result[i];
				const prevExitTime = prevTrade?.exitTime
					? new Date(prevTrade.exitTime).getTime()
					: 0;
				const currExitTime = currTrade?.exitTime
					? new Date(currTrade.exitTime).getTime()
					: 0;
				expect(prevExitTime).toBeGreaterThanOrEqual(currExitTime);
			}
		});
	});

	// ============================================================================
	// EXPORT FIELD VERIFICATION
	// ============================================================================

	describe("exportFilteredTrades - Field Verification", () => {
		it("should have all core trade fields", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result.length).toBeGreaterThan(0);
			const trade = result[0];

			// Core fields
			expect(trade).toHaveProperty("exitTime");
			expect(trade).toHaveProperty("entryTime");
			expect(trade).toHaveProperty("symbol");
			expect(trade).toHaveProperty("direction");
			expect(trade).toHaveProperty("quantity");
		});

		it("should have all price fields", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result.length).toBeGreaterThan(0);
			const trade = result[0];

			expect(trade).toHaveProperty("entryPrice");
			expect(trade).toHaveProperty("exitPrice");
		});

		it("should have all P&L fields", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result.length).toBeGreaterThan(0);
			const trade = result[0];

			expect(trade).toHaveProperty("realizedPnl");
			expect(trade).toHaveProperty("netPnl");
			expect(trade).toHaveProperty("fees");
		});

		it("should include calculated fields (rMultiple, durationMinutes)", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result.length).toBeGreaterThan(0);
			const trade = result[0];

			// R-Multiple and duration are calculated
			expect(trade).toHaveProperty("rMultiple");
			expect(trade).toHaveProperty("durationMinutes");
		});

		it("should include optional metadata fields", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result.length).toBeGreaterThan(0);
			const trade = result[0];

			expect(trade).toHaveProperty("strategyName");
			expect(trade).toHaveProperty("tags");
			expect(trade).toHaveProperty("rating");
			expect(trade).toHaveProperty("isReviewed");
			expect(trade).toHaveProperty("notes");
		});

		it("should return correct data types", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result.length).toBeGreaterThan(0);
			const trade = result[0];
			expect(trade).toBeDefined();
			if (!trade) return;

			// String fields
			expect(typeof trade.symbol).toBe("string");
			expect(typeof trade.direction).toBe("string");

			// Quantity/price are strings from database
			expect(trade.quantity).toBeDefined();
			expect(trade.entryPrice).toBeDefined();
			expect(trade.exitPrice).toBeDefined();

			// Tags should be an array
			expect(Array.isArray(trade.tags)).toBe(true);

			// isReviewed should be boolean
			expect(typeof trade.isReviewed).toBe("boolean");
		});
	});

	// ============================================================================
	// CALCULATED FIELDS
	// ============================================================================

	describe("exportFilteredTrades - Calculated Fields", () => {
		it("should calculate rMultiple for trades with stop loss", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			// Find a trade with stop loss set (most fixture trades have stop loss)
			const tradeWithStopLoss = result.find(
				(t) => t.rMultiple !== null && t.rMultiple !== undefined,
			);

			expect(tradeWithStopLoss).toBeDefined();
			if (tradeWithStopLoss) {
				expect(typeof tradeWithStopLoss.rMultiple).toBe("number");
			}
		});

		it("should return null rMultiple for trades without stop loss", async () => {
			// Create a trade without stop loss
			const { user, account } = await setupTrader();
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				netPnl: "1000",
				stopLoss: undefined,
			});
			const newCaller = await createTestCaller(user.clerkId, user);

			const result = await newCaller.analytics.exportFilteredTrades({
				accountId: account.id,
			});

			// Trade without stop loss should have null rMultiple
			expect(result.length).toBe(1);
			const trade = result[0];
			expect(trade).toBeDefined();
			if (!trade) return;
			expect(trade.rMultiple).toBeNull();
		});

		it("should calculate durationMinutes correctly", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			// Find a trade with valid duration
			const tradeWithDuration = result.find(
				(t) => t.durationMinutes !== null && t.durationMinutes !== undefined,
			);

			expect(tradeWithDuration).toBeDefined();
			if (tradeWithDuration) {
				expect(typeof tradeWithDuration.durationMinutes).toBe("number");
				expect(tradeWithDuration.durationMinutes).toBeGreaterThan(0);
			}
		});

		it("should calculate duration as difference between entry and exit times", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			// Check that duration matches entry/exit time difference
			const trade = result.find(
				(t) => t.entryTime && t.exitTime && t.durationMinutes,
			);
			if (trade?.entryTime && trade.exitTime) {
				const entryMs = new Date(trade.entryTime).getTime();
				const exitMs = new Date(trade.exitTime).getTime();
				const expectedDuration = (exitMs - entryMs) / (1000 * 60);

				expect(trade.durationMinutes).toBeCloseTo(expectedDuration, 1);
			}
		});
	});

	// ============================================================================
	// SYMBOL FILTER
	// ============================================================================

	describe("exportFilteredTrades - Symbol Filter", () => {
		it("should respect symbol filter", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { symbols: ["ES"] },
			});

			// ES has 4 trades in the fixture
			expect(result.length).toBe(4);
			for (const trade of result) {
				expect(trade.symbol).toBe("ES");
			}
		});

		it("should filter by multiple symbols", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { symbols: ["ES", "NQ"] },
			});

			// ES (4) + NQ (2) = 6 trades
			expect(result.length).toBe(6);
			for (const trade of result) {
				expect(["ES", "NQ"]).toContain(trade.symbol);
			}
		});

		it("should return empty array for non-existent symbol", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { symbols: ["AAPL"] },
			});

			expect(result).toEqual([]);
		});
	});

	// ============================================================================
	// OUTCOME FILTER
	// ============================================================================

	describe("exportFilteredTrades - Outcome Filter", () => {
		it("should filter by win outcome", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { outcome: "win" },
			});

			// 4 winning trades in fixture
			expect(result.length).toBe(4);
			for (const trade of result) {
				expect(parseFloat(trade.netPnl ?? "0")).toBeGreaterThan(0);
			}
		});

		it("should filter by loss outcome", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { outcome: "loss" },
			});

			// 3 losing trades with $3 threshold
			expect(result.length).toBe(3);
			for (const trade of result) {
				expect(parseFloat(trade.netPnl ?? "0")).toBeLessThan(0);
			}
		});

		it("should return all trades when outcome is 'all'", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { outcome: "all" },
			});

			expect(result.length).toBe(7);
		});
	});

	// ============================================================================
	// DATE RANGE FILTER
	// ============================================================================

	describe("exportFilteredTrades - Date Range Filter", () => {
		it("should respect date range filter", async () => {
			const dates = getFixtureDateRanges();
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: dates.mondayStart,
						end: dates.tuesdayEnd,
					},
				},
			});

			// Monday and Tuesday only = 3 trades
			expect(result.length).toBe(3);
		});

		it("should filter by start date only", async () => {
			const dates = getFixtureDateRanges();
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: dates.thursdayStart,
						end: null,
					},
				},
			});

			// Thursday (1) + Friday (1) = 2 trades
			expect(result.length).toBe(2);
		});

		it("should filter by end date only", async () => {
			const dates = getFixtureDateRanges();
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: null,
						end: dates.tuesdayEnd,
					},
				},
			});

			// Monday (2) + Tuesday (1) = 3 trades
			expect(result.length).toBe(3);
		});

		it("should return no trades for date range with no trades", async () => {
			const dates = getFixtureDateRanges();
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: dates.beforeWeekStart,
						end: dates.beforeWeekEnd,
					},
				},
			});

			expect(result).toEqual([]);
		});
	});

	// ============================================================================
	// DAY OF WEEK FILTER
	// ============================================================================

	describe("exportFilteredTrades - Day of Week Filter", () => {
		it("should filter by day of week", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { daysOfWeek: [1] }, // Monday
			});

			// Monday has 2 trades
			expect(result.length).toBe(2);
		});

		it("should filter by multiple days", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { daysOfWeek: [1, 3] }, // Monday, Wednesday
			});

			// Monday (2) + Wednesday (2) = 4 trades
			expect(result.length).toBe(4);
		});
	});

	// ============================================================================
	// COMBINED FILTERS
	// ============================================================================

	describe("exportFilteredTrades - Combined Filters", () => {
		it("should combine symbol and outcome filters", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
					outcome: "win",
				},
			});

			// ES wins only
			expect(result.length).toBe(3);
			for (const trade of result) {
				expect(trade.symbol).toBe("ES");
				expect(parseFloat(trade.netPnl ?? "0")).toBeGreaterThan(0);
			}
		});

		it("should combine date range and symbol filters", async () => {
			const dates = getFixtureDateRanges();
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
					dateRange: {
						start: dates.mondayStart,
						end: dates.tuesdayEnd,
					},
				},
			});

			// ES trades on Monday and Tuesday = 2 (both Monday ES trades)
			expect(result.length).toBe(2);
		});

		it("should return empty when filters have no intersection", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					symbols: ["EURUSD"],
					outcome: "win",
				},
			});

			// EURUSD only has 1 trade and it's a loss
			expect(result).toEqual([]);
		});
	});

	// ============================================================================
	// AUTHORIZATION
	// ============================================================================

	describe("exportFilteredTrades - Authorization", () => {
		it("should only return user's own trades", async () => {
			const { user: otherUser } = await setupTrader();
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			// Other user should not be able to export first user's trades
			const result = await otherCaller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			expect(result).toEqual([]);
		});

		it("should return empty for non-existent account", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: "non-existent-account-id",
			});

			expect(result).toEqual([]);
		});

		it("should not return other user's trades even with matching filters", async () => {
			// Create another user with similar trades
			const { user: otherUser, account: otherAccount } = await setupTrader();
			await createTestTrade(otherUser.id, otherAccount.id, {
				symbol: "ES",
				status: "closed",
				netPnl: "1000",
			});
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			// Query original user's account with ES filter
			const result = await otherCaller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { symbols: ["ES"] },
			});

			// Other user should not see testData.user's trades
			expect(result).toEqual([]);
		});
	});

	// ============================================================================
	// EDGE CASES
	// ============================================================================

	describe("exportFilteredTrades - Edge Cases", () => {
		it("should handle user with no trades", async () => {
			const { user: emptyUser, account: emptyAccount } = await setupTrader();
			const emptyCaller = await createTestCaller(emptyUser.clerkId, emptyUser);

			const result = await emptyCaller.analytics.exportFilteredTrades({
				accountId: emptyAccount.id,
			});

			expect(result).toEqual([]);
		});

		it("should handle undefined filters", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: undefined,
			});

			expect(result.length).toBe(7);
		});

		it("should handle empty filters object", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {},
			});

			expect(result.length).toBe(7);
		});

		it("should handle empty array filters", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					symbols: [],
					daysOfWeek: [],
					hours: [],
				},
			});

			expect(result.length).toBe(7);
		});

		it("should handle undefined input", async () => {
			const result = await caller.analytics.exportFilteredTrades();

			// Should use active accounts when no accountId specified
			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
		});

		it("should handle empty object input", async () => {
			const result = await caller.analytics.exportFilteredTrades({});

			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
		});

		it("should handle filtering to a single trade", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					symbols: ["EURUSD"],
				},
			});

			expect(result.length).toBe(1);
			const trade = result[0];
			expect(trade).toBeDefined();
			if (!trade) return;
			expect(trade.symbol).toBe("EURUSD");
		});
	});

	// ============================================================================
	// DATA INTEGRITY
	// ============================================================================

	describe("exportFilteredTrades - Data Integrity", () => {
		it("should export trades with consistent data", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			for (const trade of result) {
				// Every trade should have these core fields
				expect(trade.symbol).toBeTruthy();
				expect(trade.direction).toBeTruthy();
				expect(["long", "short"]).toContain(trade.direction);
			}
		});

		it("should export correct P&L values", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { outcome: "win" },
			});

			// All winning trades should have positive netPnl
			for (const trade of result) {
				const netPnl = parseFloat(trade.netPnl ?? "0");
				expect(netPnl).toBeGreaterThan(0);
			}
		});

		it("should include tags as array", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			for (const trade of result) {
				expect(Array.isArray(trade.tags)).toBe(true);
			}
		});

		it("should preserve numeric precision in prices", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
			});

			// Find EURUSD trade (has decimal precision)
			const forexTrade = result.find((t) => t.symbol === "EURUSD");
			if (forexTrade) {
				// Database stores decimals with 8 decimal places
				expect(parseFloat(forexTrade.entryPrice ?? "0")).toBeCloseTo(1.08, 4);
				expect(parseFloat(forexTrade.exitPrice ?? "0")).toBeCloseTo(1.078, 4);
			}
		});
	});

	// ============================================================================
	// SESSIONS FILTER
	// ============================================================================

	describe("exportFilteredTrades - Sessions Filter", () => {
		it("should filter by London session", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { sessions: ["London"] },
			});

			// All fixture trades are in London session (8-16 UTC)
			expect(result.length).toBe(7);
		});

		it("should filter by New York session", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { sessions: ["New York"] },
			});

			// Trades at 14:00 (Mon), 15:30 (Thu) = 2 trades
			expect(result.length).toBe(2);
		});

		it("should filter by Asia session", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { sessions: ["Asia"] },
			});

			// No trades before 8 UTC
			expect(result.length).toBe(0);
		});
	});

	// ============================================================================
	// HOURS FILTER
	// ============================================================================

	describe("exportFilteredTrades - Hours Filter", () => {
		it("should filter by morning hours", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { hours: [8, 9, 10] },
			});

			// Trades at 8:30 (Fri), 9:00 (Wed), 9:30 (Mon), 10:00 (Tue) = 4 trades
			expect(result.length).toBe(4);
		});

		it("should filter by afternoon hours", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { hours: [14, 15] },
			});

			// Trades at 14:00 (Mon), 15:30 (Thu) = 2 trades
			expect(result.length).toBe(2);
		});
	});

	// ============================================================================
	// REVIEWED FILTER
	// ============================================================================

	describe("exportFilteredTrades - Reviewed Filter", () => {
		it("should filter to unreviewed trades", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { reviewed: "unreviewed" },
			});

			// By default, fixture trades are not reviewed
			expect(result.length).toBe(7);
		});

		it("should filter to reviewed trades", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { reviewed: "reviewed" },
			});

			// No reviewed trades in fixture
			expect(result.length).toBe(0);
		});

		it("should return all trades when reviewed is 'all'", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: { reviewed: "all" },
			});

			expect(result.length).toBe(7);
		});
	});

	// ============================================================================
	// POSITION SIZE RANGE FILTER
	// ============================================================================

	describe("exportFilteredTrades - Position Size Range Filter", () => {
		it("should filter by minimum position size", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					positionSizeRange: { min: 2, max: null },
				},
			});

			// Monday afternoon trade has quantity 2, EURUSD has 100000
			expect(result.length).toBe(2);
		});

		it("should filter by maximum position size", async () => {
			const result = await caller.analytics.exportFilteredTrades({
				accountId: testData.account.id,
				filters: {
					positionSizeRange: { min: null, max: 1 },
				},
			});

			// Most trades have quantity 1
			expect(result.length).toBe(5);
		});
	});

	// ============================================================================
	// MULTIPLE ACCOUNTS
	// ============================================================================

	describe("exportFilteredTrades - Multiple Accounts", () => {
		it("should use active accounts when no accountId specified", async () => {
			const result = await caller.analytics.exportFilteredTrades({});

			// Should return trades from user's active accounts
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should filter by specific accountId", async () => {
			// Create user with account and a trade
			const { user: newUser, account: account1 } = await setupTrader();
			await createTestTrade(newUser.id, account1.id, {
				symbol: "ES",
				status: "closed",
				netPnl: "500",
			});

			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			const result = await newCaller.analytics.exportFilteredTrades({
				accountId: account1.id,
			});

			// Should only return trades from account1
			expect(result.length).toBe(1);
		});
	});
});
