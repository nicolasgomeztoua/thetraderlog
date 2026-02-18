/**
 * Unit Tests for Prop Compliance Calculations
 *
 * Tests all pure functions in src/lib/analytics/prop-compliance.ts.
 * No database required — these are pure calculation tests.
 */

import { describe, expect, it } from "vitest";
import {
	calculateConsistencyMetric,
	calculateDailyLossStatus,
	calculateDailyPnl,
	calculateDrawdownStatus,
	calculateProfitTargetProgress,
	calculateStaticDrawdown,
	calculateTradingDays,
	calculateTrailingDrawdown,
	getOverallComplianceStatus,
} from "@/lib/analytics/prop-compliance";
import type { EquityPoint } from "@/lib/analytics/risk";

// =============================================================================
// HELPERS
// =============================================================================

/** Create a minimal EquityPoint for trailing drawdown tests */
function makeEquityPoint(
	equity: number,
	overrides?: Partial<EquityPoint>,
): EquityPoint {
	return {
		date: new Date("2025-01-15"),
		equity,
		peak: overrides?.peak ?? equity,
		drawdown: overrides?.drawdown ?? 0,
		drawdownPercent: overrides?.drawdownPercent ?? 0,
		pnl: overrides?.pnl ?? 0,
		tradeIndex: overrides?.tradeIndex ?? 0,
	};
}

// =============================================================================
// calculateDrawdownStatus
// =============================================================================

describe("calculateDrawdownStatus", () => {
	it("returns safe status when drawdown is well below limit", () => {
		// 2% current vs 10% limit → 80% remaining → safe (>30%)
		const result = calculateDrawdownStatus(2, 10);
		expect(result.percent).toBe(2);
		expect(result.limit).toBe(10);
		expect(result.used).toBeCloseTo(0.2);
		expect(result.remaining).toBeCloseTo(0.8);
		expect(result.status).toBe("safe");
	});

	it("returns caution status when drawdown is moderately close to limit", () => {
		// 7.5% current vs 10% limit → 25% remaining → caution (10-30%)
		const result = calculateDrawdownStatus(7.5, 10);
		expect(result.used).toBeCloseTo(0.75);
		expect(result.remaining).toBeCloseTo(0.25);
		expect(result.status).toBe("caution");
	});

	it("returns danger status when drawdown is very close to limit", () => {
		// 9.5% current vs 10% limit → 5% remaining → danger (<10%)
		const result = calculateDrawdownStatus(9.5, 10);
		expect(result.used).toBeCloseTo(0.95);
		expect(result.remaining).toBeCloseTo(0.05);
		expect(result.status).toBe("danger");
	});

	it("caps used at 1 when drawdown exceeds limit", () => {
		const result = calculateDrawdownStatus(12, 10);
		expect(result.used).toBe(1);
		expect(result.remaining).toBe(0);
		expect(result.status).toBe("danger");
	});

	it("returns danger when maxDrawdownPercent is 0", () => {
		const result = calculateDrawdownStatus(5, 0);
		expect(result.used).toBe(1);
		expect(result.remaining).toBe(0);
		expect(result.status).toBe("danger");
	});

	it("returns safe when drawdown is 0", () => {
		const result = calculateDrawdownStatus(0, 6);
		expect(result.used).toBe(0);
		expect(result.remaining).toBe(1);
		expect(result.status).toBe("safe");
	});

	it("handles trailing drawdown scenario (6% limit, 4% drawdown)", () => {
		// 4% of 6% → 66% used, 33% remaining → safe (>30%)
		const result = calculateDrawdownStatus(4, 6);
		expect(result.used).toBeCloseTo(4 / 6);
		expect(result.remaining).toBeCloseTo(1 - 4 / 6);
		expect(result.status).toBe("safe");
	});

	it("handles EOD scenario just below safe threshold", () => {
		// 7.1% of 10% → 71% used, 29% remaining → caution (<30%)
		const result = calculateDrawdownStatus(7.1, 10);
		expect(result.remaining).toBeCloseTo(0.29);
		expect(result.status).toBe("caution");
	});
});

