import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	setupTrader,
	setupTraderWithAnalyticsData,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics Behavior", () => {
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
	// STREAK ANALYSIS
	// ============================================================================

	describe("getStreakAnalysis", () => {
		describe("Return Structure", () => {
			it("should return all expected properties", async () => {
				const result = await caller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				expect(result).toHaveProperty("currentStreak");
				expect(result).toHaveProperty("maxWinStreak");
				expect(result).toHaveProperty("maxLossStreak");
				expect(result).toHaveProperty("streakDistribution");
				expect(result).toHaveProperty("performanceDuringStreaks");
			});

			it("should have currentStreak with type and count", async () => {
				const result = await caller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				expect(result.currentStreak).toHaveProperty("type");
				expect(result.currentStreak).toHaveProperty("count");
				expect(["win", "loss", "none"]).toContain(result.currentStreak.type);
				expect(typeof result.currentStreak.count).toBe("number");
			});

			it("should have streakDistribution with wins and losses arrays", async () => {
				const result = await caller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				expect(result.streakDistribution).toHaveProperty("wins");
				expect(result.streakDistribution).toHaveProperty("losses");
				expect(Array.isArray(result.streakDistribution.wins)).toBe(true);
				expect(Array.isArray(result.streakDistribution.losses)).toBe(true);
			});

			it("should have performanceDuringStreaks with all categories", async () => {
				const result = await caller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				expect(result.performanceDuringStreaks).toHaveProperty(
					"duringWinStreak",
				);
				expect(result.performanceDuringStreaks).toHaveProperty(
					"duringLossStreak",
				);
				expect(result.performanceDuringStreaks).toHaveProperty("noStreak");

				// Each category should have trades, pnl, avgPnl
				for (const category of [
					"duringWinStreak",
					"duringLossStreak",
					"noStreak",
				] as const) {
					expect(result.performanceDuringStreaks[category]).toHaveProperty(
						"trades",
					);
					expect(result.performanceDuringStreaks[category]).toHaveProperty(
						"pnl",
					);
					expect(result.performanceDuringStreaks[category]).toHaveProperty(
						"avgPnl",
					);
				}
			});
		});

		describe("Data Validation", () => {
			it("should have non-negative max streaks", async () => {
				const result = await caller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				expect(result.maxWinStreak).toBeGreaterThanOrEqual(0);
				expect(result.maxLossStreak).toBeGreaterThanOrEqual(0);
			});

			it("should have streak distribution entries with valid structure", async () => {
				const result = await caller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				// Win distribution entries
				for (const entry of result.streakDistribution.wins) {
					expect(entry).toHaveProperty("streakLength");
					expect(entry).toHaveProperty("count");
					expect(entry).toHaveProperty("totalPnl");
					expect(entry.streakLength).toBeGreaterThan(0);
					expect(entry.count).toBeGreaterThan(0);
				}

				// Loss distribution entries
				for (const entry of result.streakDistribution.losses) {
					expect(entry).toHaveProperty("streakLength");
					expect(entry).toHaveProperty("count");
					expect(entry).toHaveProperty("totalPnl");
					expect(entry.streakLength).toBeGreaterThan(0);
					expect(entry.count).toBeGreaterThan(0);
				}
			});

			it("should detect win streaks from test data", async () => {
				const result = await caller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				// Test data has Monday x2 wins in a row
				expect(result.maxWinStreak).toBeGreaterThanOrEqual(2);
			});
		});

		describe("Edge Cases", () => {
			it("should return default values for user with no trades", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getStreakAnalysis({
					accountId: emptyAccount.id,
				});

				expect(result.currentStreak.type).toBe("none");
				expect(result.currentStreak.count).toBe(0);
				expect(result.maxWinStreak).toBe(0);
				expect(result.maxLossStreak).toBe(0);
				expect(result.streakDistribution.wins).toHaveLength(0);
				expect(result.streakDistribution.losses).toHaveLength(0);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getStreakAnalysis();

				expect(result).toBeDefined();
				expect(result.currentStreak).toBeDefined();
			});

			it("should handle empty accountId", async () => {
				const result = await caller.analytics.getStreakAnalysis({});

				expect(result).toBeDefined();
				expect(result.currentStreak).toBeDefined();
			});
		});

		describe("Authorization", () => {
			it("should not return data for another user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getStreakAnalysis({
					accountId: testData.account.id,
				});

				// Should return empty/default values
				expect(result.maxWinStreak).toBe(0);
				expect(result.maxLossStreak).toBe(0);
			});
		});
	});

	// ============================================================================
	// REVENGE TRADING ANALYSIS
	// ============================================================================

	describe("getRevengeTrading", () => {
		describe("Return Structure", () => {
			it("should return all expected properties", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result).toHaveProperty("afterWin");
				expect(result).toHaveProperty("afterLoss");
				expect(result).toHaveProperty("afterConsecutiveLosses");
				expect(result).toHaveProperty("revengeIndicator");
			});

			it("should have afterWin with all metrics", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result.afterWin).toHaveProperty("trades");
				expect(result.afterWin).toHaveProperty("wins");
				expect(result.afterWin).toHaveProperty("losses");
				expect(result.afterWin).toHaveProperty("winRate");
				expect(result.afterWin).toHaveProperty("pnl");
				expect(result.afterWin).toHaveProperty("avgPnl");
			});

			it("should have afterLoss with all metrics", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result.afterLoss).toHaveProperty("trades");
				expect(result.afterLoss).toHaveProperty("wins");
				expect(result.afterLoss).toHaveProperty("losses");
				expect(result.afterLoss).toHaveProperty("winRate");
				expect(result.afterLoss).toHaveProperty("pnl");
				expect(result.afterLoss).toHaveProperty("avgPnl");
			});

			it("should have afterConsecutiveLosses with all levels", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result.afterConsecutiveLosses).toHaveProperty("after1Loss");
				expect(result.afterConsecutiveLosses).toHaveProperty("after2Losses");
				expect(result.afterConsecutiveLosses).toHaveProperty(
					"after3PlusLosses",
				);

				// Each level should have trades, wins, winRate, avgPnl
				for (const level of [
					"after1Loss",
					"after2Losses",
					"after3PlusLosses",
				] as const) {
					expect(result.afterConsecutiveLosses[level]).toHaveProperty("trades");
					expect(result.afterConsecutiveLosses[level]).toHaveProperty("wins");
					expect(result.afterConsecutiveLosses[level]).toHaveProperty(
						"winRate",
					);
					expect(result.afterConsecutiveLosses[level]).toHaveProperty("avgPnl");
				}
			});
		});

		describe("Data Validation", () => {
			it("should have revenge indicator between 0 and 100", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result.revengeIndicator).toBeGreaterThanOrEqual(0);
				expect(result.revengeIndicator).toBeLessThanOrEqual(100);
			});

			it("should have win rates between 0 and 100", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result.afterWin.winRate).toBeGreaterThanOrEqual(0);
				expect(result.afterWin.winRate).toBeLessThanOrEqual(100);
				expect(result.afterLoss.winRate).toBeGreaterThanOrEqual(0);
				expect(result.afterLoss.winRate).toBeLessThanOrEqual(100);
			});

			it("should have non-negative trade counts", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result.afterWin.trades).toBeGreaterThanOrEqual(0);
				expect(result.afterLoss.trades).toBeGreaterThanOrEqual(0);
			});

			it("should have correct win/loss breakdown matching trades", async () => {
				const result = await caller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				// wins + losses should be <= trades (breakevens don't count)
				expect(
					result.afterWin.wins + result.afterWin.losses,
				).toBeLessThanOrEqual(result.afterWin.trades);
				expect(
					result.afterLoss.wins + result.afterLoss.losses,
				).toBeLessThanOrEqual(result.afterLoss.trades);
			});
		});

		describe("Edge Cases", () => {
			it("should return default values for user with no trades", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getRevengeTrading({
					accountId: emptyAccount.id,
				});

				expect(result.afterWin.trades).toBe(0);
				expect(result.afterLoss.trades).toBe(0);
				expect(result.revengeIndicator).toBe(0);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getRevengeTrading();

				expect(result).toBeDefined();
				expect(result.revengeIndicator).toBeDefined();
			});
		});

		describe("Authorization", () => {
			it("should not return data for another user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getRevengeTrading({
					accountId: testData.account.id,
				});

				expect(result.afterWin.trades).toBe(0);
				expect(result.afterLoss.trades).toBe(0);
			});
		});
	});

	// ============================================================================
	// OVERTRADING ANALYSIS
	// ============================================================================

	describe("getOvertradingAnalysis", () => {
		describe("Return Structure", () => {
			it("should return all expected properties", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				expect(result).toHaveProperty("byTradeCount");
				expect(result).toHaveProperty("optimalRange");
				expect(result).toHaveProperty("overtradingThreshold");
				expect(result).toHaveProperty("correlationScore");
			});

			it("should have byTradeCount as array", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result.byTradeCount)).toBe(true);
			});

			it("should have optimalRange with min and max", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				expect(result.optimalRange).toHaveProperty("min");
				expect(result.optimalRange).toHaveProperty("max");
				expect(typeof result.optimalRange.min).toBe("number");
				expect(typeof result.optimalRange.max).toBe("number");
			});

			it("should have byTradeCount entries with valid structure", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				for (const entry of result.byTradeCount) {
					expect(entry).toHaveProperty("tradeCount");
					expect(entry).toHaveProperty("days");
					expect(entry).toHaveProperty("totalPnl");
					expect(entry).toHaveProperty("avgDailyPnl");
					expect(entry).toHaveProperty("wins");
					expect(entry).toHaveProperty("losses");
					expect(entry).toHaveProperty("winRate");
				}
			});
		});

		describe("Data Validation", () => {
			it("should have valid optimal range (min <= max)", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				expect(result.optimalRange.min).toBeLessThanOrEqual(
					result.optimalRange.max,
				);
			});

			it("should have correlation score between -1 and 1", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				expect(result.correlationScore).toBeGreaterThanOrEqual(-1);
				expect(result.correlationScore).toBeLessThanOrEqual(1);
			});

			it("should have positive overtrading threshold", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				expect(result.overtradingThreshold).toBeGreaterThan(0);
			});

			it("should have win rates between 0 and 100 for each bucket", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				for (const entry of result.byTradeCount) {
					expect(entry.winRate).toBeGreaterThanOrEqual(0);
					expect(entry.winRate).toBeLessThanOrEqual(100);
				}
			});

			it("should detect multi-trade day from test data", async () => {
				const result = await caller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				// Test data has Monday with 2 trades
				const twoTradeDays = result.byTradeCount.find(
					(b) => b.tradeCount === 2,
				);
				expect(twoTradeDays).toBeDefined();
			});
		});

		describe("Edge Cases", () => {
			it("should return default values for user with no trades", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getOvertradingAnalysis({
					accountId: emptyAccount.id,
				});

				expect(result.byTradeCount).toHaveLength(0);
				expect(result.correlationScore).toBe(0);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getOvertradingAnalysis();

				expect(result).toBeDefined();
				expect(result.byTradeCount).toBeDefined();
			});
		});

		describe("Authorization", () => {
			it("should not return data for another user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getOvertradingAnalysis({
					accountId: testData.account.id,
				});

				expect(result.byTradeCount).toHaveLength(0);
			});
		});
	});

	// ============================================================================
	// HOLDING TIME ANALYSIS
	// ============================================================================

	describe("getHoldingTimeAnalysis", () => {
		describe("Return Structure", () => {
			it("should return all expected properties", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				expect(result).toHaveProperty("buckets");
				expect(result).toHaveProperty("optimalDuration");
				expect(result).toHaveProperty("totalTrades");
			});

			it("should have buckets as array", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result.buckets)).toBe(true);
			});

			it("should have bucket entries with valid structure", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				expect(result.buckets.length).toBeGreaterThan(0);
				for (const bucket of result.buckets) {
					expect(bucket).toHaveProperty("label");
					expect(bucket).toHaveProperty("minMinutes");
					expect(bucket).toHaveProperty("maxMinutes");
					expect(bucket).toHaveProperty("trades");
					expect(bucket).toHaveProperty("wins");
					expect(bucket).toHaveProperty("losses");
					expect(bucket).toHaveProperty("totalPnl");
					expect(bucket).toHaveProperty("avgPnl");
					expect(bucket).toHaveProperty("winRate");
				}
			});

			it("should have predefined duration buckets", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				const labels = result.buckets.map((b) => b.label);
				expect(labels).toContain("0-5min");
				expect(labels).toContain("5-15min");
				expect(labels).toContain("15-30min");
				expect(labels).toContain("30min-1h");
				expect(labels).toContain("1h-2h");
				expect(labels).toContain("2h+");
			});
		});

		describe("Data Validation", () => {
			it("should have totalTrades matching test data", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				expect(result.totalTrades).toBe(testData.expectedMetrics.totalTrades);
			});

			it("should have win rates between 0 and 100 for each bucket", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				for (const bucket of result.buckets) {
					expect(bucket.winRate).toBeGreaterThanOrEqual(0);
					expect(bucket.winRate).toBeLessThanOrEqual(100);
				}
			});

			it("should have non-negative trade counts", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				for (const bucket of result.buckets) {
					expect(bucket.trades).toBeGreaterThanOrEqual(0);
					expect(bucket.wins).toBeGreaterThanOrEqual(0);
					expect(bucket.losses).toBeGreaterThanOrEqual(0);
				}
			});

			it("should sum bucket trades to totalTrades", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				const bucketSum = result.buckets.reduce((sum, b) => sum + b.trades, 0);
				expect(bucketSum).toBe(result.totalTrades);
			});

			it("should have trades distributed across different duration buckets", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				// Test data has trades of various durations
				const bucketsWithTrades = result.buckets.filter((b) => b.trades > 0);
				expect(bucketsWithTrades.length).toBeGreaterThan(1);
			});
		});

		describe("Edge Cases", () => {
			it("should return empty buckets for user with no trades", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getHoldingTimeAnalysis({
					accountId: emptyAccount.id,
				});

				expect(result.totalTrades).toBe(0);
				// Buckets should exist but have 0 trades
				for (const bucket of result.buckets) {
					expect(bucket.trades).toBe(0);
				}
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getHoldingTimeAnalysis();

				expect(result).toBeDefined();
				expect(result.buckets).toBeDefined();
			});
		});

		describe("Authorization", () => {
			it("should not return data for another user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				});

				expect(result.totalTrades).toBe(0);
			});
		});
	});

	// ============================================================================
	// BEHAVIORAL PATTERNS SUMMARY
	// ============================================================================

	describe("getBehavioralPatterns", () => {
		describe("Return Structure", () => {
			it("should return all expected properties", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				expect(result).toHaveProperty("tiltScore");
				expect(result).toHaveProperty("disciplineScore");
				expect(result).toHaveProperty("overtradingTendency");
				expect(result).toHaveProperty("emotionalStateBreakdown");
				expect(result).toHaveProperty("totalTrades");
			});

			it("should have emotionalStateBreakdown as array", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result.emotionalStateBreakdown)).toBe(true);
			});

			it("should have emotionalStateBreakdown entries with valid structure", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				for (const entry of result.emotionalStateBreakdown) {
					expect(entry).toHaveProperty("state");
					expect(entry).toHaveProperty("trades");
					expect(entry).toHaveProperty("pnl");
					expect(entry).toHaveProperty("avgPnl");
					expect(entry).toHaveProperty("winRate");
				}
			});
		});

		describe("Data Validation", () => {
			it("should have tiltScore between 0 and 100", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				expect(result.tiltScore).toBeGreaterThanOrEqual(0);
				expect(result.tiltScore).toBeLessThanOrEqual(100);
			});

			it("should have disciplineScore between 0 and 100", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				expect(result.disciplineScore).toBeGreaterThanOrEqual(0);
				expect(result.disciplineScore).toBeLessThanOrEqual(100);
			});

			it("should have overtradingTendency between 0 and 100", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				expect(result.overtradingTendency).toBeGreaterThanOrEqual(0);
				expect(result.overtradingTendency).toBeLessThanOrEqual(100);
			});

			it("should have totalTrades matching test data", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				expect(result.totalTrades).toBe(testData.expectedMetrics.totalTrades);
			});

			it("should have win rates between 0 and 100 in emotional breakdown", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				for (const entry of result.emotionalStateBreakdown) {
					expect(entry.winRate).toBeGreaterThanOrEqual(0);
					expect(entry.winRate).toBeLessThanOrEqual(100);
				}
			});

			it("should have emotional breakdown trades summing to totalTrades", async () => {
				const result = await caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				const emotionalSum = result.emotionalStateBreakdown.reduce(
					(sum, e) => sum + e.trades,
					0,
				);
				expect(emotionalSum).toBe(result.totalTrades);
			});
		});

		describe("Edge Cases", () => {
			it("should return default values for user with no trades", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getBehavioralPatterns({
					accountId: emptyAccount.id,
				});

				expect(result.tiltScore).toBe(0);
				expect(result.disciplineScore).toBe(100); // 100 when no trades (nothing to be undisciplined about)
				expect(result.overtradingTendency).toBe(0);
				expect(result.totalTrades).toBe(0);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getBehavioralPatterns();

				expect(result).toBeDefined();
				expect(result.tiltScore).toBeDefined();
			});
		});

		describe("Authorization", () => {
			it("should not return data for another user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				});

				expect(result.totalTrades).toBe(0);
			});
		});
	});

	// ============================================================================
	// CROSS-PROCEDURE CONSISTENCY
	// ============================================================================

	describe("Cross-Procedure Consistency", () => {
		it("should have consistent totalTrades across procedures", async () => {
			const [holdingTime, behavioral] = await Promise.all([
				caller.analytics.getHoldingTimeAnalysis({
					accountId: testData.account.id,
				}),
				caller.analytics.getBehavioralPatterns({
					accountId: testData.account.id,
				}),
			]);

			expect(holdingTime.totalTrades).toBe(behavioral.totalTrades);
		});

		it("should have all numeric fields as finite numbers", async () => {
			const [streak, revenge, overtrading, holdingTime, behavioral] =
				await Promise.all([
					caller.analytics.getStreakAnalysis({
						accountId: testData.account.id,
					}),
					caller.analytics.getRevengeTrading({
						accountId: testData.account.id,
					}),
					caller.analytics.getOvertradingAnalysis({
						accountId: testData.account.id,
					}),
					caller.analytics.getHoldingTimeAnalysis({
						accountId: testData.account.id,
					}),
					caller.analytics.getBehavioralPatterns({
						accountId: testData.account.id,
					}),
				]);

			// Streak analysis
			expect(Number.isFinite(streak.maxWinStreak)).toBe(true);
			expect(Number.isFinite(streak.maxLossStreak)).toBe(true);

			// Revenge trading
			expect(Number.isFinite(revenge.revengeIndicator)).toBe(true);
			expect(Number.isFinite(revenge.afterWin.winRate)).toBe(true);

			// Overtrading
			expect(Number.isFinite(overtrading.correlationScore)).toBe(true);

			// Holding time
			expect(Number.isFinite(holdingTime.totalTrades)).toBe(true);

			// Behavioral
			expect(Number.isFinite(behavioral.tiltScore)).toBe(true);
			expect(Number.isFinite(behavioral.disciplineScore)).toBe(true);
		});
	});

	// ============================================================================
	// FILTER SUPPORT
	// ============================================================================

	describe("Filter Support", () => {
		it("should accept filters for streak analysis", async () => {
			const result = await caller.analytics.getStreakAnalysis({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
				},
			});

			expect(result).toBeDefined();
			expect(result.currentStreak).toBeDefined();
		});

		it("should accept filters for revenge trading", async () => {
			const result = await caller.analytics.getRevengeTrading({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
				},
			});

			expect(result).toBeDefined();
			expect(result.revengeIndicator).toBeDefined();
		});

		it("should accept filters for overtrading analysis", async () => {
			const result = await caller.analytics.getOvertradingAnalysis({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
				},
			});

			expect(result).toBeDefined();
			expect(result.byTradeCount).toBeDefined();
		});

		it("should accept filters for holding time analysis", async () => {
			const result = await caller.analytics.getHoldingTimeAnalysis({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
				},
			});

			expect(result).toBeDefined();
			// ES trades are 4 out of 7
			expect(result.totalTrades).toBe(4);
		});

		it("should accept filters for behavioral patterns", async () => {
			const result = await caller.analytics.getBehavioralPatterns({
				accountId: testData.account.id,
				filters: {
					symbols: ["ES"],
				},
			});

			expect(result).toBeDefined();
			expect(result.totalTrades).toBe(4);
		});

		it("should filter by date range correctly", async () => {
			const result = await caller.analytics.getBehavioralPatterns({
				accountId: testData.account.id,
				filters: {
					dateRange: {
						start: "2024-01-08T00:00:00Z",
						end: "2024-01-09T23:59:59Z",
					},
				},
			});

			// Monday + Tuesday trades = 2 + 1 = 3
			expect(result.totalTrades).toBe(3);
		});
	});
});
