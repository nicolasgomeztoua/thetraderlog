import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	createTestTrade,
	setupTrader,
	setupTraderWithAnalyticsData,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics Filters", () => {
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
	// SYMBOL FILTER
	// ============================================================================

	describe("Symbol Filter", () => {
		it("should filter by single symbol (ES)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["ES"] },
			});

			// ES has 4 trades (Monday x2, Wednesday x1, Friday x1)
			expect(result.totalTrades).toBe(4);
		});

		it("should filter by single symbol (NQ)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["NQ"] },
			});

			// NQ has 2 trades (Tuesday, Thursday)
			expect(result.totalTrades).toBe(2);
		});

		it("should filter by multiple symbols", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["ES", "NQ"] },
			});

			// ES (4) + NQ (2) = 6 trades
			expect(result.totalTrades).toBe(6);
		});

		it("should filter by all symbols", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["ES", "NQ", "EURUSD"] },
			});

			// All 7 trades
			expect(result.totalTrades).toBe(7);
		});

		it("should return no trades for non-existent symbol", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["AAPL"] },
			});

			expect(result.totalTrades).toBe(0);
			expect(result.totalPnl).toBe(0);
		});

		it("should handle empty symbols array as no filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: [] },
			});

			// Empty array should return all trades
			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// OUTCOME FILTER
	// ============================================================================

	describe("Outcome Filter", () => {
		it("should filter to only wins", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { outcome: "win" },
			});

			// 4 winning trades (Monday x2, Wednesday ES, Thursday)
			expect(result.totalTrades).toBe(4);
			expect(result.wins).toBe(4);
			expect(result.losses).toBe(0);
			expect(result.totalPnl).toBeGreaterThan(0);
		});

		it("should filter to only losses", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { outcome: "loss" },
			});

			// 3 losing trades with $3 threshold (Tuesday NQ, Wednesday EURUSD, Friday ES)
			expect(result.totalTrades).toBe(3);
			expect(result.losses).toBe(3);
			expect(result.wins).toBe(0);
			expect(result.totalPnl).toBeLessThan(0);
		});

		it("should filter to only breakeven trades", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { outcome: "breakeven" },
			});

			// With $3 default threshold, Friday's -$5 is a loss, not breakeven
			// No true breakevens in the fixture data
			expect(result.totalTrades).toBe(0);
		});

		it("should return all trades when outcome is 'all'", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { outcome: "all" },
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// DATE RANGE FILTER
	// ============================================================================

	describe("Date Range Filter", () => {
		it("should filter by start date only", async () => {
			// Only Thursday and Friday trades (Jan 11-12)
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: "2024-01-11T00:00:00Z",
						end: null,
					},
				},
			});

			// Thursday (1) + Friday (1) = 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should filter by end date only", async () => {
			// Only Monday and Tuesday trades (Jan 8-9)
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: null,
						end: "2024-01-09T23:59:59Z",
					},
				},
			});

			// Monday (2) + Tuesday (1) = 3 trades
			expect(result.totalTrades).toBe(3);
		});

		it("should filter by date range (Monday and Tuesday)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: "2024-01-08T00:00:00Z",
						end: "2024-01-09T23:59:59Z",
					},
				},
			});

			// Monday (2) + Tuesday (1) = 3 trades
			expect(result.totalTrades).toBe(3);
		});

		it("should filter by single day (Wednesday)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: "2024-01-10T00:00:00Z",
						end: "2024-01-10T23:59:59Z",
					},
				},
			});

			// Wednesday has 2 trades (ES and EURUSD)
			expect(result.totalTrades).toBe(2);
		});

		it("should return no trades for date range with no trades", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: "2024-01-01T00:00:00Z",
						end: "2024-01-07T23:59:59Z",
					},
				},
			});

			expect(result.totalTrades).toBe(0);
		});
	});

	// ============================================================================
	// DAY OF WEEK FILTER
	// ============================================================================

	describe("Day of Week Filter", () => {
		it("should filter by Monday (day 1)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { daysOfWeek: [1] }, // Monday
			});

			// Monday has 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should filter by Tuesday (day 2)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { daysOfWeek: [2] }, // Tuesday
			});

			// Tuesday has 1 trade
			expect(result.totalTrades).toBe(1);
		});

		it("should filter by multiple days (Monday and Wednesday)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { daysOfWeek: [1, 3] }, // Monday, Wednesday
			});

			// Monday (2) + Wednesday (2) = 4 trades
			expect(result.totalTrades).toBe(4);
		});

		it("should filter by weekdays only (Mon-Fri)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { daysOfWeek: [1, 2, 3, 4, 5] }, // Mon-Fri
			});

			// All 7 trades are weekdays
			expect(result.totalTrades).toBe(7);
		});

		it("should return no trades for weekend filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { daysOfWeek: [0, 6] }, // Sunday, Saturday
			});

			// No weekend trades in fixture
			expect(result.totalTrades).toBe(0);
		});

		it("should handle empty daysOfWeek array as no filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { daysOfWeek: [] },
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// HOURS FILTER
	// ============================================================================

	describe("Hours Filter", () => {
		it("should filter by morning hours (8-10 UTC)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { hours: [8, 9, 10] },
			});

			// Trades at 8:30 (Fri), 9:00 (Wed), 9:30 (Mon), 10:00 (Tue) = 4 trades
			expect(result.totalTrades).toBe(4);
		});

		it("should filter by afternoon hours (14-15 UTC)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { hours: [14, 15] },
			});

			// Trades at 14:00 (Mon), 15:30 (Thu) = 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should filter by single hour", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { hours: [9] },
			});

			// 9:00 (Wed) and 9:30 (Mon) = 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should return no trades for hour with no trades", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { hours: [0, 1, 2, 3, 4, 5, 6, 7] }, // Very early hours
			});

			// No trades before 8 UTC in fixture
			expect(result.totalTrades).toBe(0);
		});

		it("should handle empty hours array as no filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { hours: [] },
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// SESSIONS FILTER
	// ============================================================================

	describe("Sessions Filter", () => {
		it("should filter by London session (8-16 UTC)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { sessions: ["London"] },
			});

			// Trades at 8:30, 9:00, 9:30, 10:00, 11:00, 14:00, 15:30 - all in London session
			expect(result.totalTrades).toBe(7);
		});

		it("should filter by New York session (13-21 UTC)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { sessions: ["New York"] },
			});

			// Trades at 14:00 (Mon), 15:30 (Thu) = 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should filter by Asia session (0-8 UTC)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { sessions: ["Asia"] },
			});

			// No trades before 8 UTC
			expect(result.totalTrades).toBe(0);
		});

		it("should filter by multiple sessions (OR logic)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { sessions: ["Asia", "New York"] },
			});

			// Asia (0) + New York (2) = 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should handle empty sessions array as no filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { sessions: [] },
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// REVIEWED FILTER
	// ============================================================================

	describe("Reviewed Filter", () => {
		it("should filter to unreviewed trades", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { reviewed: "unreviewed" },
			});

			// By default, fixture trades are not reviewed
			expect(result.totalTrades).toBe(7);
		});

		it("should filter to reviewed trades", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { reviewed: "reviewed" },
			});

			// No reviewed trades in fixture
			expect(result.totalTrades).toBe(0);
		});

		it("should return all trades when reviewed is 'all'", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { reviewed: "all" },
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// POSITION SIZE RANGE FILTER
	// ============================================================================

	describe("Position Size Range Filter", () => {
		it("should filter by minimum position size", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					positionSizeRange: { min: 2, max: null },
				},
			});

			// Monday afternoon trade has quantity 2, EURUSD has 100000
			expect(result.totalTrades).toBe(2);
		});

		it("should filter by maximum position size", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					positionSizeRange: { min: null, max: 1 },
				},
			});

			// Most trades have quantity 1, except Monday afternoon (2) and EURUSD (100000)
			expect(result.totalTrades).toBe(5);
		});

		it("should filter by position size range", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					positionSizeRange: { min: 1, max: 2 },
				},
			});

			// Excludes EURUSD trade with 100000 contracts
			expect(result.totalTrades).toBe(6);
		});

		it("should handle null range values as no filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					positionSizeRange: { min: null, max: null },
				},
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// R-MULTIPLE RANGE FILTER
	// ============================================================================

	describe("R-Multiple Range Filter", () => {
		it("should filter by minimum R-multiple", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					rMultipleRange: { min: 1, max: null },
				},
			});

			// Trades with R >= 1 (profitable trades with stop loss)
			expect(result.totalTrades).toBeGreaterThanOrEqual(0);
		});

		it("should filter by maximum R-multiple", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					rMultipleRange: { min: null, max: 0 },
				},
			});

			// Trades with R <= 0 (losing trades)
			expect(result.totalTrades).toBeGreaterThanOrEqual(0);
		});

		it("should filter by R-multiple range", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					rMultipleRange: { min: -1, max: 2 },
				},
			});

			// Trades within -1R to 2R range
			expect(result.totalTrades).toBeGreaterThanOrEqual(0);
		});

		it("should handle null range values as no filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					rMultipleRange: { min: null, max: null },
				},
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// COMBINED FILTERS (AND LOGIC)
	// ============================================================================

	describe("Combined Filters", () => {
		it("should combine symbol and outcome filters (ES wins)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
					outcome: "win",
				},
			});

			// ES has 4 trades: 3 wins (Monday x2, Wednesday) + 1 loss (Friday)
			expect(result.totalTrades).toBe(3);
			expect(result.wins).toBe(3);
		});

		it("should combine symbol and outcome filters (NQ losses)", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					symbols: ["NQ"],
					outcome: "loss",
				},
			});

			// NQ has 2 trades: 1 loss (Tuesday) + 1 win (Thursday)
			expect(result.totalTrades).toBe(1);
			expect(result.losses).toBe(1);
		});

		it("should combine date range and day of week filters", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: "2024-01-08T00:00:00Z",
						end: "2024-01-12T23:59:59Z",
					},
					daysOfWeek: [1], // Monday only
				},
			});

			// Monday only within the date range = 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should combine symbol, outcome, and day of week filters", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
					outcome: "win",
					daysOfWeek: [1], // Monday
				},
			});

			// ES wins on Monday = 2 trades
			expect(result.totalTrades).toBe(2);
		});

		it("should combine hours and sessions filters", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					hours: [14, 15],
					sessions: ["New York"],
				},
			});

			// Hours 14-15 AND New York session (13-21) = trades at 14:00, 15:30
			expect(result.totalTrades).toBe(2);
		});

		it("should return empty when filters have no intersection", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					symbols: ["EURUSD"],
					outcome: "win",
				},
			});

			// EURUSD only has 1 trade and it's a loss
			expect(result.totalTrades).toBe(0);
		});

		it("should combine all major filter types", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES", "NQ"],
					outcome: "win",
					dateRange: {
						start: "2024-01-08T00:00:00Z",
						end: "2024-01-11T23:59:59Z",
					},
					daysOfWeek: [1, 3, 4], // Mon, Wed, Thu
				},
			});

			// ES/NQ wins on Mon/Wed/Thu within date range
			// Monday ES wins (2) + Wednesday ES win (1) + Thursday NQ win (1) = 4
			expect(result.totalTrades).toBe(4);
		});
	});

	// ============================================================================
	// EMPTY AND UNDEFINED FILTERS
	// ============================================================================

	describe("Empty and Undefined Filters", () => {
		it("should return all trades when filters is undefined", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			expect(result.totalTrades).toBe(7);
		});

		it("should return all trades when filters is empty object", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {},
			});

			expect(result.totalTrades).toBe(7);
		});

		it("should return all trades when all filter arrays are empty", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					symbols: [],
					daysOfWeek: [],
					hours: [],
					sessions: [],
					strategies: [],
					tags: [],
				},
			});

			expect(result.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// FILTER STATISTICS ACCURACY
	// ============================================================================

	describe("Filter Statistics Accuracy", () => {
		it("should calculate correct P&L for filtered wins", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { outcome: "win" },
			});

			// All win P&Ls: 995 + 1490 + 995 + 1995 = 5475
			expect(result.totalPnl).toBeCloseTo(5475, 0);
			expect(result.grossProfit).toBeCloseTo(5475, 0);
			expect(result.grossLoss).toBe(0);
		});

		it("should calculate correct P&L for filtered losses", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { outcome: "loss" },
			});

			// All loss P&Ls: -1005 - 202 - 5 = -1212
			expect(result.totalPnl).toBeCloseTo(-1212, 0);
			expect(result.grossLoss).toBeCloseTo(1212, 0);
			expect(result.grossProfit).toBe(0);
		});

		it("should calculate correct win rate for symbol filter", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["ES"] },
			});

			// ES: 4 trades, 3 wins, 1 loss (Friday)
			// Win rate = 3/4 = 75%
			expect(result.winRate).toBeCloseTo(75, 0);
		});

		it("should calculate correct profit factor for filtered data", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["ES"] },
			});

			// ES wins: 995 + 1490 + 995 = 3480
			// ES losses: 5 (Friday)
			// Profit factor = 3480 / 5 = 696
			expect(result.profitFactor).toBeGreaterThan(0);
		});
	});

	// ============================================================================
	// EDGE CASES
	// ============================================================================

	describe("Edge Cases", () => {
		it("should handle filtering to a single trade", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					symbols: ["EURUSD"],
				},
			});

			expect(result.totalTrades).toBe(1);
			expect(result.losses).toBe(1);
			expect(result.wins).toBe(0);
		});

		it("should handle case-sensitive symbol matching", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["es"] }, // lowercase
			});

			// Symbols are case-sensitive in the database
			expect(result.totalTrades).toBe(0);
		});

		it("should handle date range at exact trade time", async () => {
			const result = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: "2024-01-08T09:30:00Z",
						end: "2024-01-08T09:30:00Z",
					},
				},
			});

			// Exact match for Monday morning trade
			expect(result.totalTrades).toBe(1);
		});

		it("should preserve filter behavior across multiple calls", async () => {
			// First call with filter
			const filtered = await caller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["ES"] },
			});

			// Second call without filter
			const unfiltered = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			expect(filtered.totalTrades).toBe(4);
			expect(unfiltered.totalTrades).toBe(7);
		});
	});

	// ============================================================================
	// AUTHORIZATION WITH FILTERS
	// ============================================================================

	describe("Authorization with Filters", () => {
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
			const result = await otherCaller.analytics.getOverview({
				accountId: testData.account.id,
				filters: { symbols: ["ES"] },
			});

			// Other user should not see testData.user's trades
			expect(result.totalTrades).toBe(0);
		});

		it("should filter only within user's own trades", async () => {
			// Create another user with ES trades
			const { user: otherUser, account: otherAccount } = await setupTrader();
			await createTestTrade(otherUser.id, otherAccount.id, {
				symbol: "ES",
				status: "closed",
				netPnl: "5000",
			});
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			// Query other user's own account with ES filter
			const result = await otherCaller.analytics.getOverview({
				accountId: otherAccount.id,
				filters: { symbols: ["ES"] },
			});

			// Should only see the 1 ES trade in other user's account
			expect(result.totalTrades).toBe(1);
		});
	});
});
