/**
 * Unit Tests for Prop Firm Calculator
 *
 * Tests all pure calculation functions for prop firm rule checks:
 * - Drawdown calculations (static, trailing, EOD trailing)
 * - Daily P&L, profit target, consistency rule
 * - Max position size, min trading days, days remaining
 * - Status aggregator (end-to-end with Topstep $50K)
 */

import { describe, expect, it } from "vitest";
import type { CalcTrade, StatusAccount } from "@/lib/prop-firm/calculator";
import {
	calculateConsistencyRule,
	calculateDailyPnl,
	calculateDaysRemaining,
	calculateEodTrailingDrawdown,
	calculateMaxPosition,
	calculateMinTradingDays,
	calculateProfitTarget,
	calculatePropFirmStatus,
	calculateStaticDrawdown,
	calculateTrailingDrawdown,
} from "@/lib/prop-firm/calculator";

// =============================================================================
// HELPERS
// =============================================================================

/** Create a simple trade with P&L on a given day */
function makeTrade(
	netPnl: number,
	entryDay: string,
	exitDay?: string,
	quantity?: number,
): CalcTrade {
	return {
		netPnl: netPnl.toString(),
		fees: null,
		entryTime: new Date(`${entryDay}T10:00:00Z`),
		exitTime: exitDay
			? new Date(`${exitDay}T15:00:00Z`)
			: new Date(`${entryDay}T15:00:00Z`),
		quantity: quantity != null ? quantity.toString() : null,
	};
}

/** Create a trade with specific entry/exit times for position overlap testing */
function makeTimedTrade(
	netPnl: number,
	entryTime: string,
	exitTime: string,
	quantity?: number,
): CalcTrade {
	return {
		netPnl: netPnl.toString(),
		fees: null,
		entryTime: new Date(entryTime),
		exitTime: new Date(exitTime),
		quantity: quantity != null ? quantity.toString() : null,
	};
}

// =============================================================================
// STATIC DRAWDOWN
// =============================================================================

describe("calculateStaticDrawdown", () => {
	it("should return initial balance with 0 drawdown for empty trades", () => {
		const result = calculateStaticDrawdown([], 50000, 2000);
		expect(result.currentEquity).toBe(50000);
		expect(result.maxDrawdownAmount).toBe(0);
		expect(result.drawdownFloor).toBe(48000);
		expect(result.currentDrawdownPercent).toBe(0);
	});

	it("should calculate drawdown after losing trades", () => {
		const trades = [
			makeTrade(-500, "2025-01-06"),
			makeTrade(-300, "2025-01-07"),
		];
		const result = calculateStaticDrawdown(trades, 50000, 2000);
		expect(result.currentEquity).toBe(49200);
		expect(result.maxDrawdownAmount).toBe(800); // 50000 - 49200
		expect(result.drawdownFloor).toBe(48000);
		expect(result.currentDrawdownPercent).toBe(40); // 800/2000 * 100
	});

	it("should track max drawdown even after recovery", () => {
		const trades = [
			makeTrade(-1000, "2025-01-06"),
			makeTrade(-500, "2025-01-07"),
			makeTrade(800, "2025-01-08"), // recovery
		];
		const result = calculateStaticDrawdown(trades, 50000, 2000);
		expect(result.currentEquity).toBe(49300);
		// Max drawdown was 1500 (after first two trades), not current 700
		expect(result.maxDrawdownAmount).toBe(1500);
		expect(result.currentDrawdownPercent).toBe(75); // 1500/2000 * 100
	});

	it("should show violated when drawdown exceeds limit", () => {
		const trades = [makeTrade(-2100, "2025-01-06")];
		const result = calculateStaticDrawdown(trades, 50000, 2000);
		expect(result.maxDrawdownAmount).toBe(2100);
		expect(result.currentDrawdownPercent).toBe(105); // 2100/2000 * 100
	});

	it("should handle winning streak correctly", () => {
		const trades = [
			makeTrade(500, "2025-01-06"),
			makeTrade(300, "2025-01-07"),
			makeTrade(200, "2025-01-08"),
		];
		const result = calculateStaticDrawdown(trades, 50000, 2000);
		expect(result.currentEquity).toBe(51000);
		expect(result.maxDrawdownAmount).toBe(0); // never went below initial
		expect(result.currentDrawdownPercent).toBe(0);
	});
});

