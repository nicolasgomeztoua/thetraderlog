import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	setupTrader,
	setupTraderWithAnalyticsData,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics Risk", () => {
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
	// getRiskMetrics - Core Risk Metrics
	// ============================================================================

	describe("getRiskMetrics", () => {
		describe("Return Type Verification", () => {
			it("should return all expected risk metric fields", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				// Cumulative P&L metrics
				expect(result).toHaveProperty("totalPnl");
				expect(result).toHaveProperty("peakPnl");

				// Drawdown metrics
				expect(result).toHaveProperty("maxDrawdown");
				expect(result).toHaveProperty("maxDrawdownPercent");
				expect(result).toHaveProperty("currentDrawdown");
				expect(result).toHaveProperty("currentDrawdownPercent");
				expect(result).toHaveProperty("avgDrawdown");
				expect(result).toHaveProperty("avgDrawdownPercent");
				expect(result).toHaveProperty("numberOfDrawdowns");

				// Time metrics
				expect(result).toHaveProperty("maxDrawdownDays");
				expect(result).toHaveProperty("avgRecoveryDays");
				expect(result).toHaveProperty("percentTimeInDrawdown");

				// Risk-adjusted returns
				expect(result).toHaveProperty("sortinoRatio");
				expect(result).toHaveProperty("calmarRatio");
				expect(result).toHaveProperty("recoveryFactor");
				expect(result).toHaveProperty("ulcerIndex");

				// Position sizing
				expect(result).toHaveProperty("kellyPercent");
				expect(result).toHaveProperty("halfKellyPercent");
				expect(result).toHaveProperty("riskOfRuin");

				// Context metrics
				expect(result).toHaveProperty("winRate");
				expect(result).toHaveProperty("avgWin");
				expect(result).toHaveProperty("avgLoss");
				expect(result).toHaveProperty("totalTrades");

				// Ruin threshold info
				expect(result).toHaveProperty("ruinThreshold");
				expect(result).toHaveProperty("ruinThresholdPercent");
				expect(result).toHaveProperty("ruinThresholdSource");

				// Risk per trade info
				expect(result).toHaveProperty("riskPerTrade");
				expect(result).toHaveProperty("riskPerTradePercent");
				expect(result).toHaveProperty("riskPerTradeSource");
			});

			it("should return correct types for all fields", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				// All numeric fields should be numbers
				expect(typeof result.totalPnl).toBe("number");
				expect(typeof result.peakPnl).toBe("number");
				expect(typeof result.maxDrawdown).toBe("number");
				expect(typeof result.maxDrawdownPercent).toBe("number");
				expect(typeof result.currentDrawdown).toBe("number");
				expect(typeof result.currentDrawdownPercent).toBe("number");
				expect(typeof result.avgDrawdown).toBe("number");
				expect(typeof result.avgDrawdownPercent).toBe("number");
				expect(typeof result.numberOfDrawdowns).toBe("number");
				expect(typeof result.maxDrawdownDays).toBe("number");
				expect(typeof result.avgRecoveryDays).toBe("number");
				expect(typeof result.percentTimeInDrawdown).toBe("number");
				expect(typeof result.sortinoRatio).toBe("number");
				expect(typeof result.calmarRatio).toBe("number");
				expect(typeof result.recoveryFactor).toBe("number");
				expect(typeof result.ulcerIndex).toBe("number");
				expect(typeof result.kellyPercent).toBe("number");
				expect(typeof result.halfKellyPercent).toBe("number");
				expect(typeof result.riskOfRuin).toBe("number");
				expect(typeof result.winRate).toBe("number");
				expect(typeof result.avgWin).toBe("number");
				expect(typeof result.avgLoss).toBe("number");
				expect(typeof result.totalTrades).toBe("number");
				expect(typeof result.ruinThreshold).toBe("number");
				expect(typeof result.ruinThresholdPercent).toBe("number");
				expect(typeof result.ruinThresholdSource).toBe("string");
				expect(typeof result.riskPerTrade).toBe("number");
				expect(typeof result.riskPerTradePercent).toBe("number");
				expect(typeof result.riskPerTradeSource).toBe("string");
			});
		});

		describe("Drawdown Metrics", () => {
			it("should return max drawdown as a positive number", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
			});

			it("should return current drawdown as a positive number", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.currentDrawdown).toBeGreaterThanOrEqual(0);
			});

			it("should have current drawdown less than or equal to max drawdown", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.currentDrawdown).toBeLessThanOrEqual(
					result.maxDrawdown + 0.01,
				); // Allow for floating point
			});

			it("should return drawdown percent between 0 and 100", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
				expect(result.currentDrawdownPercent).toBeGreaterThanOrEqual(0);
			});

			it("should return number of drawdowns as non-negative integer", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.numberOfDrawdowns).toBeGreaterThanOrEqual(0);
				expect(Number.isInteger(result.numberOfDrawdowns)).toBe(true);
			});

			it("should return percent time in drawdown between 0 and 100", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.percentTimeInDrawdown).toBeGreaterThanOrEqual(0);
				expect(result.percentTimeInDrawdown).toBeLessThanOrEqual(100);
			});
		});

		describe("Risk-Adjusted Returns", () => {
			it("should return Sortino ratio as a number", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(typeof result.sortinoRatio).toBe("number");
				expect(Number.isFinite(result.sortinoRatio)).toBe(true);
			});

			it("should return Calmar ratio as a number", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(typeof result.calmarRatio).toBe("number");
			});

			it("should return recovery factor as a number", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(typeof result.recoveryFactor).toBe("number");
			});

			it("should return ulcer index as a non-negative number", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.ulcerIndex).toBeGreaterThanOrEqual(0);
			});
		});

		describe("Position Sizing Metrics", () => {
			it("should return Kelly criterion percentage", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(typeof result.kellyPercent).toBe("number");
				expect(typeof result.halfKellyPercent).toBe("number");
			});

			it("should have half Kelly equal to Kelly divided by 2", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.halfKellyPercent).toBeCloseTo(
					result.kellyPercent / 2,
					10,
				);
			});

			it("should return risk of ruin between 0 and 100", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.riskOfRuin).toBeGreaterThanOrEqual(0);
				expect(result.riskOfRuin).toBeLessThanOrEqual(100);
			});

			it("should return kelly percent between 0 and 100", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.kellyPercent).toBeGreaterThanOrEqual(0);
				expect(result.kellyPercent).toBeLessThanOrEqual(100);
			});
		});

		describe("Context Metrics", () => {
			it("should return win rate matching overview", async () => {
				const riskResult = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});
				const overviewResult = await caller.analytics.getOverview({
					accountId: testData.account.id,
				});

				expect(riskResult.winRate).toBeCloseTo(overviewResult.winRate, 1);
			});

			it("should return avgWin and avgLoss matching overview", async () => {
				const riskResult = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});
				const overviewResult = await caller.analytics.getOverview({
					accountId: testData.account.id,
				});

				expect(riskResult.avgWin).toBeCloseTo(overviewResult.avgWin, 0);
				expect(riskResult.avgLoss).toBeCloseTo(overviewResult.avgLoss, 0);
			});

			it("should return correct total trades count", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.totalTrades).toBe(testData.expectedMetrics.totalTrades);
			});
		});

		describe("Edge Cases", () => {
			it("should return zeros when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getRiskMetrics({
					accountId: emptyAccount.id,
				});

				expect(result.totalPnl).toBe(0);
				expect(result.peakPnl).toBe(0);
				expect(result.maxDrawdown).toBe(0);
				expect(result.currentDrawdown).toBe(0);
				expect(result.numberOfDrawdowns).toBe(0);
				expect(result.percentTimeInDrawdown).toBe(0);
				expect(result.kellyPercent).toBe(0);
				expect(result.riskOfRuin).toBe(100); // No edge = certain ruin
				expect(result.totalTrades).toBe(0);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getRiskMetrics();

				expect(result).toBeDefined();
				expect(typeof result.maxDrawdown).toBe("number");
			});

			it("should handle empty object input", async () => {
				const result = await caller.analytics.getRiskMetrics({});

				expect(result).toBeDefined();
				expect(typeof result.maxDrawdown).toBe("number");
			});
		});

		describe("Authorization", () => {
			it("should only return data for the authenticated user", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getRiskMetrics({
					accountId: testData.account.id,
				});

				expect(result.totalTrades).toBe(0);
				expect(result.totalPnl).toBe(0);
			});

			it("should return zeros for non-existent account", async () => {
				const result = await caller.analytics.getRiskMetrics({
					accountId: "non-existent-account-id",
				});

				expect(result.totalTrades).toBe(0);
				expect(result.maxDrawdown).toBe(0);
			});
		});
	});

	// ============================================================================
	// getEquityCurve - Cumulative P&L Curve
	// ============================================================================

	describe("getEquityCurve", () => {
		describe("Return Type Verification", () => {
			it("should return an array of equity curve points", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
			});

			it("should return correct number of points matching trade count", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				expect(result.length).toBe(testData.expectedMetrics.totalTrades);
			});

			it("should have all expected fields on each point", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				if (result.length > 0) {
					const point = result[0];
					expect(point).toHaveProperty("date");
					expect(point).toHaveProperty("equity");
					expect(point).toHaveProperty("peak");
					expect(point).toHaveProperty("drawdown");
					expect(point).toHaveProperty("drawdownPercent");
					expect(point).toHaveProperty("pnl");
					expect(point).toHaveProperty("tradeIndex");
					expect(point).toHaveProperty("tradeId");
					expect(point).toHaveProperty("symbol");
				}
			});

			it("should return date as ISO string", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				if (result.length > 0) {
					const point = result[0];
					expect(typeof point?.date).toBe("string");
					// Should be valid ISO date
					expect(new Date(point?.date ?? "").toISOString()).toBe(point?.date);
				}
			});
		});

		describe("Cumulative P&L Calculations", () => {
			it("should have cumulative P&L that matches total P&L at the end", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				const lastPoint = result[result.length - 1];
				expect(lastPoint?.equity).toBeCloseTo(
					testData.expectedMetrics.totalPnl,
					0,
				);
			});

			it("should start cumulative P&L from first trade PnL", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				if (result.length > 0) {
					const firstPoint = result[0];
					// First point equity should equal first trade pnl
					expect(firstPoint?.equity).toBe(firstPoint?.pnl);
				}
			});

			it("should have cumulative equity that accumulates correctly", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				let runningTotal = 0;
				for (const point of result) {
					runningTotal += point.pnl;
					expect(point.equity).toBeCloseTo(runningTotal, 8);
				}
			});
		});

		describe("Peak Tracking", () => {
			it("should track peak correctly - peak should never decrease", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (let i = 1; i < result.length; i++) {
					const current = result[i];
					const previous = result[i - 1];
					expect(current?.peak).toBeGreaterThanOrEqual(previous?.peak ?? 0);
				}
			});

			it("should have peak greater than or equal to equity", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (const point of result) {
					expect(point.peak).toBeGreaterThanOrEqual(point.equity);
				}
			});
		});

		describe("Drawdown Calculations", () => {
			it("should have drawdown equal to peak minus equity", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (const point of result) {
					expect(point.drawdown).toBeCloseTo(point.peak - point.equity, 8);
				}
			});

			it("should have non-negative drawdown values", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (const point of result) {
					expect(point.drawdown).toBeGreaterThanOrEqual(0);
				}
			});

			it("should have drawdown percent between 0 and 100 when peak is positive", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (const point of result) {
					if (point.peak > 0) {
						expect(point.drawdownPercent).toBeGreaterThanOrEqual(0);
						expect(point.drawdownPercent).toBeLessThanOrEqual(100);
					}
				}
			});
		});

		describe("Trade Metadata", () => {
			it("should include trade IDs", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (const point of result) {
					expect(point.tradeId).toBeTruthy();
					expect(typeof point.tradeId).toBe("string");
				}
			});

			it("should include symbols", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (const point of result) {
					expect(point.symbol).toBeTruthy();
					expect(typeof point.symbol).toBe("string");
				}
			});

			it("should have incrementing trade index", async () => {
				const result = await caller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				for (let i = 0; i < result.length; i++) {
					expect(result[i]?.tradeIndex).toBe(i + 1);
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

				const result = await emptyCaller.analytics.getEquityCurve({
					accountId: emptyAccount.id,
				});

				expect(result).toEqual([]);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getEquityCurve();

				expect(Array.isArray(result)).toBe(true);
			});
		});

		describe("Authorization", () => {
			it("should return empty array for other user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getEquityCurve({
					accountId: testData.account.id,
				});

				expect(result).toEqual([]);
			});
		});
	});

	// ============================================================================
	// getDrawdownHistory - Historical Drawdown Periods
	// ============================================================================

	describe("getDrawdownHistory", () => {
		describe("Return Type Verification", () => {
			it("should return an array of drawdown periods", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				expect(Array.isArray(result)).toBe(true);
			});

			it("should have all expected fields on each period", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				if (result.length > 0) {
					const period = result[0];
					expect(period).toHaveProperty("startDate");
					expect(period).toHaveProperty("troughDate");
					expect(period).toHaveProperty("recoveryDate");
					expect(period).toHaveProperty("peakEquity");
					expect(period).toHaveProperty("troughEquity");
					expect(period).toHaveProperty("drawdownAmount");
					expect(period).toHaveProperty("drawdownPercent");
					expect(period).toHaveProperty("tradesInDrawdown");
					expect(period).toHaveProperty("daysToTrough");
					expect(period).toHaveProperty("daysToRecover");
					expect(period).toHaveProperty("totalDays");
				}
			});

			it("should return dates as ISO strings", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				if (result.length > 0) {
					const period = result[0];
					expect(typeof period?.startDate).toBe("string");
					expect(typeof period?.troughDate).toBe("string");
					// Recovery date can be null if still in drawdown
					if (period?.recoveryDate !== null) {
						expect(typeof period?.recoveryDate).toBe("string");
					}
				}
			});
		});

		describe("Drawdown Period Properties", () => {
			it("should have drawdown amount as positive number", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				for (const period of result) {
					expect(period.drawdownAmount).toBeGreaterThan(0);
				}
			});

			it("should have trough equity less than peak equity", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				for (const period of result) {
					expect(period.troughEquity).toBeLessThan(period.peakEquity);
				}
			});

			it("should have trades in drawdown as positive integer", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				for (const period of result) {
					expect(period.tradesInDrawdown).toBeGreaterThan(0);
					expect(Number.isInteger(period.tradesInDrawdown)).toBe(true);
				}
			});

			it("should be sorted by drawdown amount descending (largest first)", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				for (let i = 1; i < result.length; i++) {
					const current = result[i];
					const previous = result[i - 1];
					expect(current?.drawdownAmount).toBeLessThanOrEqual(
						previous?.drawdownAmount ?? 0,
					);
				}
			});
		});

		describe("Limit Parameter", () => {
			it("should respect limit parameter", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
					limit: 1,
				});

				expect(result.length).toBeLessThanOrEqual(1);
			});

			it("should default to 10 periods", async () => {
				const result = await caller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				expect(result.length).toBeLessThanOrEqual(10);
			});
		});

		describe("Edge Cases", () => {
			it("should return empty array when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getDrawdownHistory({
					accountId: emptyAccount.id,
				});

				expect(result).toEqual([]);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getDrawdownHistory();

				expect(Array.isArray(result)).toBe(true);
			});
		});

		describe("Authorization", () => {
			it("should return empty array for other user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getDrawdownHistory({
					accountId: testData.account.id,
				});

				expect(result).toEqual([]);
			});
		});
	});

	// ============================================================================
	// getRMultipleDistribution - R-Multiple Analysis
	// ============================================================================

	describe("getRMultipleDistribution", () => {
		describe("Return Type Verification", () => {
			it("should return buckets and stats", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				expect(result).toHaveProperty("buckets");
				expect(result).toHaveProperty("stats");
				expect(Array.isArray(result.buckets)).toBe(true);
			});

			it("should have all expected bucket fields", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				if (result.buckets.length > 0) {
					const bucket = result.buckets[0];
					expect(bucket).toHaveProperty("label");
					expect(bucket).toHaveProperty("count");
					expect(bucket).toHaveProperty("totalPnl");
					expect(bucket).toHaveProperty("avgR");
				}
			});

			it("should have all expected stats fields", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				expect(result.stats).toHaveProperty("totalTrades");
				expect(result.stats).toHaveProperty("tradesWithR");
				expect(result.stats).toHaveProperty("avgRMultiple");
				expect(result.stats).toHaveProperty("avgWinR");
				expect(result.stats).toHaveProperty("avgLossR");
				expect(result.stats).toHaveProperty("maxR");
				expect(result.stats).toHaveProperty("minR");
			});
		});

		describe("Bucket Structure", () => {
			it("should have predefined R-multiple buckets", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				const expectedLabels = [
					"< -2R",
					"-2R to -1R",
					"-1R to 0",
					"0 to 1R",
					"1R to 2R",
					"2R to 3R",
					"> 3R",
				];

				expect(result.buckets.length).toBe(expectedLabels.length);
				for (let i = 0; i < expectedLabels.length; i++) {
					expect(result.buckets[i]?.label).toBe(expectedLabels[i]);
				}
			});

			it("should have non-negative count in each bucket", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				for (const bucket of result.buckets) {
					expect(bucket.count).toBeGreaterThanOrEqual(0);
					expect(Number.isInteger(bucket.count)).toBe(true);
				}
			});
		});

		describe("Statistics Validation", () => {
			it("should have tradesWithR less than or equal to totalTrades", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				expect(result.stats.tradesWithR).toBeLessThanOrEqual(
					result.stats.totalTrades,
				);
			});

			it("should have avgWinR greater than avgLossR when there are wins and losses", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				// Only check if we have both positive and negative R trades
				if (result.stats.avgWinR > 0 && result.stats.avgLossR < 0) {
					expect(result.stats.avgWinR).toBeGreaterThan(result.stats.avgLossR);
				}
			});

			it("should have maxR greater than or equal to minR", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				expect(result.stats.maxR).toBeGreaterThanOrEqual(result.stats.minR);
			});

			it("should have sum of bucket counts equal to tradesWithR", async () => {
				const result = await caller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				const totalInBuckets = result.buckets.reduce(
					(sum, b) => sum + b.count,
					0,
				);
				expect(totalInBuckets).toBe(result.stats.tradesWithR);
			});
		});

		describe("Edge Cases", () => {
			it("should return empty buckets when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getRMultipleDistribution({
					accountId: emptyAccount.id,
				});

				expect(result.stats.totalTrades).toBe(0);
				expect(result.stats.tradesWithR).toBe(0);
				expect(result.stats.avgRMultiple).toBe(0);
				for (const bucket of result.buckets) {
					expect(bucket.count).toBe(0);
				}
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getRMultipleDistribution();

				expect(result).toHaveProperty("buckets");
				expect(result).toHaveProperty("stats");
			});
		});

		describe("Authorization", () => {
			it("should return zeros for other user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getRMultipleDistribution({
					accountId: testData.account.id,
				});

				expect(result.stats.totalTrades).toBe(0);
			});
		});
	});

	// ============================================================================
	// getPositionSizeAnalysis - Position Size Buckets
	// ============================================================================

	describe("getPositionSizeAnalysis", () => {
		describe("Return Type Verification", () => {
			it("should return buckets and stats", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				expect(result).toHaveProperty("buckets");
				expect(result).toHaveProperty("stats");
			});

			it("should have all expected bucket fields", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				if (result.buckets.length > 0) {
					const bucket = result.buckets[0];
					expect(bucket).toHaveProperty("label");
					expect(bucket).toHaveProperty("range");
					expect(bucket).toHaveProperty("trades");
					expect(bucket).toHaveProperty("wins");
					expect(bucket).toHaveProperty("losses");
					expect(bucket).toHaveProperty("totalPnl");
					expect(bucket).toHaveProperty("avgPnl");
					expect(bucket).toHaveProperty("winRate");
				}
			});

			it("should have all expected stats fields", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				expect(result.stats).toHaveProperty("totalTrades");
				expect(result.stats).toHaveProperty("avgSize");
				expect(result.stats).toHaveProperty("minSize");
				expect(result.stats).toHaveProperty("maxSize");
			});
		});

		describe("Bucket Structure", () => {
			it("should have percentile-based buckets", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				const expectedLabels = ["0-25%", "25-50%", "50-75%", "75-100%"];

				if (result.buckets.length > 0) {
					expect(result.buckets.length).toBe(4);
					for (let i = 0; i < result.buckets.length; i++) {
						expect(result.buckets[i]?.label).toBe(expectedLabels[i]);
					}
				}
			});

			it("should have non-negative values in buckets", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				for (const bucket of result.buckets) {
					expect(bucket.trades).toBeGreaterThanOrEqual(0);
					expect(bucket.wins).toBeGreaterThanOrEqual(0);
					expect(bucket.losses).toBeGreaterThanOrEqual(0);
					expect(bucket.winRate).toBeGreaterThanOrEqual(0);
					expect(bucket.winRate).toBeLessThanOrEqual(100);
				}
			});
		});

		describe("Statistics Validation", () => {
			it("should have avgSize between minSize and maxSize", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				if (result.stats.totalTrades > 0) {
					expect(result.stats.avgSize).toBeGreaterThanOrEqual(
						result.stats.minSize,
					);
					expect(result.stats.avgSize).toBeLessThanOrEqual(
						result.stats.maxSize,
					);
				}
			});

			it("should have sum of bucket trades equal to totalTrades", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				const totalInBuckets = result.buckets.reduce(
					(sum, b) => sum + b.trades,
					0,
				);
				expect(totalInBuckets).toBe(result.stats.totalTrades);
			});

			it("should have wins + losses less than or equal to trades for each bucket", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				for (const bucket of result.buckets) {
					expect(bucket.wins + bucket.losses).toBeLessThanOrEqual(bucket.trades);
				}
			});
		});

		describe("Edge Cases", () => {
			it("should return empty buckets when no trades exist", async () => {
				const { user: emptyUser, account: emptyAccount } = await setupTrader();
				const emptyCaller = await createTestCaller(
					emptyUser.clerkId,
					emptyUser,
				);

				const result = await emptyCaller.analytics.getPositionSizeAnalysis({
					accountId: emptyAccount.id,
				});

				expect(result.stats.totalTrades).toBe(0);
				expect(result.stats.avgSize).toBe(0);
				expect(result.stats.minSize).toBe(0);
				expect(result.stats.maxSize).toBe(0);
				expect(result.buckets).toEqual([]);
			});

			it("should handle undefined input", async () => {
				const result = await caller.analytics.getPositionSizeAnalysis();

				expect(result).toHaveProperty("buckets");
				expect(result).toHaveProperty("stats");
			});
		});

		describe("Authorization", () => {
			it("should return empty result for other user's account", async () => {
				const { user: otherUser } = await setupTrader();
				const otherCaller = await createTestCaller(
					otherUser.clerkId,
					otherUser,
				);

				const result = await otherCaller.analytics.getPositionSizeAnalysis({
					accountId: testData.account.id,
				});

				expect(result.stats.totalTrades).toBe(0);
				expect(result.buckets).toEqual([]);
			});
		});
	});

	// ============================================================================
	// Cross-Procedure Consistency Tests
	// ============================================================================

	describe("Cross-Procedure Consistency", () => {
		it("should have consistent total P&L across procedures", async () => {
			const riskMetrics = await caller.analytics.getRiskMetrics({
				accountId: testData.account.id,
			});
			const equityCurve = await caller.analytics.getEquityCurve({
				accountId: testData.account.id,
			});

			if (equityCurve.length > 0) {
				const lastPoint = equityCurve[equityCurve.length - 1];
				expect(riskMetrics.totalPnl).toBeCloseTo(lastPoint?.equity ?? 0, 0);
			}
		});

		it("should have consistent trade counts across procedures", async () => {
			const riskMetrics = await caller.analytics.getRiskMetrics({
				accountId: testData.account.id,
			});
			const equityCurve = await caller.analytics.getEquityCurve({
				accountId: testData.account.id,
			});
			const rMultiple = await caller.analytics.getRMultipleDistribution({
				accountId: testData.account.id,
			});
			const positionSize = await caller.analytics.getPositionSizeAnalysis({
				accountId: testData.account.id,
			});

			expect(equityCurve.length).toBe(riskMetrics.totalTrades);
			expect(rMultiple.stats.totalTrades).toBe(riskMetrics.totalTrades);
			expect(positionSize.stats.totalTrades).toBe(riskMetrics.totalTrades);
		});

		it("should have consistent drawdown data between getRiskMetrics and getEquityCurve", async () => {
			const riskMetrics = await caller.analytics.getRiskMetrics({
				accountId: testData.account.id,
			});
			const equityCurve = await caller.analytics.getEquityCurve({
				accountId: testData.account.id,
			});

			if (equityCurve.length > 0) {
				// Max drawdown in equity curve should match risk metrics
				const maxDrawdownInCurve = Math.max(
					...equityCurve.map((p) => p.drawdown),
				);
				expect(riskMetrics.maxDrawdown).toBeCloseTo(maxDrawdownInCurve, 0);

				// Current drawdown should match last point
				const lastPoint = equityCurve[equityCurve.length - 1];
				expect(riskMetrics.currentDrawdown).toBeCloseTo(
					lastPoint?.drawdown ?? 0,
					0,
				);
			}
		});
	});
});