// =============================================================================
// calculateDailyPnl
// =============================================================================

describe("calculateDailyPnl", () => {
	const targetDate = new Date("2025-01-15T12:00:00Z");

	it("sums P&L for trades on the same date", () => {
		const trades = [
			{ netPnl: "150.50", exitTime: new Date("2025-01-15T10:00:00Z") },
			{ netPnl: "-75.25", exitTime: new Date("2025-01-15T14:00:00Z") },
			{ netPnl: "200.00", exitTime: new Date("2025-01-15T16:00:00Z") },
		];
		const result = calculateDailyPnl(trades, targetDate);
		expect(result).toBeCloseTo(275.25);
	});

	it("excludes trades from different dates", () => {
		const trades = [
			{ netPnl: "100.00", exitTime: new Date("2025-01-15T10:00:00Z") },
			{ netPnl: "200.00", exitTime: new Date("2025-01-14T10:00:00Z") },
			{ netPnl: "300.00", exitTime: new Date("2025-01-16T10:00:00Z") },
		];
		const result = calculateDailyPnl(trades, targetDate);
		expect(result).toBeCloseTo(100);
	});

	it("returns 0 when no trades on the target date", () => {
		const trades = [
			{ netPnl: "100.00", exitTime: new Date("2025-01-14T10:00:00Z") },
		];
		const result = calculateDailyPnl(trades, targetDate);
		expect(result).toBe(0);
	});

	it("returns 0 for empty trades array", () => {
		const result = calculateDailyPnl([], targetDate);
		expect(result).toBe(0);
	});

	it("skips trades with null exitTime", () => {
		const trades = [
			{ netPnl: "100.00", exitTime: null },
			{ netPnl: "50.00", exitTime: new Date("2025-01-15T10:00:00Z") },
		];
		const result = calculateDailyPnl(trades, targetDate);
		expect(result).toBeCloseTo(50);
	});

	it("treats null netPnl as 0", () => {
		const trades = [
			{ netPnl: null, exitTime: new Date("2025-01-15T10:00:00Z") },
			{ netPnl: "100.00", exitTime: new Date("2025-01-15T12:00:00Z") },
		];
		const result = calculateDailyPnl(trades, targetDate);
		expect(result).toBeCloseTo(100);
	});

	it("handles negative P&L values correctly", () => {
		const trades = [
			{ netPnl: "-500.00", exitTime: new Date("2025-01-15T10:00:00Z") },
			{ netPnl: "-250.00", exitTime: new Date("2025-01-15T14:00:00Z") },
		];
		const result = calculateDailyPnl(trades, targetDate);
		expect(result).toBeCloseTo(-750);
	});
});

// =============================================================================
// calculateDailyLossStatus
// =============================================================================

describe("calculateDailyLossStatus", () => {
	const initialBalance = 100000;

	it("returns safe when no losses (positive P&L)", () => {
		// 3% daily loss limit on $100k = $3000 limit
		const result = calculateDailyLossStatus(500, 3, initialBalance);
		expect(result.current).toBe(500);
		expect(result.limit).toBe(3000);
		expect(result.used).toBe(0);
		expect(result.remaining).toBe(1);
		expect(result.status).toBe("safe");
	});

	it("returns safe when small loss well within limit", () => {
		// -$500 loss vs $3000 limit → 16.7% used, 83.3% remaining → safe
		const result = calculateDailyLossStatus(-500, 3, initialBalance);
		expect(result.used).toBeCloseTo(500 / 3000);
		expect(result.remaining).toBeCloseTo(1 - 500 / 3000);
		expect(result.status).toBe("safe");
	});

	it("returns caution when loss is moderately close to limit", () => {
		// -$2250 loss vs $3000 limit → 75% used, 25% remaining → caution
		const result = calculateDailyLossStatus(-2250, 3, initialBalance);
		expect(result.used).toBeCloseTo(0.75);
		expect(result.remaining).toBeCloseTo(0.25);
		expect(result.status).toBe("caution");
	});

	it("returns danger when loss is very close to limit", () => {
		// -$2800 loss vs $3000 limit → 93.3% used, 6.7% remaining → danger
		const result = calculateDailyLossStatus(-2800, 3, initialBalance);
		expect(result.used).toBeCloseTo(2800 / 3000);
		expect(result.remaining).toBeCloseTo(1 - 2800 / 3000);
		expect(result.status).toBe("danger");
	});

	it("caps used at 1 when loss exceeds limit", () => {
		const result = calculateDailyLossStatus(-5000, 3, initialBalance);
		expect(result.used).toBe(1);
		expect(result.remaining).toBe(0);
		expect(result.status).toBe("danger");
	});

	it("returns danger when dailyLossLimitPercent is 0", () => {
		const result = calculateDailyLossStatus(-100, 0, initialBalance);
		expect(result.limit).toBe(0);
		expect(result.used).toBe(1);
		expect(result.status).toBe("danger");
	});

	it("correctly converts percentage to dollar limit", () => {
		// 5% of $50,000 = $2,500
		const result = calculateDailyLossStatus(0, 5, 50000);
		expect(result.limit).toBe(2500);
	});
});