// =============================================================================
// TRAILING DRAWDOWN
// =============================================================================

describe("calculateTrailingDrawdown", () => {
	it("should return initial balance with 0 drawdown for empty trades", () => {
		const result = calculateTrailingDrawdown([], 50000, 2000);
		expect(result.currentEquity).toBe(50000);
		expect(result.peakEquity).toBe(50000);
		expect(result.drawdownFloor).toBe(48000);
		expect(result.currentDrawdown).toBe(0);
	});

	it("should trail floor up when equity reaches new high", () => {
		const trades = [
			makeTrade(1000, "2025-01-06"), // equity: 51000, peak: 51000, floor: 49000
			makeTrade(-500, "2025-01-07"), // equity: 50500, peak: 51000, floor: 49000
		];
		const result = calculateTrailingDrawdown(trades, 50000, 2000);
		expect(result.currentEquity).toBe(50500);
		expect(result.peakEquity).toBe(51000);
		expect(result.drawdownFloor).toBe(49000); // peak 51000 - 2000
		expect(result.currentDrawdown).toBe(500);
	});

	it("should track drawdown from peak during losing streak", () => {
		const trades = [
			makeTrade(500, "2025-01-06"), // equity: 50500
			makeTrade(500, "2025-01-07"), // equity: 51000, peak
			makeTrade(-800, "2025-01-08"), // equity: 50200
			makeTrade(-400, "2025-01-09"), // equity: 49800
		];
		const result = calculateTrailingDrawdown(trades, 50000, 2000);
		expect(result.peakEquity).toBe(51000);
		expect(result.currentEquity).toBe(49800);
		expect(result.currentDrawdown).toBe(1200); // 51000 - 49800
		expect(result.drawdownFloor).toBe(49000); // 51000 - 2000
	});

	it("should handle single trade", () => {
		const trades = [makeTrade(-300, "2025-01-06")];
		const result = calculateTrailingDrawdown(trades, 100000, 3000);
		expect(result.currentEquity).toBe(99700);
		expect(result.peakEquity).toBe(100000);
		expect(result.currentDrawdown).toBe(300);
		expect(result.drawdownFloor).toBe(97000);
	});
});

// =============================================================================
// EOD TRAILING DRAWDOWN
// =============================================================================

describe("calculateEodTrailingDrawdown", () => {
	it("should return initial balance with 0 drawdown for empty trades", () => {
		const result = calculateEodTrailingDrawdown([], 50000, 2500);
		expect(result.currentEquity).toBe(50000);
		expect(result.peakEodEquity).toBe(50000);
		expect(result.drawdownFloor).toBe(47500);
		expect(result.currentDrawdown).toBe(0);
	});

	it("should only update peak at end of day, not intraday", () => {
		// Day 1: two trades on same day — intraday peak shouldn't affect floor
		const trades = [
			makeTrade(1000, "2025-01-06", "2025-01-06"), // intraday +1000
			makeTrade(-500, "2025-01-06", "2025-01-06"), // net EOD: +500
		];
		const result = calculateEodTrailingDrawdown(trades, 50000, 2500);
		expect(result.currentEquity).toBe(50500);
		expect(result.peakEodEquity).toBe(50500); // EOD equity, not intraday peak
		expect(result.drawdownFloor).toBe(48000); // 50500 - 2500
	});

	it("should track drawdown across multiple days", () => {
		const trades = [
			makeTrade(800, "2025-01-06", "2025-01-06"), // EOD: 50800
			makeTrade(700, "2025-01-07", "2025-01-07"), // EOD: 51500 (new peak)
			makeTrade(-1000, "2025-01-08", "2025-01-08"), // EOD: 50500
		];
		const result = calculateEodTrailingDrawdown(trades, 50000, 2500);
		expect(result.peakEodEquity).toBe(51500);
		expect(result.currentEquity).toBe(50500);
		expect(result.currentDrawdown).toBe(1000);
		expect(result.drawdownFloor).toBe(49000); // 51500 - 2500
	});

	it("should handle losing streak across days", () => {
		const trades = [
			makeTrade(-600, "2025-01-06", "2025-01-06"),
			makeTrade(-400, "2025-01-07", "2025-01-07"),
			makeTrade(-500, "2025-01-08", "2025-01-08"),
		];
		const result = calculateEodTrailingDrawdown(trades, 50000, 2500);
		expect(result.currentEquity).toBe(48500);
		expect(result.peakEodEquity).toBe(50000); // never exceeded initial
		expect(result.currentDrawdown).toBe(1500);
		expect(result.drawdownFloor).toBe(47500);
	});
});

