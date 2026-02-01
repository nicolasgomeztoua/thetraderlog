import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	getAnalyticsFixtureMonth,
	setupTrader,
	setupTraderWithAnalyticsData,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics Symbols", () => {
	let caller: TestCaller;
	let testData: Awaited<ReturnType<typeof setupTraderWithAnalyticsData>>;

	// Expected symbol breakdown from setupTraderWithAnalyticsData:
	// ES: 4 trades (3 wins @ 995, 1490, 995, 1 breakeven @ -5)
	//     - Total P&L: 995 + 1490 + 995 - 5 = 3475
	//     - With $3 breakeven threshold: 3 wins, 1 loss
	// NQ: 2 trades (1 win @ 1995, 1 loss @ -1005)
	//     - Total P&L: 1995 - 1005 = 990
	//     - 1 win, 1 loss = 50% win rate
	// EURUSD: 1 trade (1 loss @ -202)
	//     - Total P&L: -202
	//     - 0 wins, 1 loss = 0% win rate

	beforeAll(async () => {
		await truncateAllTables();
		testData = await setupTraderWithAnalyticsData();
		caller = await createTestCaller(testData.user.clerkId, testData.user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// getPerformanceBySymbol - Symbol Performance Breakdown
	// ============================================================================

	describe("getPerformanceBySymbol", () => {
		describe("Return Type Verification", () => {
			it("should return an array of symbol performance data", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
			});

			it("should return correct number of symbols (3: ES, NQ, EURUSD)", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				expect(result.length).toBe(3);
			});

			it("should have all expected fields for each symbol", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				for (const symbolData of result) {
					expect(symbolData).toHaveProperty("symbol");
					expect(symbolData).toHaveProperty("pnl");
					expect(symbolData).toHaveProperty("trades");
					expect(symbolData).toHaveProperty("wins");
					expect(symbolData).toHaveProperty("losses");
					expect(symbolData).toHaveProperty("winRate");
					expect(symbolData).toHaveProperty("profitFactor");
					expect(symbolData).toHaveProperty("avgTrade");
					expect(symbolData).toHaveProperty("avgWin");
					expect(symbolData).toHaveProperty("avgLoss");
				}
			});

			it("should return correct types for all fields", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				for (const symbolData of result) {
					expect(typeof symbolData.symbol).toBe("string");
					expect(typeof symbolData.pnl).toBe("number");
					expect(typeof symbolData.trades).toBe("number");
					expect(typeof symbolData.wins).toBe("number");
					expect(typeof symbolData.losses).toBe("number");
					expect(typeof symbolData.winRate).toBe("number");
					expect(typeof symbolData.profitFactor).toBe("number");
					expect(typeof symbolData.avgTrade).toBe("number");
					expect(typeof symbolData.avgWin).toBe("number");
					expect(typeof symbolData.avgLoss).toBe("number");
				}
			});
		});

		describe("Symbol Trade Counts", () => {
			it("should have ES with 4 trades", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const es = result.find((r) => r.symbol === "ES");
				expect(es).toBeDefined();
				expect(es?.trades).toBe(4);
			});

			it("should have NQ with 2 trades", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const nq = result.find((r) => r.symbol === "NQ");
				expect(nq).toBeDefined();
				expect(nq?.trades).toBe(2);
			});

			it("should have EURUSD with 1 trade", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const eurusd = result.find((r) => r.symbol === "EURUSD");
				expect(eurusd).toBeDefined();
				expect(eurusd?.trades).toBe(1);
			});

			it("should have total trades summing to 7", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const totalTrades = result.reduce((sum, r) => sum + r.trades, 0);
				expect(totalTrades).toBe(testData.expectedMetrics.totalTrades);
			});
		});

		describe("Symbol P&L Calculations", () => {
			it("should have ES with positive total P&L", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const es = result.find((r) => r.symbol === "ES");
				// ES P&L: 995 + 1490 + 995 - 5 = 3475
				expect(es?.pnl).toBeCloseTo(3475, 0);
			});

			it("should have NQ with positive total P&L", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const nq = result.find((r) => r.symbol === "NQ");
				// NQ P&L: 1995 - 1005 = 990
				expect(nq?.pnl).toBeCloseTo(990, 0);
			});

			it("should have EURUSD with negative total P&L", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const eurusd = result.find((r) => r.symbol === "EURUSD");
				// EURUSD P&L: -202
				expect(eurusd?.pnl).toBeCloseTo(-202, 0);
			});

			it("should have total P&L across all symbols summing to expected value", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const totalPnl = result.reduce((sum, r) => sum + r.pnl, 0);
				expect(totalPnl).toBeCloseTo(testData.expectedMetrics.totalPnl, 0);
			});
		});

		describe("Symbol Win Rate Calculations", () => {
			it("should calculate NQ win rate correctly (50%)", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const nq = result.find((r) => r.symbol === "NQ");
				// NQ: 1 win, 1 loss = 50% win rate
				expect(nq?.winRate).toBeCloseTo(50, 0);
			});

			it("should calculate EURUSD win rate correctly (0%)", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const eurusd = result.find((r) => r.symbol === "EURUSD");
				// EURUSD: 0 wins, 1 loss = 0% win rate
				expect(eurusd?.winRate).toBeCloseTo(0, 0);
			});

			it("should have ES with high win rate", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const es = result.find((r) => r.symbol === "ES");
				// ES: 3 wins, 1 loss = 75% win rate (with $3 threshold)
				expect(es?.winRate).toBeCloseTo(75, 0);
			});

			it("should have win rates between 0 and 100", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				for (const symbolData of result) {
					expect(symbolData.winRate).toBeGreaterThanOrEqual(0);
					expect(symbolData.winRate).toBeLessThanOrEqual(100);
				}
			});
		});

		describe("Symbol Wins and Losses Breakdown", () => {
			it("should have correct wins and losses for ES", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const es = result.find((r) => r.symbol === "ES");
				// ES: 3 wins (995, 1490, 995), 1 loss (-5 with $3 threshold)
				expect(es?.wins).toBe(3);
				expect(es?.losses).toBe(1);
			});

			it("should have correct wins and losses for NQ", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const nq = result.find((r) => r.symbol === "NQ");
				// NQ: 1 win (1995), 1 loss (-1005)
				expect(nq?.wins).toBe(1);
				expect(nq?.losses).toBe(1);
			});

			it("should have correct wins and losses for EURUSD", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const eurusd = result.find((r) => r.symbol === "EURUSD");
				// EURUSD: 0 wins, 1 loss (-202)
				expect(eurusd?.wins).toBe(0);
				expect(eurusd?.losses).toBe(1);
			});

			it("should have wins + losses = trades when no breakevens", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				for (const symbolData of result) {
					// wins + losses should equal or be less than trades (breakevens excluded)
					expect(symbolData.wins + symbolData.losses).toBeLessThanOrEqual(
						symbolData.trades,
					);
				}
			});
		});

		describe("Symbol Profit Factor Calculations", () => {
			it("should have ES with positive profit factor", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const es = result.find((r) => r.symbol === "ES");
				// ES gross profit: 995 + 1490 + 995 = 3480
				// ES gross loss: 5
				// Profit factor: 3480 / 5 = 696
				expect(es?.profitFactor).toBeGreaterThan(0);
			});

			it("should have NQ with profit factor greater than 1", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const nq = result.find((r) => r.symbol === "NQ");
				// NQ gross profit: 1995, gross loss: 1005
				// Profit factor: 1995 / 1005 = ~1.98
				expect(nq?.profitFactor).toBeCloseTo(1.98, 1);
			});

			it("should have EURUSD with profit factor of 0 (no wins)", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const eurusd = result.find((r) => r.symbol === "EURUSD");
				// EURUSD: 0 wins, so profit factor = 0
				expect(eurusd?.profitFactor).toBe(0);
			});

			it("should have non-negative profit factors", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				for (const symbolData of result) {
					expect(symbolData.profitFactor).toBeGreaterThanOrEqual(0);
				}
			});
		});

		describe("Symbol Average Trade Calculations", () => {
			it("should have correct average trade for ES", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const es = result.find((r) => r.symbol === "ES");
				// ES avg trade: 3475 / 4 = 868.75
				expect(es?.avgTrade).toBeCloseTo(868.75, 0);
			});

			it("should have correct average trade for NQ", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const nq = result.find((r) => r.symbol === "NQ");
				// NQ avg trade: 990 / 2 = 495
				expect(nq?.avgTrade).toBeCloseTo(495, 0);
			});

			it("should have correct average trade for EURUSD", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				const eurusd = result.find((r) => r.symbol === "EURUSD");
				// EURUSD avg trade: -202 / 1 = -202
				expect(eurusd?.avgTrade).toBeCloseTo(-202, 0);
			});
		});

		describe("Sorting", () => {
			it("should be sorted by P&L descending (best performing first)", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				for (let i = 1; i < result.length; i++) {
					const current = result[i];
					const previous = result[i - 1];
					expect(current?.pnl).toBeLessThanOrEqual(previous?.pnl ?? 0);
				}
			});

			it("should have ES as the best performing symbol", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				expect(result[0]?.symbol).toBe("ES");
			});

			it("should have EURUSD as the worst performing symbol", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				expect(result[result.length - 1]?.symbol).toBe("EURUSD");
			});
		});

		describe("Edge Cases", () => {
			it("should return empty array when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getPerformanceBySymbol({
					accountId: emptyAccount.id,
				});

				expect(result).toEqual([]);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getPerformanceBySymbol();

				expect(Array.isArray(result)).toBe(true);
			});

			it("should handle empty object input", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({});

				expect(Array.isArray(result)).toBe(true);
			});
		});

		describe("Authorization", () => {
			it("should only return data for the authenticated user", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				// Should return empty array because otherUser doesn't own this account
				expect(result).toEqual([]);
			});

			it("should return empty array for non-existent account", async () => {
				const result = await caller.analytics.getPerformanceBySymbol({
					accountId: "non-existent-account-id",
				});

				expect(result).toEqual([]);
			});
		});
	});

	// ============================================================================
	// getSymbolTrend - Monthly Symbol Performance Trends
	// ============================================================================

	describe("getSymbolTrend", () => {
		// NOTE: The test fixture data uses dynamic dates (3 months ago) to stay
		// within the 24-month lookback window. Use getAnalyticsFixtureMonth() to
		// get the expected month.

		describe("Return Type Verification", () => {
			it("should return months and symbols arrays", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				expect(result).toHaveProperty("months");
				expect(result).toHaveProperty("symbols");
				expect(Array.isArray(result.months)).toBe(true);
				expect(Array.isArray(result.symbols)).toBe(true);
			});

			it("should have all expected fields for each symbol", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				for (const symbolData of result.symbols) {
					expect(symbolData).toHaveProperty("symbol");
					expect(symbolData).toHaveProperty("data");
					expect(symbolData).toHaveProperty("totalPnl");
					expect(Array.isArray(symbolData.data)).toBe(true);
				}
			});

			it("should have all expected fields for each monthly data point", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				for (const symbolData of result.symbols) {
					for (const monthData of symbolData.data) {
						expect(monthData).toHaveProperty("month");
						expect(monthData).toHaveProperty("pnl");
						expect(monthData).toHaveProperty("cumulative");
					}
				}
			});

			it("should return correct types for all fields", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				for (const month of result.months) {
					expect(typeof month).toBe("string");
				}

				for (const symbolData of result.symbols) {
					expect(typeof symbolData.symbol).toBe("string");
					expect(typeof symbolData.totalPnl).toBe("number");

					for (const monthData of symbolData.data) {
						expect(typeof monthData.month).toBe("string");
						expect(typeof monthData.pnl).toBe("number");
						expect(typeof monthData.cumulative).toBe("number");
					}
				}
			});
		});

		describe("Month Data", () => {
			it("should have the fixture month in months (from test data)", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				expect(result.months).toContain(getAnalyticsFixtureMonth());
			});

			it("should have months in chronological order", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				const sortedMonths = [...result.months].sort();
				expect(result.months).toEqual(sortedMonths);
			});

			it("should have month format as YYYY-MM", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				const monthRegex = /^\d{4}-\d{2}$/;
				for (const month of result.months) {
					expect(month).toMatch(monthRegex);
				}
			});
		});

		describe("Symbol Data", () => {
			it("should include all traded symbols (ES, NQ, EURUSD)", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				const symbolNames = result.symbols.map((s) => s.symbol);
				expect(symbolNames).toContain("ES");
				expect(symbolNames).toContain("NQ");
				expect(symbolNames).toContain("EURUSD");
			});

			it("should have 3 symbols total", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				expect(result.symbols.length).toBe(3);
			});

			it("should have data array length matching months array length", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				for (const symbolData of result.symbols) {
					expect(symbolData.data.length).toBe(result.months.length);
				}
			});
		});

		describe("Total P&L Calculations", () => {
			it("should have totalPnl matching sum of P&L from getPerformanceBySymbol", async () => {
				const trendResult = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});
				const perfResult = await caller.analytics.getPerformanceBySymbol({
					accountId: testData.account.id,
				});

				for (const trendSymbol of trendResult.symbols) {
					const perfSymbol = perfResult.find(
						(p) => p.symbol === trendSymbol.symbol,
					);
					if (perfSymbol) {
						expect(trendSymbol.totalPnl).toBeCloseTo(perfSymbol.pnl, 0);
					}
				}
			});

			it("should have ES with positive totalPnl", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				const es = result.symbols.find((s) => s.symbol === "ES");
				expect(es?.totalPnl).toBeGreaterThan(0);
			});

			it("should have EURUSD with negative totalPnl", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				const eurusd = result.symbols.find((s) => s.symbol === "EURUSD");
				expect(eurusd?.totalPnl).toBeLessThan(0);
			});
		});

		describe("Cumulative P&L Calculations", () => {
			it("should have cumulative P&L that accumulates correctly", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				for (const symbolData of result.symbols) {
					let runningTotal = 0;
					for (const monthData of symbolData.data) {
						runningTotal += monthData.pnl;
						expect(monthData.cumulative).toBeCloseTo(runningTotal, 8);
					}
				}
			});

			it("should have final cumulative equal to totalPnl", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				for (const symbolData of result.symbols) {
					if (symbolData.data.length > 0) {
						const lastMonth = symbolData.data[symbolData.data.length - 1];
						expect(lastMonth?.cumulative).toBeCloseTo(symbolData.totalPnl, 8);
					}
				}
			});
		});

		describe("Sorting", () => {
			it("should be sorted by total P&L descending (best performing first)", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				for (let i = 1; i < result.symbols.length; i++) {
					const current = result.symbols[i];
					const previous = result.symbols[i - 1];
					expect(current?.totalPnl).toBeLessThanOrEqual(
						previous?.totalPnl ?? 0,
					);
				}
			});

			it("should have ES as the first symbol (best performer)", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 24,
				});

				expect(result.symbols[0]?.symbol).toBe("ES");
			});
		});

		describe("Months Parameter", () => {
			it("should respect months parameter to limit history", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
					months: 1,
				});

				// Should only include months within the last 1 month
				expect(result.months.length).toBeLessThanOrEqual(1);
			});

			it("should default to 12 months if not specified", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: testData.account.id,
				});

				// The fixture data is in January 2024, so depending on when tests run
				// it may or may not be included. Just verify months is reasonable.
				expect(result.months.length).toBeLessThanOrEqual(12);
			});
		});

		describe("Edge Cases", () => {
			it("should return empty months and symbols when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getSymbolTrend({
					accountId: emptyAccount.id,
				});

				expect(result.months).toEqual([]);
				expect(result.symbols).toEqual([]);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getSymbolTrend();

				expect(result).toHaveProperty("months");
				expect(result).toHaveProperty("symbols");
			});

			it("should handle empty object input", async () => {
				const result = await caller.analytics.getSymbolTrend({});

				expect(result).toHaveProperty("months");
				expect(result).toHaveProperty("symbols");
			});
		});

		describe("Authorization", () => {
			it("should only return data for the authenticated user", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getSymbolTrend({
					accountId: testData.account.id,
				});

				// Should return empty arrays because otherUser doesn't own this account
				expect(result.months).toEqual([]);
				expect(result.symbols).toEqual([]);
			});

			it("should return empty arrays for non-existent account", async () => {
				const result = await caller.analytics.getSymbolTrend({
					accountId: "non-existent-account-id",
				});

				expect(result.months).toEqual([]);
				expect(result.symbols).toEqual([]);
			});
		});
	});

	// ============================================================================
	// Cross-Procedure Consistency Tests
	// ============================================================================

	describe("Cross-Procedure Consistency", () => {
		it("should have consistent symbol list between getPerformanceBySymbol and getSymbolTrend", async () => {
			const perfResult = await caller.analytics.getPerformanceBySymbol({
				accountId: testData.account.id,
			});
			const trendResult = await caller.analytics.getSymbolTrend({
				accountId: testData.account.id,
				months: 24,
			});

			const perfSymbols = perfResult.map((p) => p.symbol).sort();
			const trendSymbols = trendResult.symbols.map((s) => s.symbol).sort();

			expect(perfSymbols).toEqual(trendSymbols);
		});

		it("should have consistent total P&L per symbol between procedures", async () => {
			const perfResult = await caller.analytics.getPerformanceBySymbol({
				accountId: testData.account.id,
			});
			const trendResult = await caller.analytics.getSymbolTrend({
				accountId: testData.account.id,
				months: 24,
			});

			for (const perfSymbol of perfResult) {
				const trendSymbol = trendResult.symbols.find(
					(s) => s.symbol === perfSymbol.symbol,
				);
				expect(trendSymbol).toBeDefined();
				expect(trendSymbol?.totalPnl).toBeCloseTo(perfSymbol.pnl, 0);
			}
		});

		it("should have symbol P&L sum matching overall total from getOverview", async () => {
			const perfResult = await caller.analytics.getPerformanceBySymbol({
				accountId: testData.account.id,
			});
			const overviewResult = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			const totalFromSymbols = perfResult.reduce((sum, s) => sum + s.pnl, 0);
			expect(totalFromSymbols).toBeCloseTo(overviewResult.totalPnl, 0);
		});

		it("should have symbol trade count sum matching overview total trades", async () => {
			const perfResult = await caller.analytics.getPerformanceBySymbol({
				accountId: testData.account.id,
			});
			const overviewResult = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});

			const totalTradesFromSymbols = perfResult.reduce(
				(sum, s) => sum + s.trades,
				0,
			);
			expect(totalTradesFromSymbols).toBe(overviewResult.totalTrades);
		});
	});
});