// =============================================================================
// calculateProfitTargetProgress
// =============================================================================

describe("calculateProfitTargetProgress", () => {
	const initialBalance = 100000;

	it("returns danger at 0% progress (no profit)", () => {
		// 8% target on $100k = $8000 target, $0 profit → 0% progress → danger
		const result = calculateProfitTargetProgress(0, 8, initialBalance);
		expect(result.current).toBe(0);
		expect(result.target).toBe(8000);
		expect(result.progress).toBe(0);
		expect(result.status).toBe("danger");
	});

	it("returns danger at low progress (<50%)", () => {
		// $2000 of $8000 → 25% → danger
		const result = calculateProfitTargetProgress(2000, 8, initialBalance);
		expect(result.progress).toBeCloseTo(0.25);
		expect(result.status).toBe("danger");
	});

	it("returns caution at 50% progress", () => {
		// $4000 of $8000 → 50% → caution
		const result = calculateProfitTargetProgress(4000, 8, initialBalance);
		expect(result.progress).toBeCloseTo(0.5);
		expect(result.status).toBe("caution");
	});

	it("returns caution at 75% progress", () => {
		// $6000 of $8000 → 75% → caution
		const result = calculateProfitTargetProgress(6000, 8, initialBalance);
		expect(result.progress).toBeCloseTo(0.75);
		expect(result.status).toBe("caution");
	});

	it("returns safe at 100% progress (target reached)", () => {
		// $8000 of $8000 → 100% → safe
		const result = calculateProfitTargetProgress(8000, 8, initialBalance);
		expect(result.progress).toBeCloseTo(1);
		expect(result.status).toBe("safe");
	});

	it("allows progress to exceed 100%", () => {
		// $12000 of $8000 → 150% → safe
		const result = calculateProfitTargetProgress(12000, 8, initialBalance);
		expect(result.progress).toBeCloseTo(1.5);
		expect(result.status).toBe("safe");
	});

	it("clamps negative P&L progress to 0", () => {
		// -$2000 loss should not produce negative progress
		const result = calculateProfitTargetProgress(-2000, 8, initialBalance);
		expect(result.progress).toBe(0);
		expect(result.status).toBe("danger");
	});

	it("handles profitTargetPercent of 0", () => {
		const result = calculateProfitTargetProgress(500, 0, initialBalance);
		expect(result.target).toBe(0);
		expect(result.progress).toBe(1); // positive P&L with 0 target = achieved
		expect(result.status).toBe("safe");
	});

	it("correctly converts percentage to dollar target", () => {
		// 10% of $50,000 = $5,000
		const result = calculateProfitTargetProgress(0, 10, 50000);
		expect(result.target).toBe(5000);
	});
});

// =============================================================================
// calculateConsistencyMetric
// =============================================================================