// =============================================================================
// DAILY P&L
// =============================================================================

describe("calculateDailyPnl", () => {
	it("should return 0 for empty trades", () => {
		const result = calculateDailyPnl([], "2025-01-06");
		expect(result.dailyPnl).toBe(0);
		expect(result.dailyPnlPercent).toBe(0);
	});

	it("should sum P&L for trades on the given date", () => {
		const trades = [
			makeTrade(500, "2025-01-06"),
			makeTrade(-200, "2025-01-06"),
			makeTrade(300, "2025-01-07"), // different day
		];
		const result = calculateDailyPnl(trades, "2025-01-06");
		expect(result.dailyPnl).toBe(300); // 500 + (-200)
	});

	it("should handle trades with timezone", () => {
		// Trade at 2025-01-06T23:00:00 UTC = 2025-01-07 in UTC+1
		const trade: CalcTrade = {
			netPnl: "500",
			fees: null,
			entryTime: new Date("2025-01-06T20:00:00Z"),
			exitTime: new Date("2025-01-06T23:00:00Z"),
		};
		// In UTC, this is Jan 6
		const utcResult = calculateDailyPnl([trade], "2025-01-06");
		expect(utcResult.dailyPnl).toBe(500);

		// In Europe/Paris (UTC+1), exit is Jan 7
		const parisResult = calculateDailyPnl(
			[trade],
			"2025-01-07",
			"Europe/Paris",
		);
		expect(parisResult.dailyPnl).toBe(500);
	});

	it("should return 0 for a day with no trades", () => {
		const trades = [makeTrade(500, "2025-01-06")];
		const result = calculateDailyPnl(trades, "2025-01-07");
		expect(result.dailyPnl).toBe(0);
	});
});

// =============================================================================
// PROFIT TARGET
// =============================================================================

describe("calculateProfitTarget", () => {
	it("should return 0 progress for empty trades", () => {
		const result = calculateProfitTarget([], 3000);
		expect(result.totalPnl).toBe(0);
		expect(result.progress).toBe(0);
		expect(result.isComplete).toBe(false);
	});

	it("should calculate progress toward target", () => {
		const trades = [makeTrade(500, "2025-01-06"), makeTrade(700, "2025-01-07")];
		const result = calculateProfitTarget(trades, 3000);
		expect(result.totalPnl).toBe(1200);
		expect(result.progress).toBeCloseTo(40, 1); // 1200/3000 * 100
		expect(result.isComplete).toBe(false);
	});

	it("should mark complete when target is met", () => {
		const trades = [
			makeTrade(1500, "2025-01-06"),
			makeTrade(1500, "2025-01-07"),
		];
		const result = calculateProfitTarget(trades, 3000);
		expect(result.totalPnl).toBe(3000);
		expect(result.progress).toBe(100);
		expect(result.isComplete).toBe(true);
	});

	it("should mark complete when target is exceeded", () => {
		const trades = [
			makeTrade(2000, "2025-01-06"),
			makeTrade(1500, "2025-01-07"),
		];
		const result = calculateProfitTarget(trades, 3000);
		expect(result.totalPnl).toBe(3500);
		expect(result.isComplete).toBe(true);
	});

	it("should handle net negative P&L", () => {
		const trades = [
			makeTrade(-500, "2025-01-06"),
			makeTrade(200, "2025-01-07"),
		];
		const result = calculateProfitTarget(trades, 3000);
		expect(result.totalPnl).toBe(-300);
		expect(result.progress).toBeCloseTo(-10, 1);
		expect(result.isComplete).toBe(false);
	});
});

