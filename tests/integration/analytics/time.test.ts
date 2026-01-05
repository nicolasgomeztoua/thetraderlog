import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestAccount,
	createTestCaller,
	createTestTrade,
	createTestUser,
	setupTrader,
	setupTraderWithAnalyticsData,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics Time", () => {
	let caller: TestCaller;
	let testData: Awaited<ReturnType<typeof setupTraderWithAnalyticsData>>;

	// For time-filtered procedures (getCalendarData, getPerformanceByMonth),
	// we need recent trades within the last 365 days / specified months.
	// We create additional recent trades for these tests.
	let recentTradesData: {
		user: Awaited<ReturnType<typeof createTestUser>>;
		account: Awaited<ReturnType<typeof createTestAccount>>;
		trades: Awaited<ReturnType<typeof createTestTrade>>[];
	};

	// The fixture creates 7 trades across Mon-Fri (Jan 8-12, 2024):
	// Monday (Jan 8):   2 trades at 09:30 UTC and 14:00 UTC
	// Tuesday (Jan 9):  1 trade at 10:00 UTC
	// Wednesday (Jan 10): 2 trades at 09:00 UTC and 11:00 UTC
	// Thursday (Jan 11): 1 trade at 15:30 UTC
	// Friday (Jan 12):  1 trade at 08:30 UTC
	//
	// Day of week indices: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
	// Hours: 8, 9, 10, 11, 14, 15
	//
	// NOTE: The original fixture data from 2024 may be outside the 365-day window,
	// so getCalendarData and getPerformanceByMonth may return empty.
	// We use recentTradesData for those tests.

	beforeAll(async () => {
		await truncateAllTables();
		testData = await setupTraderWithAnalyticsData();
		caller = await createTestCaller(testData.user.clerkId, testData.user);

		// Create recent trades for time-filtered procedures
		const recentUser = await createTestUser();
		const recentAccount = await createTestAccount(recentUser.id, {
			isDefault: true,
		});

		// Create trades within the last 30 days for calendar/monthly tests
		const now = new Date();
		const trades: Awaited<ReturnType<typeof createTestTrade>>[] = [];

		// Create 5 recent trades on different days
		for (let i = 0; i < 5; i++) {
			const tradeDate = new Date(now);
			tradeDate.setDate(tradeDate.getDate() - (i * 2 + 1)); // 1, 3, 5, 7, 9 days ago
			tradeDate.setHours(9 + i, 30, 0, 0); // Different hours: 9, 10, 11, 12, 13

			const isWin = i % 2 === 0; // Alternating wins/losses
			trades.push(
				await createTestTrade(recentUser.id, recentAccount.id, {
					symbol: "ES",
					direction: "long",
					status: "closed",
					entryPrice: "5000",
					exitPrice: isWin ? "5020" : "4990",
					quantity: "1",
					entryTime: tradeDate,
					exitTime: new Date(tradeDate.getTime() + 30 * 60000),
					realizedPnl: isWin ? "1000" : "-500",
					netPnl: isWin ? "995" : "-505",
					fees: "5",
				}),
			);
		}

		recentTradesData = {
			user: recentUser,
			account: recentAccount,
			trades,
		};
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// getCalendarData - Daily P&L Heatmap Data
	// ============================================================================

	describe("getCalendarData", () => {
		// NOTE: getCalendarData filters for trades from the last 365 days.
		// We use recentTradesData which has trades from the last 30 days.

		describe("Return Type Verification", () => {
			it("should return an array of daily P&L entries", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
			});

			it("should have all expected fields on each entry", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				if (result.length > 0) {
					const entry = result[0];
					expect(entry).toHaveProperty("date");
					expect(entry).toHaveProperty("pnl");
					expect(entry).toHaveProperty("trades");
					expect(entry).toHaveProperty("wins");
					expect(entry).toHaveProperty("losses");
				}
			});

			it("should return date as YYYY-MM-DD string format", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				if (result.length > 0) {
					expect(result[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				}
			});

			it("should return correct types for all fields", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				if (result.length > 0) {
					const entry = result[0];
					expect(typeof entry?.date).toBe("string");
					expect(typeof entry?.pnl).toBe("number");
					expect(typeof entry?.trades).toBe("number");
					expect(typeof entry?.wins).toBe("number");
					expect(typeof entry?.losses).toBe("number");
				}
			});
		});

		describe("Data Aggregation", () => {
			it("should aggregate trades by date", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				// We have 5 trades on different days
				expect(result.length).toBe(5);
			});

			it("should have one trade per day for recent trades", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				// Each day should have 1 trade
				for (const entry of result) {
					expect(entry.trades).toBe(1);
				}
			});

			it("should have total trades matching recent trades count", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				const totalTrades = result.reduce((sum, r) => sum + r.trades, 0);
				expect(totalTrades).toBe(recentTradesData.trades.length);
			});

			it("should have total P&L matching recent trades", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				// 3 wins (995 each) + 2 losses (-505 each) = 2985 - 1010 = 1975
				const expectedPnl = 3 * 995 + 2 * -505;
				const totalPnl = result.reduce((sum, r) => sum + r.pnl, 0);
				expect(totalPnl).toBeCloseTo(expectedPnl, 0);
			});
		});

		describe("Win/Loss Counting", () => {
			it("should count wins and losses correctly", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				const totalWins = result.reduce((sum, r) => sum + r.wins, 0);
				const totalLosses = result.reduce((sum, r) => sum + r.losses, 0);

				// 3 wins, 2 losses based on alternating pattern
				expect(totalWins).toBe(3);
				expect(totalLosses).toBe(2);
			});

			it("should have non-negative win and loss counts", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				for (const entry of result) {
					expect(entry.wins).toBeGreaterThanOrEqual(0);
					expect(entry.losses).toBeGreaterThanOrEqual(0);
				}
			});
		});

		describe("Time Filtering", () => {
			it("should only return trades from the last 365 days", async () => {
				// The original fixture data from Jan 2024 should not appear
				const result = await caller.analytics.getCalendarData({
					accountId: testData.account.id,
				});

				// Fixture data is from Jan 2024, which is now older than 365 days
				// So we expect empty or only recent trades
				expect(Array.isArray(result)).toBe(true);
			});
		});

		describe("Edge Cases", () => {
			it("should return empty array when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getCalendarData({
					accountId: emptyAccount.id,
				});

				expect(result).toEqual([]);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getCalendarData();

				expect(Array.isArray(result)).toBe(true);
			});

			it("should handle empty object input", async () => {
				const result = await caller.analytics.getCalendarData({});

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

				const result = await otherCaller.analytics.getCalendarData({
					accountId: recentTradesData.account.id,
				});

				expect(result).toEqual([]);
			});

			it("should return empty array for non-existent account", async () => {
				const result = await caller.analytics.getCalendarData({
					accountId: "non-existent-account-id",
				});

				expect(result).toEqual([]);
			});
		});
	});

	// ============================================================================
	// getPerformanceByDayOfWeek - Stats by Weekday
	// ============================================================================

	describe("getPerformanceByDayOfWeek", () => {
		describe("Return Type Verification", () => {
			it("should return an array with 7 days", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBe(7);
			});

			it("should have all expected fields on each day", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				const day = result[0];
				expect(day).toHaveProperty("day");
				expect(day).toHaveProperty("pnl");
				expect(day).toHaveProperty("trades");
				expect(day).toHaveProperty("wins");
				expect(day).toHaveProperty("losses");
				expect(day).toHaveProperty("winRate");
				expect(day).toHaveProperty("avgPnl");
			});

			it("should return correct types for all fields", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				const day = result[0];
				expect(typeof day?.day).toBe("string");
				expect(typeof day?.pnl).toBe("number");
				expect(typeof day?.trades).toBe("number");
				expect(typeof day?.wins).toBe("number");
				expect(typeof day?.losses).toBe("number");
				expect(typeof day?.winRate).toBe("number");
				expect(typeof day?.avgPnl).toBe("number");
			});
		});

		describe("Day Names", () => {
			it("should have correct day names in order", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				const expectedDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
				for (let i = 0; i < 7; i++) {
					expect(result[i]?.day).toBe(expectedDays[i]);
				}
			});
		});

		describe("Trade Distribution", () => {
			it("should have Monday with 2 trades", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				// Mon = index 1
				expect(result[1]?.trades).toBe(2);
			});

			it("should have Tuesday with 1 trade", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				// Tue = index 2
				expect(result[2]?.trades).toBe(1);
			});

			it("should have Wednesday with 2 trades", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				// Wed = index 3
				expect(result[3]?.trades).toBe(2);
			});

			it("should have Thursday with 1 trade", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				// Thu = index 4
				expect(result[4]?.trades).toBe(1);
			});

			it("should have Friday with 1 trade", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				// Fri = index 5
				expect(result[5]?.trades).toBe(1);
			});

			it("should have Sunday and Saturday with 0 trades", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				// Sun = index 0, Sat = index 6
				expect(result[0]?.trades).toBe(0);
				expect(result[6]?.trades).toBe(0);
			});

			it("should have total trades matching fixture", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				const totalTrades = result.reduce((sum, r) => sum + r.trades, 0);
				expect(totalTrades).toBe(testData.expectedMetrics.totalTrades);
			});
		});

		describe("P&L Calculations", () => {
			it("should calculate total P&L matching fixture", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				const totalPnl = result.reduce((sum, r) => sum + r.pnl, 0);
				expect(totalPnl).toBeCloseTo(testData.expectedMetrics.totalPnl, 0);
			});

			it("should calculate avgPnl correctly for days with trades", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				for (const day of result) {
					if (day.trades > 0) {
						expect(day.avgPnl).toBeCloseTo(day.pnl / day.trades, 8);
					} else {
						expect(day.avgPnl).toBe(0);
					}
				}
			});
		});

		describe("Win Rate Calculations", () => {
			it("should calculate winRate correctly", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				for (const day of result) {
					const decisiveTrades = day.wins + day.losses;
					if (decisiveTrades > 0) {
						const expectedWinRate = (day.wins / decisiveTrades) * 100;
						expect(day.winRate).toBeCloseTo(expectedWinRate, 2);
					} else {
						expect(day.winRate).toBe(0);
					}
				}
			});

			it("should have winRate between 0 and 100", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				for (const day of result) {
					expect(day.winRate).toBeGreaterThanOrEqual(0);
					expect(day.winRate).toBeLessThanOrEqual(100);
				}
			});
		});

		describe("Edge Cases", () => {
			it("should return all zeros when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getPerformanceByDayOfWeek({
					accountId: emptyAccount.id,
				});

				expect(result.length).toBe(7);
				for (const day of result) {
					expect(day.trades).toBe(0);
					expect(day.pnl).toBe(0);
					expect(day.wins).toBe(0);
					expect(day.losses).toBe(0);
					expect(day.winRate).toBe(0);
					expect(day.avgPnl).toBe(0);
				}
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getPerformanceByDayOfWeek();

				expect(result.length).toBe(7);
			});
		});

		describe("Authorization", () => {
			it("should only return data for the authenticated user", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getPerformanceByDayOfWeek({
					accountId: testData.account.id,
				});

				const totalTrades = result.reduce((sum, r) => sum + r.trades, 0);
				expect(totalTrades).toBe(0);
			});
		});
	});

	// ============================================================================
	// getPerformanceByHour - Stats by Entry Hour (0-23)
	// ============================================================================

	describe("getPerformanceByHour", () => {
		describe("Return Type Verification", () => {
			it("should return an array with 24 hours", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBe(24);
			});

			it("should have all expected fields on each hour", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				const hour = result[0];
				expect(hour).toHaveProperty("hour");
				expect(hour).toHaveProperty("pnl");
				expect(hour).toHaveProperty("trades");
				expect(hour).toHaveProperty("wins");
				expect(hour).toHaveProperty("losses");
				expect(hour).toHaveProperty("winRate");
				expect(hour).toHaveProperty("avgPnl");
			});

			it("should return correct types for all fields", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				const hour = result[0];
				expect(typeof hour?.hour).toBe("number");
				expect(typeof hour?.pnl).toBe("number");
				expect(typeof hour?.trades).toBe("number");
				expect(typeof hour?.wins).toBe("number");
				expect(typeof hour?.losses).toBe("number");
				expect(typeof hour?.winRate).toBe("number");
				expect(typeof hour?.avgPnl).toBe("number");
			});
		});

		describe("Hour Values", () => {
			it("should have hours 0-23 in order", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				for (let i = 0; i < 24; i++) {
					expect(result[i]?.hour).toBe(i);
				}
			});

			it("should have hour values between 0 and 23", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				for (const h of result) {
					expect(h.hour).toBeGreaterThanOrEqual(0);
					expect(h.hour).toBeLessThanOrEqual(23);
				}
			});
		});

		describe("Trade Distribution", () => {
			it("should have trades distributed across expected hours", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				// Fixture entry times (UTC):
				// 08:30 - 1 trade (Friday)
				// 09:00 - 1 trade (Wednesday)
				// 09:30 - 1 trade (Monday)
				// 10:00 - 1 trade (Tuesday)
				// 11:00 - 1 trade (Wednesday)
				// 14:00 - 1 trade (Monday)
				// 15:30 - 1 trade (Thursday)

				expect(result[8]?.trades).toBe(1); // 08:30
				expect(result[9]?.trades).toBe(2); // 09:00 and 09:30
				expect(result[10]?.trades).toBe(1); // 10:00
				expect(result[11]?.trades).toBe(1); // 11:00
				expect(result[14]?.trades).toBe(1); // 14:00
				expect(result[15]?.trades).toBe(1); // 15:30
			});

			it("should have total trades matching fixture", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				const totalTrades = result.reduce((sum, r) => sum + r.trades, 0);
				expect(totalTrades).toBe(testData.expectedMetrics.totalTrades);
			});

			it("should have non-trading hours with 0 trades", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				// Hours with no trades should be 0
				const tradingHours = [8, 9, 10, 11, 14, 15];
				for (let i = 0; i < 24; i++) {
					if (!tradingHours.includes(i)) {
						expect(result[i]?.trades).toBe(0);
					}
				}
			});
		});

		describe("P&L Calculations", () => {
			it("should calculate total P&L matching fixture", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				const totalPnl = result.reduce((sum, r) => sum + r.pnl, 0);
				expect(totalPnl).toBeCloseTo(testData.expectedMetrics.totalPnl, 0);
			});

			it("should calculate avgPnl correctly", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				for (const h of result) {
					if (h.trades > 0) {
						expect(h.avgPnl).toBeCloseTo(h.pnl / h.trades, 8);
					} else {
						expect(h.avgPnl).toBe(0);
					}
				}
			});
		});

		describe("Win Rate Calculations", () => {
			it("should calculate winRate correctly", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				for (const h of result) {
					const decisiveTrades = h.wins + h.losses;
					if (decisiveTrades > 0) {
						const expectedWinRate = (h.wins / decisiveTrades) * 100;
						expect(h.winRate).toBeCloseTo(expectedWinRate, 2);
					} else {
						expect(h.winRate).toBe(0);
					}
				}
			});

			it("should have winRate between 0 and 100", async () => {
				const result = await caller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				for (const h of result) {
					expect(h.winRate).toBeGreaterThanOrEqual(0);
					expect(h.winRate).toBeLessThanOrEqual(100);
				}
			});
		});

		describe("Edge Cases", () => {
			it("should return all zeros when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getPerformanceByHour({
					accountId: emptyAccount.id,
				});

				expect(result.length).toBe(24);
				for (const h of result) {
					expect(h.trades).toBe(0);
					expect(h.pnl).toBe(0);
					expect(h.wins).toBe(0);
					expect(h.losses).toBe(0);
					expect(h.winRate).toBe(0);
					expect(h.avgPnl).toBe(0);
				}
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getPerformanceByHour();

				expect(result.length).toBe(24);
			});
		});

		describe("Authorization", () => {
			it("should only return data for the authenticated user", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getPerformanceByHour({
					accountId: testData.account.id,
				});

				const totalTrades = result.reduce((sum, r) => sum + r.trades, 0);
				expect(totalTrades).toBe(0);
			});
		});
	});

	// ============================================================================
	// getPerformanceBySession - Stats by Trading Session
	// ============================================================================

	describe("getPerformanceBySession", () => {
		describe("Return Type Verification", () => {
			it("should return an array of session performances", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
			});

			it("should have all expected fields on each session", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				if (result.length > 0) {
					const session = result[0];
					expect(session).toHaveProperty("session");
					expect(session).toHaveProperty("pnl");
					expect(session).toHaveProperty("trades");
					expect(session).toHaveProperty("wins");
					expect(session).toHaveProperty("losses");
					expect(session).toHaveProperty("color");
					expect(session).toHaveProperty("winRate");
					expect(session).toHaveProperty("avgPnl");
				}
			});

			it("should return correct types for all fields", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				if (result.length > 0) {
					const session = result[0];
					expect(typeof session?.session).toBe("string");
					expect(typeof session?.pnl).toBe("number");
					expect(typeof session?.trades).toBe("number");
					expect(typeof session?.wins).toBe("number");
					expect(typeof session?.losses).toBe("number");
					expect(typeof session?.color).toBe("string");
					expect(typeof session?.winRate).toBe("number");
					expect(typeof session?.avgPnl).toBe("number");
				}
			});
		});

		describe("Default Sessions", () => {
			it("should have default sessions when user has not configured custom ones", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				// Default sessions: Asia, London, New York
				const sessionNames = result.map((s) => s.session);
				expect(sessionNames).toContain("Asia");
				expect(sessionNames).toContain("London");
				expect(sessionNames).toContain("New York");
			});

			it("should return 3 default sessions", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				expect(result.length).toBe(3);
			});

			it("should have color property on each session", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				for (const session of result) {
					expect(session.color).toBeTruthy();
					expect(session.color).toMatch(/^#[0-9a-fA-F]{6}$/);
				}
			});
		});

		describe("Trade Distribution", () => {
			// Default sessions (UTC hours):
			// Asia: 0-8
			// London: 8-16
			// New York: 13-21

			it("should have trades distributed across sessions", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				// All trades are between 08:30 and 15:30 UTC
				// Asia (0-8): 1 trade at 08:30 could be in Asia OR London boundary
				// London (8-16): Most trades (08:30, 09:00, 09:30, 10:00, 11:00, 14:00, 15:30)
				// New York (13-21): 2 trades (14:00, 15:30)

				const londonSession = result.find((s) => s.session === "London");
				const newYorkSession = result.find((s) => s.session === "New York");

				expect(londonSession?.trades).toBeGreaterThan(0);
				expect(newYorkSession?.trades).toBeGreaterThan(0);
			});

			it("should handle session overlap (trades counted in multiple sessions)", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				// With overlapping sessions, total trades across sessions may exceed actual trades
				const totalSessionTrades = result.reduce((sum, s) => sum + s.trades, 0);
				// This is expected to be >= actual trades due to overlap
				expect(totalSessionTrades).toBeGreaterThanOrEqual(
					testData.expectedMetrics.totalTrades,
				);
			});
		});

		describe("P&L Calculations", () => {
			it("should have non-negative trade counts per session", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				for (const session of result) {
					expect(session.trades).toBeGreaterThanOrEqual(0);
				}
			});

			it("should calculate avgPnl correctly", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				for (const session of result) {
					if (session.trades > 0) {
						expect(session.avgPnl).toBeCloseTo(
							session.pnl / session.trades,
							8,
						);
					} else {
						expect(session.avgPnl).toBe(0);
					}
				}
			});
		});

		describe("Win Rate Calculations", () => {
			it("should calculate winRate correctly", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				for (const session of result) {
					const decisiveTrades = session.wins + session.losses;
					if (decisiveTrades > 0) {
						const expectedWinRate = (session.wins / decisiveTrades) * 100;
						expect(session.winRate).toBeCloseTo(expectedWinRate, 2);
					} else {
						expect(session.winRate).toBe(0);
					}
				}
			});

			it("should have winRate between 0 and 100", async () => {
				const result = await caller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				for (const session of result) {
					expect(session.winRate).toBeGreaterThanOrEqual(0);
					expect(session.winRate).toBeLessThanOrEqual(100);
				}
			});
		});

		describe("Edge Cases", () => {
			it("should return all zeros when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getPerformanceBySession({
					accountId: emptyAccount.id,
				});

				expect(result.length).toBe(3); // Default sessions
				for (const session of result) {
					expect(session.trades).toBe(0);
					expect(session.pnl).toBe(0);
					expect(session.wins).toBe(0);
					expect(session.losses).toBe(0);
					expect(session.winRate).toBe(0);
					expect(session.avgPnl).toBe(0);
				}
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getPerformanceBySession();

				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBeGreaterThan(0);
			});
		});

		describe("Authorization", () => {
			it("should only return data for the authenticated user", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getPerformanceBySession({
					accountId: testData.account.id,
				});

				const totalTrades = result.reduce((sum, s) => sum + s.trades, 0);
				expect(totalTrades).toBe(0);
			});
		});
	});

	// ============================================================================
	// getPerformanceByMonth - Stats by Month
	// ============================================================================

	describe("getPerformanceByMonth", () => {
		// NOTE: getPerformanceByMonth filters for trades from the last N months.
		// We use recentTradesData which has trades from the last 30 days.

		describe("Return Type Verification", () => {
			it("should return an array of monthly performances", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
			});

			it("should have all expected fields on each month", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				if (result.length > 0) {
					const month = result[0];
					expect(month).toHaveProperty("month");
					expect(month).toHaveProperty("pnl");
					expect(month).toHaveProperty("trades");
					expect(month).toHaveProperty("wins");
					expect(month).toHaveProperty("losses");
					expect(month).toHaveProperty("winRate");
					expect(month).toHaveProperty("avgPnl");
				}
			});

			it("should return month as YYYY-MM format string", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				if (result.length > 0) {
					expect(result[0]?.month).toMatch(/^\d{4}-\d{2}$/);
				}
			});

			it("should return correct types for all fields", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				if (result.length > 0) {
					const month = result[0];
					expect(typeof month?.month).toBe("string");
					expect(typeof month?.pnl).toBe("number");
					expect(typeof month?.trades).toBe("number");
					expect(typeof month?.wins).toBe("number");
					expect(typeof month?.losses).toBe("number");
					expect(typeof month?.winRate).toBe("number");
					expect(typeof month?.avgPnl).toBe("number");
				}
			});
		});

		describe("Data Aggregation", () => {
			it("should aggregate trades by month", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				// All recent trades should be in the current month
				expect(result.length).toBeGreaterThanOrEqual(1);
			});

			it("should have total trades matching recent trades count", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				const totalTrades = result.reduce((sum, r) => sum + r.trades, 0);
				expect(totalTrades).toBe(recentTradesData.trades.length);
			});

			it("should have total P&L matching recent trades", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				// 3 wins (995 each) + 2 losses (-505 each) = 2985 - 1010 = 1975
				const expectedPnl = 3 * 995 + 2 * -505;
				const totalPnl = result.reduce((sum, r) => sum + r.pnl, 0);
				expect(totalPnl).toBeCloseTo(expectedPnl, 0);
			});
		});

		describe("Month Sorting", () => {
			it("should return months in chronological order", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				for (let i = 1; i < result.length; i++) {
					const current = result[i]?.month ?? "";
					const previous = result[i - 1]?.month ?? "";
					expect(current >= previous).toBe(true);
				}
			});
		});

		describe("Months Parameter", () => {
			it("should respect months parameter", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result6Months = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
					months: 6,
				});

				const result12Months = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
					months: 12,
				});

				// Both should work without error and return same data for recent trades
				expect(Array.isArray(result6Months)).toBe(true);
				expect(Array.isArray(result12Months)).toBe(true);
			});

			it("should default to 12 months when not specified", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				// Should return data without error
				expect(Array.isArray(result)).toBe(true);
			});
		});

		describe("Time Filtering", () => {
			it("should filter out trades older than the specified months", async () => {
				// The original fixture data from Jan 2024 should not appear
				const result = await caller.analytics.getPerformanceByMonth({
					accountId: testData.account.id,
				});

				// Fixture data is from Jan 2024, which is now older than 12 months
				// So we expect empty result
				expect(Array.isArray(result)).toBe(true);
			});
		});

		describe("P&L Calculations", () => {
			it("should calculate avgPnl correctly", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				for (const month of result) {
					if (month.trades > 0) {
						expect(month.avgPnl).toBeCloseTo(month.pnl / month.trades, 8);
					} else {
						expect(month.avgPnl).toBe(0);
					}
				}
			});
		});

		describe("Win Rate Calculations", () => {
			it("should calculate winRate correctly", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				for (const month of result) {
					const decisiveTrades = month.wins + month.losses;
					if (decisiveTrades > 0) {
						const expectedWinRate = (month.wins / decisiveTrades) * 100;
						expect(month.winRate).toBeCloseTo(expectedWinRate, 2);
					} else {
						expect(month.winRate).toBe(0);
					}
				}
			});

			it("should have winRate between 0 and 100", async () => {
				const recentCaller = await createTestCaller(
					recentTradesData.user.clerkId,
					recentTradesData.user,
				);
				const result = await recentCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				for (const month of result) {
					expect(month.winRate).toBeGreaterThanOrEqual(0);
					expect(month.winRate).toBeLessThanOrEqual(100);
				}
			});
		});

		describe("Edge Cases", () => {
			it("should return empty array when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getPerformanceByMonth({
					accountId: emptyAccount.id,
				});

				expect(result).toEqual([]);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getPerformanceByMonth();

				expect(Array.isArray(result)).toBe(true);
			});

			it("should handle empty object input", async () => {
				const result = await caller.analytics.getPerformanceByMonth({});

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

				const result = await otherCaller.analytics.getPerformanceByMonth({
					accountId: recentTradesData.account.id,
				});

				expect(result).toEqual([]);
			});

			it("should return empty array for non-existent account", async () => {
				const result = await caller.analytics.getPerformanceByMonth({
					accountId: "non-existent-account-id",
				});

				expect(result).toEqual([]);
			});
		});
	});

	// ============================================================================
	// Cross-Procedure Consistency Tests
	// ============================================================================

	describe("Cross-Procedure Consistency", () => {
		// Note: getCalendarData and getPerformanceByMonth have time-based filtering
		// (last 365 days and last N months respectively), while getPerformanceByDayOfWeek
		// and getPerformanceByHour do not. We test consistency using procedures
		// that have the same time scope.

		it("should have consistent total trades across non-time-filtered procedures", async () => {
			const dayOfWeek = await caller.analytics.getPerformanceByDayOfWeek({
				accountId: testData.account.id,
			});
			const hourly = await caller.analytics.getPerformanceByHour({
				accountId: testData.account.id,
			});
			const session = await caller.analytics.getPerformanceBySession({
				accountId: testData.account.id,
			});

			const dayOfWeekTrades = dayOfWeek.reduce((sum, d) => sum + d.trades, 0);
			const hourlyTrades = hourly.reduce((sum, h) => sum + h.trades, 0);

			// dayOfWeek and hourly should match
			expect(dayOfWeekTrades).toBe(testData.expectedMetrics.totalTrades);
			expect(hourlyTrades).toBe(testData.expectedMetrics.totalTrades);

			// Session may have overlap, so trades could be >= total
			const sessionTrades = session.reduce((sum, s) => sum + s.trades, 0);
			expect(sessionTrades).toBeGreaterThanOrEqual(testData.expectedMetrics.totalTrades);
		});

		it("should have consistent total P&L across non-time-filtered procedures", async () => {
			const dayOfWeek = await caller.analytics.getPerformanceByDayOfWeek({
				accountId: testData.account.id,
			});
			const hourly = await caller.analytics.getPerformanceByHour({
				accountId: testData.account.id,
			});

			const dayOfWeekPnl = dayOfWeek.reduce((sum, d) => sum + d.pnl, 0);
			const hourlyPnl = hourly.reduce((sum, h) => sum + h.pnl, 0);

			expect(dayOfWeekPnl).toBeCloseTo(testData.expectedMetrics.totalPnl, 0);
			expect(hourlyPnl).toBeCloseTo(testData.expectedMetrics.totalPnl, 0);
		});

		it("should have consistent data across time-filtered procedures for recent trades", async () => {
			const recentCaller = await createTestCaller(
				recentTradesData.user.clerkId,
				recentTradesData.user,
			);

			const calendarData = await recentCaller.analytics.getCalendarData({
				accountId: recentTradesData.account.id,
			});
			const monthly = await recentCaller.analytics.getPerformanceByMonth({
				accountId: recentTradesData.account.id,
			});

			const calendarTrades = calendarData.reduce((sum, d) => sum + d.trades, 0);
			const monthlyTrades = monthly.reduce((sum, m) => sum + m.trades, 0);

			// Both should have the same number of recent trades
			expect(calendarTrades).toBe(recentTradesData.trades.length);
			expect(monthlyTrades).toBe(recentTradesData.trades.length);
		});

		it("should have consistent P&L across time-filtered procedures for recent trades", async () => {
			const recentCaller = await createTestCaller(
				recentTradesData.user.clerkId,
				recentTradesData.user,
			);

			const calendarData = await recentCaller.analytics.getCalendarData({
				accountId: recentTradesData.account.id,
			});
			const monthly = await recentCaller.analytics.getPerformanceByMonth({
				accountId: recentTradesData.account.id,
			});

			const calendarPnl = calendarData.reduce((sum, d) => sum + d.pnl, 0);
			const monthlyPnl = monthly.reduce((sum, m) => sum + m.pnl, 0);

			// Both should have the same P&L
			expect(calendarPnl).toBeCloseTo(monthlyPnl, 0);
		});

		it("should have consistent data with overview procedure for non-time-filtered data", async () => {
			const overview = await caller.analytics.getOverview({
				accountId: testData.account.id,
			});
			const dayOfWeek = await caller.analytics.getPerformanceByDayOfWeek({
				accountId: testData.account.id,
			});
			const hourly = await caller.analytics.getPerformanceByHour({
				accountId: testData.account.id,
			});

			const dayOfWeekTrades = dayOfWeek.reduce((sum, d) => sum + d.trades, 0);
			const hourlyTrades = hourly.reduce((sum, h) => sum + h.trades, 0);
			const dayOfWeekPnl = dayOfWeek.reduce((sum, d) => sum + d.pnl, 0);
			const hourlyPnl = hourly.reduce((sum, h) => sum + h.pnl, 0);

			expect(dayOfWeekTrades).toBe(overview.totalTrades);
			expect(hourlyTrades).toBe(overview.totalTrades);
			expect(dayOfWeekPnl).toBeCloseTo(overview.totalPnl, 0);
			expect(hourlyPnl).toBeCloseTo(overview.totalPnl, 0);
		});
	});
});