describe("calculateConsistencyMetric", () => {
	it("returns compliant when no day exceeds the consistency rule", () => {
		// 30% rule, daily PnLs evenly spread
		const dailyPnls = [100, 120, 110, 90, 80];
		const result = calculateConsistencyMetric(dailyPnls, 30);
		// Total profit = 500, max single day = 120 → 24% → compliant
		expect(result.maxDayPercent).toBeCloseTo(24);
		expect(result.limit).toBe(30);
		expect(result.isCompliant).toBe(true);
	});

	it("returns non-compliant when one day exceeds the consistency rule", () => {
		// 30% rule, one dominant day
		const dailyPnls = [500, 50, 60, 40, 50];
		const result = calculateConsistencyMetric(dailyPnls, 30);
		// Total profit = 700, max single day = 500 → 71.4% → non-compliant
		expect(result.maxDayPercent).toBeCloseTo((500 / 700) * 100);
		expect(result.isCompliant).toBe(false);
	});

	it("ignores negative P&L days for consistency calculation", () => {
		// Only positive days count for total profit and max day
		const dailyPnls = [200, -100, 150, -50, 100];
		const result = calculateConsistencyMetric(dailyPnls, 30);
		// Total profit (positive only) = 450, max = 200 → 44.4% → non-compliant with 30% rule
		expect(result.maxDayPercent).toBeCloseTo((200 / 450) * 100);
		expect(result.isCompliant).toBe(false);
	});

	it("returns compliant for empty array", () => {
		const result = calculateConsistencyMetric([], 30);
		expect(result.maxDayPercent).toBe(0);
		expect(result.isCompliant).toBe(true);
	});

	it("returns compliant when all days are losses", () => {
		const dailyPnls = [-100, -200, -50];
		const result = calculateConsistencyMetric(dailyPnls, 30);
		expect(result.maxDayPercent).toBe(0);
		expect(result.isCompliant).toBe(true);
	});

	it("returns compliant when consistencyRulePercent is 0", () => {
		const result = calculateConsistencyMetric([100, 200], 0);
		expect(result.isCompliant).toBe(true);
	});

	it("handles single profitable day (always 100%)", () => {
		const dailyPnls = [500];
		const result = calculateConsistencyMetric(dailyPnls, 30);
		// 500 is 100% of total profit → non-compliant with 30% rule
		expect(result.maxDayPercent).toBeCloseTo(100);
		expect(result.isCompliant).toBe(false);
	});

	it("handles exactly at the limit (boundary case)", () => {
		// 30% rule, max day is exactly 30%
		const dailyPnls = [30, 35, 35];
		const result = calculateConsistencyMetric(dailyPnls, 35);
		// Total = 100, max = 35 → exactly 35% → compliant (<=)
		expect(result.maxDayPercent).toBeCloseTo(35);
		expect(result.isCompliant).toBe(true);
	});
});

// =============================================================================
// calculateTradingDays
// =============================================================================