// =============================================================================
// CONSISTENCY RULE
// =============================================================================

describe("calculateConsistencyRule", () => {
	it("should return compliant for empty trades", () => {
		const result = calculateConsistencyRule([], 50);
		expect(result.bestDayPnl).toBe(0);
		expect(result.bestDayPercent).toBe(0);
		expect(result.isCompliant).toBe(true);
		expect(result.violatingDays).toHaveLength(0);
	});

	it("should return compliant for a single trade", () => {
		const trades = [makeTrade(500, "2025-01-06")];
		const result = calculateConsistencyRule(trades, 50);
		// Single trade = 100% of total profit on one day
		// That exceeds 50% threshold, so it violates
		expect(result.bestDayPercent).toBe(100);
		expect(result.isCompliant).toBe(false);
		expect(result.violatingDays).toContain("2025-01-06");
	});

	it("should detect violating days", () => {
		const trades = [
			makeTrade(2000, "2025-01-06"), // 66.7% of total
			makeTrade(500, "2025-01-07"), // 16.7%
			makeTrade(500, "2025-01-08"), // 16.7%
		];
		const result = calculateConsistencyRule(trades, 50);
		expect(result.bestDayPnl).toBe(2000);
		expect(result.bestDayPercent).toBeCloseTo(66.7, 0);
		expect(result.isCompliant).toBe(false);
		expect(result.violatingDays).toContain("2025-01-06");
	});

	it("should be compliant when spread evenly", () => {
		const trades = [
			makeTrade(400, "2025-01-06"), // 25%
			makeTrade(400, "2025-01-07"), // 25%
			makeTrade(400, "2025-01-08"), // 25%
			makeTrade(400, "2025-01-09"), // 25%
		];
		const result = calculateConsistencyRule(trades, 50);
		expect(result.bestDayPercent).toBe(25);
		expect(result.isCompliant).toBe(true);
		expect(result.violatingDays).toHaveLength(0);
	});

	it("should handle all losses (total profit 0)", () => {
		const trades = [
			makeTrade(-200, "2025-01-06"),
			makeTrade(-300, "2025-01-07"),
		];
		const result = calculateConsistencyRule(trades, 50);
		// totalProfit is negative, so no day can violate
		expect(result.bestDayPnl).toBe(0); // no positive day
		expect(result.isCompliant).toBe(true);
	});
});

// =============================================================================
// MIN TRADING DAYS
// =============================================================================

describe("calculateMinTradingDays", () => {
	it("should return 0 for empty trades", () => {
		expect(calculateMinTradingDays([])).toBe(0);
	});

	it("should count unique trading days from entry times", () => {
		const trades = [
			makeTrade(100, "2025-01-06"),
			makeTrade(200, "2025-01-06"), // same day
			makeTrade(300, "2025-01-07"),
			makeTrade(400, "2025-01-08"),
		];
		expect(calculateMinTradingDays(trades)).toBe(3);
	});

	it("should count single trade as 1 day", () => {
		const trades = [makeTrade(100, "2025-01-06")];
		expect(calculateMinTradingDays(trades)).toBe(1);
	});
});

// =============================================================================
// MAX POSITION (concurrent contracts)
// =============================================================================

describe("calculateMaxPosition", () => {
	it("should return 0 for empty trades", () => {
		const result = calculateMaxPosition([]);
		expect(result.maxConcurrentContracts).toBe(0);
	});

	it("should return 1 for non-overlapping trades", () => {
		const trades = [
			makeTimedTrade(100, "2025-01-06T09:00:00Z", "2025-01-06T10:00:00Z"),
			makeTimedTrade(200, "2025-01-06T11:00:00Z", "2025-01-06T12:00:00Z"),
		];
		const result = calculateMaxPosition(trades);
		expect(result.maxConcurrentContracts).toBe(1);
	});

	it("should detect overlapping trades (3 concurrent)", () => {
		const trades = [
			makeTimedTrade(100, "2025-01-06T09:00:00Z", "2025-01-06T12:00:00Z"),
			makeTimedTrade(200, "2025-01-06T10:00:00Z", "2025-01-06T13:00:00Z"),
			makeTimedTrade(300, "2025-01-06T11:00:00Z", "2025-01-06T14:00:00Z"),
		];
		const result = calculateMaxPosition(trades);
		expect(result.maxConcurrentContracts).toBe(3);
	});

	it("should handle trades with custom quantities", () => {
		const trades = [
			makeTimedTrade(100, "2025-01-06T09:00:00Z", "2025-01-06T12:00:00Z", 3),
			makeTimedTrade(200, "2025-01-06T10:00:00Z", "2025-01-06T13:00:00Z", 2),
		];
		const result = calculateMaxPosition(trades);
		expect(result.maxConcurrentContracts).toBe(5); // 3 + 2 overlap
	});

	it("should handle trade with no exit time (open position)", () => {
		const trades: CalcTrade[] = [
			{
				netPnl: "100",
				fees: null,
				entryTime: new Date("2025-01-06T09:00:00Z"),
				exitTime: null, // still open
				quantity: "2",
			},
			makeTimedTrade(200, "2025-01-06T10:00:00Z", "2025-01-06T12:00:00Z", 1),
		];
		const result = calculateMaxPosition(trades);
		// Open trade never closes, so at 10:00 we have 2 + 1 = 3
		expect(result.maxConcurrentContracts).toBe(3);
	});

	it("should default to 1 contract when quantity is null", () => {
		const trades = [
			makeTimedTrade(100, "2025-01-06T09:00:00Z", "2025-01-06T12:00:00Z"),
			makeTimedTrade(200, "2025-01-06T10:00:00Z", "2025-01-06T13:00:00Z"),
		];
		const result = calculateMaxPosition(trades);
		expect(result.maxConcurrentContracts).toBe(2); // 1 + 1
	});
});

// =============================================================================
// DAYS REMAINING
// =============================================================================

describe("calculateDaysRemaining", () => {
	it("should calculate days for a 30-day challenge", () => {
		const now = new Date();
		const start = new Date(now.getTime() - 10 * 86400000); // started 10 days ago
		const end = new Date(start.getTime() + 30 * 86400000); // 30-day challenge
		const result = calculateDaysRemaining(start, end);
		expect(result.daysTotal).toBe(30);
		expect(result.daysElapsed).toBeGreaterThanOrEqual(10);
		expect(result.daysRemaining).toBeLessThanOrEqual(20);
		expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
	});

	it("should return 0 remaining when past end date", () => {
		const start = new Date("2024-01-01");
		const end = new Date("2024-01-31");
		const result = calculateDaysRemaining(start, end);
		expect(result.daysRemaining).toBe(0);
		expect(result.urgency).toBe("danger");
	});

	it("should return danger urgency when 3 or fewer days remain", () => {
		const now = new Date();
		const start = new Date(now.getTime() - 27 * 86400000);
		const end = new Date(now.getTime() + 2 * 86400000); // 2 days remaining
		const result = calculateDaysRemaining(start, end);
		expect(result.urgency).toBe("danger");
	});

	it("should return warning urgency when 7 or fewer days remain", () => {
		const now = new Date();
		const start = new Date(now.getTime() - 23 * 86400000);
		const end = new Date(now.getTime() + 6 * 86400000); // 6 days remaining
		const result = calculateDaysRemaining(start, end);
		// 6 days remaining, <= 7 days → warning
		expect(result.urgency).toBe("warning");
	});

	it("should return safe urgency for fresh challenge", () => {
		const now = new Date();
		const start = new Date(now.getTime() - 1 * 86400000);
		const end = new Date(now.getTime() + 28 * 86400000); // plenty of time
		const result = calculateDaysRemaining(start, end);
		expect(result.urgency).toBe("safe");
	});
});