describe("calculateTradingDays", () => {
	it("counts distinct trading dates", () => {
		const trades = [
			{ exitTime: new Date("2025-01-15T10:00:00Z") },
			{ exitTime: new Date("2025-01-15T14:00:00Z") }, // same day
			{ exitTime: new Date("2025-01-16T10:00:00Z") },
			{ exitTime: new Date("2025-01-17T10:00:00Z") },
		];
		const result = calculateTradingDays(trades, 10);
		expect(result.daysTraded).toBe(3);
		expect(result.minRequired).toBe(10);
		expect(result.remaining).toBe(7);
	});

	it("returns 0 days for empty trades", () => {
		const result = calculateTradingDays([], 5);
		expect(result.daysTraded).toBe(0);
		expect(result.remaining).toBe(5);
	});

	it("skips trades with null exitTime", () => {
		const trades = [
			{ exitTime: new Date("2025-01-15T10:00:00Z") },
			{ exitTime: null },
			{ exitTime: new Date("2025-01-16T10:00:00Z") },
		];
		const result = calculateTradingDays(trades, 5);
		expect(result.daysTraded).toBe(2);
		expect(result.remaining).toBe(3);
	});

	it("returns 0 remaining when requirement is met", () => {
		const trades = [
			{ exitTime: new Date("2025-01-15T10:00:00Z") },
			{ exitTime: new Date("2025-01-16T10:00:00Z") },
			{ exitTime: new Date("2025-01-17T10:00:00Z") },
		];
		const result = calculateTradingDays(trades, 3);
		expect(result.daysTraded).toBe(3);
		expect(result.remaining).toBe(0);
	});

	it("returns 0 remaining when days exceed requirement", () => {
		const trades = [
			{ exitTime: new Date("2025-01-15T10:00:00Z") },
			{ exitTime: new Date("2025-01-16T10:00:00Z") },
			{ exitTime: new Date("2025-01-17T10:00:00Z") },
			{ exitTime: new Date("2025-01-18T10:00:00Z") },
			{ exitTime: new Date("2025-01-19T10:00:00Z") },
		];
		const result = calculateTradingDays(trades, 3);
		expect(result.daysTraded).toBe(5);
		expect(result.remaining).toBe(0);
	});

	it("deduplicates multiple trades on the same day", () => {
		const trades = [
			{ exitTime: new Date("2025-01-15T09:00:00Z") },
			{ exitTime: new Date("2025-01-15T10:00:00Z") },
			{ exitTime: new Date("2025-01-15T11:00:00Z") },
			{ exitTime: new Date("2025-01-15T12:00:00Z") },
		];
		const result = calculateTradingDays(trades, 5);
		expect(result.daysTraded).toBe(1);
		expect(result.remaining).toBe(4);
	});
});

// =============================================================================
// calculateTrailingDrawdown
// =============================================================================

describe("calculateTrailingDrawdown", () => {
	it("calculates trailing drawdown from equity curve with peak tracking", () => {
		const initialBalance = 100000;
		// Equity curve: cumulative P&L from $0
		// Trade 1: +$500 → balance $100500, peak $100500
		// Trade 2: -$1200 → balance $99300, peak $100500, dd = $1200
		// Trade 3: +$800 → balance $100100, peak $100500, dd = $400
		const equityCurve: EquityPoint[] = [
			makeEquityPoint(500, { tradeIndex: 0 }),
			makeEquityPoint(-700, { tradeIndex: 1 }), // cumulative: -700
			makeEquityPoint(100, { tradeIndex: 2 }), // cumulative: 100
		];

		const result = calculateTrailingDrawdown(equityCurve, initialBalance);
		// Peak equity = 100500 (after trade 1 with +500)
		// Worst point = 99300 (after trade 2 with cumulative -700)
		// Max drawdown = 100500 - 99300 = 1200
		expect(result.maxDrawdown).toBeCloseTo(1200);
		expect(result.maxDrawdownPercent).toBeCloseTo(1.2);
		// Current: balance = 100100, peak = 100500, dd = 400
		expect(result.currentDrawdown).toBeCloseTo(400);
		expect(result.currentDrawdownPercent).toBeCloseTo(0.4);
	});

	it("returns 0 for empty equity curve", () => {
		const result = calculateTrailingDrawdown([], 100000);
		expect(result.maxDrawdown).toBe(0);
		expect(result.maxDrawdownPercent).toBe(0);
		expect(result.currentDrawdown).toBe(0);
		expect(result.currentDrawdownPercent).toBe(0);
	});

	it("returns 0 when balance is 0", () => {
		const equityCurve = [makeEquityPoint(100)];
		const result = calculateTrailingDrawdown(equityCurve, 0);
		expect(result.maxDrawdown).toBe(0);
	});

	it("handles monotonically increasing equity (no drawdown)", () => {
		const initialBalance = 50000;
		const equityCurve: EquityPoint[] = [
			makeEquityPoint(100, { tradeIndex: 0 }),
			makeEquityPoint(300, { tradeIndex: 1 }),
			makeEquityPoint(600, { tradeIndex: 2 }),
			makeEquityPoint(1000, { tradeIndex: 3 }),
		];

		const result = calculateTrailingDrawdown(equityCurve, initialBalance);
		expect(result.maxDrawdown).toBe(0);
		expect(result.currentDrawdown).toBe(0);
	});

	it("handles monotonically decreasing equity", () => {
		const initialBalance = 100000;
		const equityCurve: EquityPoint[] = [
			makeEquityPoint(-500, { tradeIndex: 0 }),
			makeEquityPoint(-1500, { tradeIndex: 1 }),
			makeEquityPoint(-3000, { tradeIndex: 2 }),
		];

		const result = calculateTrailingDrawdown(equityCurve, initialBalance);
		// Peak stays at initialBalance (100000), lowest = 97000
		expect(result.maxDrawdown).toBeCloseTo(3000);
		expect(result.maxDrawdownPercent).toBeCloseTo(3);
		expect(result.currentDrawdown).toBeCloseTo(3000);
		expect(result.currentDrawdownPercent).toBeCloseTo(3);
	});

	it("tracks new peaks correctly after recovery", () => {
		const initialBalance = 100000;
		// +1000, -500, +2000 (new peak), -3000
		const equityCurve: EquityPoint[] = [
			makeEquityPoint(1000, { tradeIndex: 0 }), // balance: 101000, peak: 101000
			makeEquityPoint(500, { tradeIndex: 1 }), // balance: 100500, peak: 101000, dd: 500
			makeEquityPoint(2500, { tradeIndex: 2 }), // balance: 102500, peak: 102500 (new peak)
			makeEquityPoint(-500, { tradeIndex: 3 }), // balance: 99500, peak: 102500, dd: 3000
		];

		const result = calculateTrailingDrawdown(equityCurve, initialBalance);
		// Max drawdown is from peak 102500 to 99500 = 3000
		expect(result.maxDrawdown).toBeCloseTo(3000);
		expect(result.maxDrawdownPercent).toBeCloseTo(3);
		expect(result.currentDrawdown).toBeCloseTo(3000);
	});
});