// =============================================================================
// STATUS AGGREGATOR — End-to-end with Topstep $50K
// =============================================================================

describe("calculatePropFirmStatus", () => {
	it("should return locked status for passed challenge", () => {
		const account: StatusAccount = {
			initialBalance: "50000",
			maxDrawdown: "2000",
			drawdownType: "trailing",
			dailyLossLimit: "1000",
			profitTarget: "3000",
			consistencyRule: "50",
			minTradingDays: 5,
			maxPositionSize: 5,
			challengeStartDate: null,
			challengeEndDate: null,
			challengeStatus: "passed",
		};
		const result = calculatePropFirmStatus(account, []);
		expect(result.isLocked).toBe(true);
		expect(result.lockedReason).toBe("Challenge Passed");
		expect(result.rules).toHaveLength(0);
	});

	it("should return locked status for failed challenge", () => {
		const account: StatusAccount = {
			initialBalance: "50000",
			maxDrawdown: "2000",
			drawdownType: "trailing",
			dailyLossLimit: "1000",
			profitTarget: "3000",
			consistencyRule: "50",
			minTradingDays: 5,
			maxPositionSize: 5,
			challengeStartDate: null,
			challengeEndDate: null,
			challengeStatus: "failed",
		};
		const result = calculatePropFirmStatus(account, []);
		expect(result.isLocked).toBe(true);
		expect(result.lockedReason).toBe("Challenge Failed");
		expect(result.rules).toHaveLength(0);
	});

	it("should return all applicable rules for Topstep $50K", () => {
		const account: StatusAccount = {
			initialBalance: "50000",
			maxDrawdown: "2000",
			drawdownType: "trailing",
			dailyLossLimit: "1000",
			profitTarget: "3000",
			consistencyRule: "50",
			minTradingDays: 5,
			maxPositionSize: 5,
			challengeStartDate: new Date("2025-01-01"),
			challengeEndDate: new Date("2025-03-01"),
			challengeStatus: "active",
		};

		const trades = [
			makeTrade(500, "2025-01-06"),
			makeTrade(300, "2025-01-07"),
			makeTrade(-200, "2025-01-08"),
			makeTrade(400, "2025-01-09"),
			makeTrade(100, "2025-01-10"),
		];

		const result = calculatePropFirmStatus(account, trades);
		expect(result.isLocked).toBe(false);

		// Should have: max_drawdown, daily_loss, profit_target, consistency, min_trading_days, max_position_size, days_remaining
		const ruleTypes = result.rules.map((r) => r.type);
		expect(ruleTypes).toContain("max_drawdown");
		expect(ruleTypes).toContain("daily_loss");
		expect(ruleTypes).toContain("profit_target");
		expect(ruleTypes).toContain("consistency");
		expect(ruleTypes).toContain("min_trading_days");
		expect(ruleTypes).toContain("max_position_size");
		expect(ruleTypes).toContain("days_remaining");
	});

	it("should skip inapplicable rules (Apex has no daily loss or consistency)", () => {
		const account: StatusAccount = {
			initialBalance: "50000",
			maxDrawdown: "2500",
			drawdownType: "eod",
			dailyLossLimit: null,
			profitTarget: "3000",
			consistencyRule: null,
			minTradingDays: null,
			maxPositionSize: 4,
			challengeStartDate: null,
			challengeEndDate: null,
			challengeStatus: "active",
		};

		const trades = [makeTrade(500, "2025-01-06")];
		const result = calculatePropFirmStatus(account, trades);

		const ruleTypes = result.rules.map((r) => r.type);
		expect(ruleTypes).toContain("max_drawdown");
		expect(ruleTypes).toContain("profit_target");
		expect(ruleTypes).toContain("max_position_size");
		expect(ruleTypes).not.toContain("daily_loss");
		expect(ruleTypes).not.toContain("consistency");
		expect(ruleTypes).not.toContain("min_trading_days");
		expect(ruleTypes).not.toContain("days_remaining");
	});

	it("should calculate correct drawdown status for trailing DD", () => {
		const account: StatusAccount = {
			initialBalance: "50000",
			maxDrawdown: "2000",
			drawdownType: "trailing",
			dailyLossLimit: null,
			profitTarget: null,
			consistencyRule: null,
			minTradingDays: null,
			maxPositionSize: null,
			challengeStartDate: null,
			challengeEndDate: null,
			challengeStatus: "active",
		};

		// Go up 1000, then down 1800 from peak
		const trades = [
			makeTrade(1000, "2025-01-06"),
			makeTrade(-1800, "2025-01-07"),
		];
		const result = calculatePropFirmStatus(account, trades);

		const ddRule = result.rules.find((r) => r.type === "max_drawdown");
		expect(ddRule).toBeDefined();
		// Peak = 51000, current = 49200, drawdown = 1800
		expect(ddRule?.currentValue).toBe(1800);
		expect(ddRule?.limit).toBe(2000);
		expect(ddRule?.percentage).toBe(90); // 1800/2000 * 100
		expect(ddRule?.status).toBe("danger"); // 90% = danger
	});

	it("should handle empty trades for an active account", () => {
		const account: StatusAccount = {
			initialBalance: "50000",
			maxDrawdown: "2000",
			drawdownType: "trailing",
			dailyLossLimit: "1000",
			profitTarget: "3000",
			consistencyRule: "50",
			minTradingDays: 5,
			maxPositionSize: 5,
			challengeStartDate: null,
			challengeEndDate: null,
			challengeStatus: "active",
		};

		const result = calculatePropFirmStatus(account, []);
		expect(result.isLocked).toBe(false);

		// Drawdown should be 0
		const ddRule = result.rules.find((r) => r.type === "max_drawdown");
		expect(ddRule?.currentValue).toBe(0);
		expect(ddRule?.status).toBe("safe");

		// Profit target should show 0 progress
		const ptRule = result.rules.find((r) => r.type === "profit_target");
		expect(ptRule?.currentValue).toBe(0);
		expect(ptRule?.percentage).toBe(0);

		// Min trading days should be 0
		const mtdRule = result.rules.find((r) => r.type === "min_trading_days");
		expect(mtdRule?.currentValue).toBe(0);
	});

	it("should show safe status for position size within limit", () => {
		const account: StatusAccount = {
			initialBalance: "50000",
			maxDrawdown: null,
			drawdownType: null,
			dailyLossLimit: null,
			profitTarget: null,
			consistencyRule: null,
			minTradingDays: null,
			maxPositionSize: 5,
			challengeStartDate: null,
			challengeEndDate: null,
			challengeStatus: "active",
		};

		const trades = [
			makeTimedTrade(100, "2025-01-06T09:00:00Z", "2025-01-06T12:00:00Z", 2),
			makeTimedTrade(200, "2025-01-06T10:00:00Z", "2025-01-06T13:00:00Z", 1),
		];
		const result = calculatePropFirmStatus(account, trades);

		const posRule = result.rules.find((r) => r.type === "max_position_size");
		expect(posRule?.currentValue).toBe(3); // 2 + 1
		expect(posRule?.limit).toBe(5);
		expect(posRule?.percentage).toBe(60); // 3/5 * 100
		expect(posRule?.status).toBe("safe");
	});
});