// =============================================================================
// calculateStaticDrawdown
// =============================================================================

describe("calculateStaticDrawdown", () => {
	it("calculates drawdown when balance is below initial", () => {
		const result = calculateStaticDrawdown(100000, 95000);
		expect(result.drawdown).toBe(5000);
		expect(result.drawdownPercent).toBeCloseTo(5);
	});

	it("returns 0 drawdown when balance equals initial", () => {
		const result = calculateStaticDrawdown(100000, 100000);
		expect(result.drawdown).toBe(0);
		expect(result.drawdownPercent).toBe(0);
	});

	it("returns 0 drawdown when balance exceeds initial (no negative drawdown)", () => {
		const result = calculateStaticDrawdown(100000, 110000);
		expect(result.drawdown).toBe(0);
		expect(result.drawdownPercent).toBe(0);
	});

	it("returns 0 when initialBalance is 0", () => {
		const result = calculateStaticDrawdown(0, 50000);
		expect(result.drawdown).toBe(0);
		expect(result.drawdownPercent).toBe(0);
	});

	it("handles total loss (balance = 0)", () => {
		const result = calculateStaticDrawdown(100000, 0);
		expect(result.drawdown).toBe(100000);
		expect(result.drawdownPercent).toBeCloseTo(100);
	});
});

// =============================================================================
// getOverallComplianceStatus
// =============================================================================

describe("getOverallComplianceStatus", () => {
	it("returns safe for empty array", () => {
		expect(getOverallComplianceStatus([])).toBe("safe");
	});

	it("returns safe when all statuses are safe", () => {
		expect(getOverallComplianceStatus(["safe", "safe", "safe"])).toBe("safe");
	});

	it("returns caution when worst status is caution", () => {
		expect(getOverallComplianceStatus(["safe", "caution", "safe"])).toBe(
			"caution",
		);
	});

	it("returns danger when any status is danger", () => {
		expect(getOverallComplianceStatus(["safe", "caution", "danger"])).toBe(
			"danger",
		);
	});

	it("returns danger even if only one status is danger", () => {
		expect(getOverallComplianceStatus(["safe", "safe", "danger"])).toBe(
			"danger",
		);
	});

	it("handles single status", () => {
		expect(getOverallComplianceStatus(["caution"])).toBe("caution");
	});
});
