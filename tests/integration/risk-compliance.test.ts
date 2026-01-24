/**
 * Integration tests for Risk Compliance Calculator utility.
 *
 * These tests verify that the risk compliance calculations work correctly
 * for different risk parameters, trade scenarios, and edge cases.
 */

import { describe, expect, it } from "vitest";
import {
	calculateAchievedR,
	calculateDollarRisk,
	calculatePlannedRR,
	calculateRiskCompliance,
	checkConcurrentPositions,
	checkDailyLossCompliance,
	checkMaxRiskPerTrade,
	checkMinRRRatio,
	checkTargetRMultiples,
	type RiskParameters,
	type TradeForCompliance,
} from "@/lib/strategies/risk-compliance";

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a mock trade for compliance testing
 */
function createTrade(
	overrides: Partial<TradeForCompliance> = {},
): TradeForCompliance {
	return {
		id: "trade-1",
		symbol: "ES",
		instrumentType: "futures",
		direction: "long",
		entryPrice: 5000,
		exitPrice: 5020,
		stopLoss: 4990,
		takeProfit: 5030,
		quantity: 1,
		realizedPnl: 1000,
		entryTime: new Date("2025-01-15T10:00:00Z"),
		exitTime: new Date("2025-01-15T11:00:00Z"),
		...overrides,
	};
}

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe("calculateDollarRisk", () => {
	it("should calculate risk for ES futures using FUTURES_SPECS", () => {
		// ES: $50/point, 10 points risk, 1 contract
		// Risk = 10 × $50 × 1 = $500
		const trade = createTrade({
			symbol: "ES",
			instrumentType: "futures",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBe(500);
	});

	it("should calculate risk for NQ futures", () => {
		// NQ: $20/point, 50 points risk, 2 contracts
		// Risk = 50 × $20 × 2 = $2000
		const trade = createTrade({
			symbol: "NQ",
			instrumentType: "futures",
			entryPrice: 18000,
			stopLoss: 17950,
			quantity: 2,
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBe(2000);
	});

	it("should calculate risk for MES micro futures", () => {
		// MES: $5/point, 10 points risk, 5 contracts
		// Risk = 10 × $5 × 5 = $250
		const trade = createTrade({
			symbol: "MES",
			instrumentType: "futures",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 5,
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBe(250);
	});

	it("should return null when stop loss is missing", () => {
		const trade = createTrade({
			stopLoss: null,
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBeNull();
	});

	it("should return null for unknown futures symbol", () => {
		const trade = createTrade({
			symbol: "UNKNOWN",
			instrumentType: "futures",
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBeNull();
	});

	it("should calculate risk for forex pairs", () => {
		// EUR/USD: pipSize = 0.0001, pipValuePerLot = $10
		// Long from 1.1000, SL at 1.0950 = 50 pips risk
		// Risk = 50 pips × $10/pip × 1 lot = $500
		const trade = createTrade({
			symbol: "EUR/USD",
			instrumentType: "forex",
			entryPrice: 1.1,
			stopLoss: 1.095,
			quantity: 1,
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBeCloseTo(500, 10);
	});

	it("should scale forex risk with lot size", () => {
		// EUR/USD: 0.5 lots, 50 pips risk
		// Risk = 50 pips × $10/pip × 0.5 = $250
		const trade = createTrade({
			symbol: "EUR/USD",
			instrumentType: "forex",
			entryPrice: 1.1,
			stopLoss: 1.095,
			quantity: 0.5,
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBeCloseTo(250, 10);
	});
});

describe("calculatePlannedRR", () => {
	it("should calculate 2:1 R:R ratio", () => {
		// Entry at 5000, SL at 4990 (10 points risk), TP at 5020 (20 points reward)
		// R:R = 20/10 = 2.0
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5020,
		});

		const rr = calculatePlannedRR(trade);
		expect(rr).toBe(2);
	});

	it("should calculate 3:1 R:R ratio", () => {
		// Entry at 5000, SL at 4990 (10 points risk), TP at 5030 (30 points reward)
		// R:R = 30/10 = 3.0
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5030,
		});

		const rr = calculatePlannedRR(trade);
		expect(rr).toBe(3);
	});

	it("should calculate 0.5:1 R:R ratio (reward < risk)", () => {
		// Entry at 5000, SL at 4980 (20 points risk), TP at 5010 (10 points reward)
		// R:R = 10/20 = 0.5
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 4980,
			takeProfit: 5010,
		});

		const rr = calculatePlannedRR(trade);
		expect(rr).toBe(0.5);
	});

	it("should handle short trade R:R correctly", () => {
		// Short at 5000, SL at 5010 (10 points risk), TP at 4970 (30 points reward)
		// R:R = 30/10 = 3.0
		const trade = createTrade({
			direction: "short",
			entryPrice: 5000,
			stopLoss: 5010,
			takeProfit: 4970,
		});

		const rr = calculatePlannedRR(trade);
		expect(rr).toBe(3);
	});

	it("should return null when stop loss is missing", () => {
		const trade = createTrade({ stopLoss: null });
		const rr = calculatePlannedRR(trade);
		expect(rr).toBeNull();
	});

	it("should return null when take profit is missing", () => {
		const trade = createTrade({ takeProfit: null });
		const rr = calculatePlannedRR(trade);
		expect(rr).toBeNull();
	});

	it("should return null when risk distance is zero", () => {
		// Entry equals SL (impossible but edge case)
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 5000,
		});

		const rr = calculatePlannedRR(trade);
		expect(rr).toBeNull();
	});
});

describe("calculateAchievedR", () => {
	it("should calculate positive R-multiple for winning trade", () => {
		// ES: Entry 5000, SL 4990 (10 pts = $500 risk), realized P&L $1000
		// Achieved R = $1000 / $500 = 2R
		const trade = createTrade({
			symbol: "ES",
			instrumentType: "futures",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: 1000,
		});

		const achievedR = calculateAchievedR(trade);
		expect(achievedR).toBe(2);
	});

	it("should calculate negative R-multiple for losing trade", () => {
		// ES: Entry 5000, SL 4990 (10 pts = $500 risk), realized P&L -$500
		// Achieved R = -$500 / $500 = -1R
		const trade = createTrade({
			symbol: "ES",
			instrumentType: "futures",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: -500,
		});

		const achievedR = calculateAchievedR(trade);
		expect(achievedR).toBe(-1);
	});

	it("should calculate fractional R-multiple", () => {
		// ES: Entry 5000, SL 4990 ($500 risk), realized P&L $750
		// Achieved R = $750 / $500 = 1.5R
		const trade = createTrade({
			symbol: "ES",
			instrumentType: "futures",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: 750,
		});

		const achievedR = calculateAchievedR(trade);
		expect(achievedR).toBe(1.5);
	});

	it("should return null when stop loss is missing", () => {
		const trade = createTrade({ stopLoss: null, realizedPnl: 1000 });
		const achievedR = calculateAchievedR(trade);
		expect(achievedR).toBeNull();
	});

	it("should return null when realized P&L is missing", () => {
		const trade = createTrade({ realizedPnl: null });
		const achievedR = calculateAchievedR(trade);
		expect(achievedR).toBeNull();
	});
});

// =============================================================================
// MIN R:R RATIO TESTS
// =============================================================================

describe("checkMinRRRatio", () => {
	it("should pass when planned R:R meets minimum", () => {
		// Planned R:R = 2:1, minimum = 2:1
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5020,
		});

		const result = checkMinRRRatio(trade, 2);

		expect(result.param).toBe("minRRRatio");
		expect(result.passed).toBe(true);
		expect(result.actual).toBe(2);
		expect(result.limit).toBe(2);
		expect(result.note).toContain("met minimum");
	});

	it("should pass when planned R:R exceeds minimum", () => {
		// Planned R:R = 3:1, minimum = 2:1
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5030,
		});

		const result = checkMinRRRatio(trade, 2);

		expect(result.passed).toBe(true);
		expect(result.actual).toBe(3);
	});

	it("should fail when planned R:R is below minimum", () => {
		// Planned R:R = 1.5:1, minimum = 2:1
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5015,
		});

		const result = checkMinRRRatio(trade, 2);

		expect(result.passed).toBe(false);
		expect(result.actual).toBe(1.5);
		expect(result.note).toContain("below minimum");
	});

	it("should return unable to check when SL/TP missing", () => {
		const trade = createTrade({ stopLoss: null });

		const result = checkMinRRRatio(trade, 2);

		expect(result.passed).toBeNull();
		expect(result.actual).toBeNull();
		expect(result.note).toContain("Unable to check");
	});
});

// =============================================================================
// MAX RISK PER TRADE TESTS
// =============================================================================

describe("checkMaxRiskPerTrade", () => {
	describe("dollar-based limits", () => {
		it("should pass when risk is within dollar limit", () => {
			// ES: 10 pts × $50 = $500 risk, limit $600
			const trade = createTrade({
				symbol: "ES",
				entryPrice: 5000,
				stopLoss: 4990,
				quantity: 1,
			});

			const result = checkMaxRiskPerTrade(trade, {
				type: "dollars",
				value: 600,
			});

			expect(result.passed).toBe(true);
			expect(result.actual).toBe(500);
			expect(result.limit).toBe(600);
			expect(result.note).toContain("within limit");
		});

		it("should fail when risk exceeds dollar limit", () => {
			// ES: 10 pts × $50 = $500 risk, limit $400
			const trade = createTrade({
				symbol: "ES",
				entryPrice: 5000,
				stopLoss: 4990,
				quantity: 1,
			});

			const result = checkMaxRiskPerTrade(trade, {
				type: "dollars",
				value: 400,
			});

			expect(result.passed).toBe(false);
			expect(result.actual).toBe(500);
			expect(result.limit).toBe(400);
			expect(result.note).toContain("exceeded");
		});
	});

	describe("percent-based limits", () => {
		it("should pass when risk percent is within limit", () => {
			// ES: $500 risk, account balance $50000 = 1% risk, limit 2%
			const trade = createTrade({
				symbol: "ES",
				entryPrice: 5000,
				stopLoss: 4990,
				quantity: 1,
			});

			const result = checkMaxRiskPerTrade(
				trade,
				{ type: "percent", value: 2 },
				50000,
			);

			expect(result.passed).toBe(true);
			expect(result.actual).toBe(1);
			expect(result.limit).toBe(2);
		});

		it("should fail when risk percent exceeds limit", () => {
			// ES: $500 risk, account balance $10000 = 5% risk, limit 2%
			const trade = createTrade({
				symbol: "ES",
				entryPrice: 5000,
				stopLoss: 4990,
				quantity: 1,
			});

			const result = checkMaxRiskPerTrade(
				trade,
				{ type: "percent", value: 2 },
				10000,
			);

			expect(result.passed).toBe(false);
			expect(result.actual).toBe(5);
			expect(result.limit).toBe(2);
		});

		it("should return unable to check when account balance missing", () => {
			const trade = createTrade();

			const result = checkMaxRiskPerTrade(trade, {
				type: "percent",
				value: 2,
			});

			expect(result.passed).toBeNull();
			expect(result.note).toContain("account balance required");
		});
	});

	it("should return unable to check when SL missing", () => {
		const trade = createTrade({ stopLoss: null });

		const result = checkMaxRiskPerTrade(trade, { type: "dollars", value: 500 });

		expect(result.passed).toBeNull();
		expect(result.note).toContain("missing stop loss");
	});
});

// =============================================================================
// TARGET R-MULTIPLES TESTS
// =============================================================================

describe("checkTargetRMultiples", () => {
	it("should identify which targets were hit", () => {
		// Trade achieved 2.5R, targets at 1R, 2R, 3R
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: 1250, // $1250 / $500 risk = 2.5R
		});

		const result = checkTargetRMultiples(trade, [1, 2, 3]);

		expect(result.check.passed).toBe(true);
		expect(result.check.actual).toBe(2.5);
		expect(result.targetsHit).toEqual([1, 2]);
		expect(result.check.note).toContain("Hit 2 target(s): 1R, 2R");
	});

	it("should report no targets hit for small win", () => {
		// Trade achieved 0.5R, targets at 1R, 2R
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: 250, // $250 / $500 risk = 0.5R
		});

		const result = checkTargetRMultiples(trade, [1, 2]);

		expect(result.check.passed).toBe(false);
		expect(result.check.actual).toBe(0.5);
		expect(result.targetsHit).toEqual([]);
		expect(result.check.note).toContain("Did not hit any targets");
	});

	it("should handle all targets hit", () => {
		// Trade achieved 5R, targets at 1R, 2R, 3R
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: 2500, // $2500 / $500 risk = 5R
		});

		const result = checkTargetRMultiples(trade, [1, 2, 3]);

		expect(result.targetsHit).toEqual([1, 2, 3]);
		expect(result.check.note).toContain("Hit 3 target(s): 1R, 2R, 3R");
	});

	it("should return unable to check when SL or P&L missing", () => {
		const trade = createTrade({ stopLoss: null });

		const result = checkTargetRMultiples(trade, [1, 2]);

		expect(result.check.passed).toBeNull();
		expect(result.targetsHit).toEqual([]);
		expect(result.check.note).toContain("Unable to check");
	});

	it("should sort targets when provided out of order", () => {
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: 1000, // 2R
		});

		const result = checkTargetRMultiples(trade, [3, 1, 2]);

		expect(result.targetsHit).toEqual([1, 2]);
	});
});

// =============================================================================
// DAILY LOSS LIMIT TESTS
// =============================================================================

describe("checkDailyLossCompliance", () => {
	describe("dollar-based limits", () => {
		it("should pass when cumulative P&L is within limit", () => {
			// Prior trades: -$200, current trade being taken
			// Daily loss limit: $500
			const trade = createTrade({ id: "trade-3" });
			const dailyTrades: TradeForCompliance[] = [
				createTrade({ id: "trade-1", realizedPnl: -100 }),
				createTrade({ id: "trade-2", realizedPnl: -100 }),
				trade,
			];

			const result = checkDailyLossCompliance(
				trade,
				{ type: "dollars", value: 500 },
				dailyTrades,
			);

			expect(result.passed).toBe(true);
			expect(result.actual).toBe(-200);
			expect(result.limit).toBe(500);
			expect(result.note).toContain("within -$500 limit");
		});

		it("should fail when cumulative P&L exceeds limit", () => {
			// Prior trades: -$600, current trade being taken
			// Daily loss limit: $500
			const trade = createTrade({ id: "trade-3" });
			const dailyTrades: TradeForCompliance[] = [
				createTrade({ id: "trade-1", realizedPnl: -300 }),
				createTrade({ id: "trade-2", realizedPnl: -300 }),
				trade,
			];

			const result = checkDailyLossCompliance(
				trade,
				{ type: "dollars", value: 500 },
				dailyTrades,
			);

			expect(result.passed).toBe(false);
			expect(result.actual).toBe(-600);
			expect(result.note).toContain("exceeded -$500 limit");
		});

		it("should pass when prior trades are positive", () => {
			// Prior trades: +$500
			const trade = createTrade({ id: "trade-2" });
			const dailyTrades: TradeForCompliance[] = [
				createTrade({ id: "trade-1", realizedPnl: 500 }),
				trade,
			];

			const result = checkDailyLossCompliance(
				trade,
				{ type: "dollars", value: 400 },
				dailyTrades,
			);

			expect(result.passed).toBe(true);
			expect(result.actual).toBe(500);
		});

		it("should exclude current trade from cumulative P&L", () => {
			// This trade's P&L shouldn't be included in the calculation
			const trade = createTrade({ id: "trade-2", realizedPnl: -1000 });
			const dailyTrades: TradeForCompliance[] = [
				createTrade({ id: "trade-1", realizedPnl: -200 }),
				trade,
			];

			const result = checkDailyLossCompliance(
				trade,
				{ type: "dollars", value: 500 },
				dailyTrades,
			);

			expect(result.actual).toBe(-200); // Not -1200
		});
	});

	describe("percent-based limits", () => {
		it("should pass when loss percent is within limit", () => {
			// Prior trades: -$500, account balance $50000 = 1% loss
			// Daily loss limit: 2%
			const trade = createTrade({ id: "trade-2" });
			const dailyTrades: TradeForCompliance[] = [
				createTrade({ id: "trade-1", realizedPnl: -500 }),
				trade,
			];

			const result = checkDailyLossCompliance(
				trade,
				{ type: "percent", value: 2 },
				dailyTrades,
				50000,
			);

			expect(result.passed).toBe(true);
			expect(result.actual).toBe(-1); // -1%
			expect(result.limit).toBe(2);
		});

		it("should fail when loss percent exceeds limit", () => {
			// Prior trades: -$2000, account balance $50000 = 4% loss
			// Daily loss limit: 2%
			const trade = createTrade({ id: "trade-2" });
			const dailyTrades: TradeForCompliance[] = [
				createTrade({ id: "trade-1", realizedPnl: -2000 }),
				trade,
			];

			const result = checkDailyLossCompliance(
				trade,
				{ type: "percent", value: 2 },
				dailyTrades,
				50000,
			);

			expect(result.passed).toBe(false);
			expect(result.actual).toBe(-4); // -4%
		});

		it("should return unable to check when account balance missing", () => {
			const trade = createTrade();

			const result = checkDailyLossCompliance(
				trade,
				{ type: "percent", value: 2 },
				[trade],
			);

			expect(result.passed).toBeNull();
			expect(result.note).toContain("account balance required");
		});
	});

	it("should handle empty daily trades list", () => {
		const trade = createTrade();

		const result = checkDailyLossCompliance(
			trade,
			{ type: "dollars", value: 500 },
			[trade],
		);

		expect(result.passed).toBe(true);
		expect(result.actual).toBe(0);
	});

	it("should filter out trades without realized P&L", () => {
		const trade = createTrade({ id: "trade-3" });
		const dailyTrades: TradeForCompliance[] = [
			createTrade({ id: "trade-1", realizedPnl: -200 }),
			createTrade({ id: "trade-2", realizedPnl: null }), // Open trade, no P&L
			trade,
		];

		const result = checkDailyLossCompliance(
			trade,
			{ type: "dollars", value: 500 },
			dailyTrades,
		);

		expect(result.actual).toBe(-200);
	});
});

// =============================================================================
// CONCURRENT POSITIONS TESTS
// =============================================================================

describe("checkConcurrentPositions", () => {
	it("should pass when concurrent positions within limit", () => {
		// 1 trade open when current trade entered, limit is 3
		const trade = createTrade({
			id: "trade-2",
			entryTime: new Date("2025-01-15T11:00:00Z"),
		});
		const allTrades: TradeForCompliance[] = [
			createTrade({
				id: "trade-1",
				entryTime: new Date("2025-01-15T10:00:00Z"),
				exitTime: new Date("2025-01-15T12:00:00Z"), // Still open at 11:00
			}),
			trade,
		];

		const result = checkConcurrentPositions(trade, 3, allTrades);

		expect(result.passed).toBe(true);
		expect(result.actual).toBe(2); // 1 existing + 1 new = 2
		expect(result.limit).toBe(3);
		expect(result.note).toContain("within 3 limit");
	});

	it("should fail when concurrent positions exceed limit", () => {
		// 2 trades open when current trade entered, limit is 2
		const trade = createTrade({
			id: "trade-3",
			entryTime: new Date("2025-01-15T12:00:00Z"),
		});
		const allTrades: TradeForCompliance[] = [
			createTrade({
				id: "trade-1",
				entryTime: new Date("2025-01-15T10:00:00Z"),
				exitTime: new Date("2025-01-15T14:00:00Z"), // Still open
			}),
			createTrade({
				id: "trade-2",
				entryTime: new Date("2025-01-15T11:00:00Z"),
				exitTime: new Date("2025-01-15T14:00:00Z"), // Still open
			}),
			trade,
		];

		const result = checkConcurrentPositions(trade, 2, allTrades);

		expect(result.passed).toBe(false);
		expect(result.actual).toBe(3); // 2 existing + 1 new = 3
		expect(result.note).toContain("exceeded 2 limit");
	});

	it("should not count trades that exited before entry", () => {
		// Trade exited before current trade entry
		const trade = createTrade({
			id: "trade-2",
			entryTime: new Date("2025-01-15T12:00:00Z"),
		});
		const allTrades: TradeForCompliance[] = [
			createTrade({
				id: "trade-1",
				entryTime: new Date("2025-01-15T10:00:00Z"),
				exitTime: new Date("2025-01-15T11:00:00Z"), // Closed before trade-2 entry
			}),
			trade,
		];

		const result = checkConcurrentPositions(trade, 1, allTrades);

		expect(result.passed).toBe(true);
		expect(result.actual).toBe(1); // Only current trade
	});

	it("should count trades still open (no exit time)", () => {
		// Trade without exit is still open
		const trade = createTrade({
			id: "trade-2",
			entryTime: new Date("2025-01-15T12:00:00Z"),
		});
		const allTrades: TradeForCompliance[] = [
			createTrade({
				id: "trade-1",
				entryTime: new Date("2025-01-15T10:00:00Z"),
				exitTime: null, // Still open
			}),
			trade,
		];

		const result = checkConcurrentPositions(trade, 1, allTrades);

		expect(result.passed).toBe(false);
		expect(result.actual).toBe(2);
	});

	it("should not count trades entered after current trade", () => {
		// Trade entered after current trade entry
		const trade = createTrade({
			id: "trade-1",
			entryTime: new Date("2025-01-15T10:00:00Z"),
		});
		const allTrades: TradeForCompliance[] = [
			trade,
			createTrade({
				id: "trade-2",
				entryTime: new Date("2025-01-15T12:00:00Z"), // After trade-1 entry
			}),
		];

		const result = checkConcurrentPositions(trade, 1, allTrades);

		expect(result.passed).toBe(true);
		expect(result.actual).toBe(1);
	});

	it("should return unable to check when entry time missing", () => {
		const trade = createTrade({ entryTime: undefined });

		const result = checkConcurrentPositions(trade, 2, [trade]);

		expect(result.passed).toBeNull();
		expect(result.note).toContain("missing entry time");
	});

	it("should handle trades entered at exactly the same time", () => {
		// Two trades entered at exactly the same time - both should count
		const trade = createTrade({
			id: "trade-2",
			entryTime: new Date("2025-01-15T10:00:00Z"),
		});
		const allTrades: TradeForCompliance[] = [
			createTrade({
				id: "trade-1",
				entryTime: new Date("2025-01-15T10:00:00Z"), // Same time
				exitTime: null,
			}),
			trade,
		];

		// Trade-1 entered at same time, should be counted
		const result = checkConcurrentPositions(trade, 1, allTrades);

		expect(result.passed).toBe(false);
		expect(result.actual).toBe(2);
	});
});

// =============================================================================
// MAIN COMPLIANCE CALCULATOR TESTS
// =============================================================================

describe("calculateRiskCompliance", () => {
	it("should run all configured checks", () => {
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5020, // 2:1 R:R
			quantity: 1,
			realizedPnl: 1000, // 2R
		});

		const riskParams: RiskParameters = {
			minRRRatio: 1.5, // Should pass (2 >= 1.5)
			maxRiskPerTrade: { type: "dollars", value: 600 }, // Should pass ($500 <= $600)
			dailyLossLimit: null,
			maxConcurrentPositions: null,
			targetRMultiples: [1, 2, 3], // Should hit 1R and 2R
		};

		const result = calculateRiskCompliance(trade, riskParams, 50000);

		expect(result.checks).toHaveLength(3);
		expect(result.checks.find((c) => c.param === "minRRRatio")?.passed).toBe(
			true,
		);
		expect(
			result.checks.find((c) => c.param === "maxRiskPerTrade")?.passed,
		).toBe(true);
		expect(
			result.checks.find((c) => c.param === "targetRMultiples")?.passed,
		).toBe(true);
		expect(result.targetsHit).toEqual([1, 2]);
	});

	it("should calculate overall compliance percentage", () => {
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5020,
			quantity: 1,
			realizedPnl: 1000,
		});

		// 2 passing, 1 failing = 66.67% compliance
		const riskParams: RiskParameters = {
			minRRRatio: 1.5, // Pass
			maxRiskPerTrade: { type: "dollars", value: 400 }, // Fail ($500 > $400)
			dailyLossLimit: null,
			maxConcurrentPositions: null,
			targetRMultiples: [1, 2], // Pass (hit both)
		};

		const result = calculateRiskCompliance(trade, riskParams, 50000);

		expect(result.overallCompliance).toBe(67); // Math.round(2/3 * 100)
	});

	it("should return 100% compliance when all checks pass", () => {
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			takeProfit: 5020,
			quantity: 1,
			realizedPnl: 1000,
		});

		const riskParams: RiskParameters = {
			minRRRatio: 1.5,
			maxRiskPerTrade: { type: "dollars", value: 600 },
			dailyLossLimit: null,
			maxConcurrentPositions: null,
			targetRMultiples: [1, 2],
		};

		const result = calculateRiskCompliance(trade, riskParams, 50000);

		expect(result.overallCompliance).toBe(100);
	});

	it("should return 100% compliance when no checks configured", () => {
		const trade = createTrade();

		const riskParams: RiskParameters = {
			minRRRatio: null,
			maxRiskPerTrade: null,
			dailyLossLimit: null,
			maxConcurrentPositions: null,
			targetRMultiples: null,
		};

		const result = calculateRiskCompliance(trade, riskParams);

		expect(result.checks).toHaveLength(0);
		expect(result.overallCompliance).toBe(100);
	});

	it("should exclude null checks from compliance calculation", () => {
		// Trade missing SL - minRRRatio will return null
		const trade = createTrade({
			stopLoss: null,
			takeProfit: 5020,
		});

		const riskParams: RiskParameters = {
			minRRRatio: 1.5, // Will be null (can't check without SL)
			maxRiskPerTrade: null,
			dailyLossLimit: null,
			maxConcurrentPositions: null,
			targetRMultiples: null,
		};

		const result = calculateRiskCompliance(trade, riskParams);

		// No valid checks, so 100% compliant
		expect(result.overallCompliance).toBe(100);
	});

	it("should handle empty target multiples array", () => {
		const trade = createTrade();

		const riskParams: RiskParameters = {
			minRRRatio: null,
			maxRiskPerTrade: null,
			dailyLossLimit: null,
			maxConcurrentPositions: null,
			targetRMultiples: [], // Empty array
		};

		const result = calculateRiskCompliance(trade, riskParams);

		expect(result.checks).toHaveLength(0);
		expect(result.targetsHit).toEqual([]);
	});
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("Edge cases", () => {
	it("should handle zero risk distance (entry equals SL)", () => {
		const trade = createTrade({
			entryPrice: 5000,
			stopLoss: 5000, // Same as entry
		});

		const rr = calculatePlannedRR(trade);
		expect(rr).toBeNull();

		const achievedR = calculateAchievedR(trade);
		expect(achievedR).toBeNull();
	});

	it("should handle extremely small position sizes", () => {
		const trade = createTrade({
			symbol: "EUR/USD",
			instrumentType: "forex",
			entryPrice: 1.1,
			stopLoss: 1.095,
			quantity: 0.01, // Micro lot
		});

		const risk = calculateDollarRisk(trade);
		expect(risk).toBeCloseTo(5, 10); // 50 pips × $10/pip × 0.01 = $5
	});

	it("should handle negative P&L exceeding 1R loss", () => {
		// Trade lost more than planned risk (slippage, gap, etc.)
		const trade = createTrade({
			symbol: "ES",
			entryPrice: 5000,
			stopLoss: 4990,
			quantity: 1,
			realizedPnl: -750, // Lost more than $500 planned risk
		});

		const achievedR = calculateAchievedR(trade);
		expect(achievedR).toBe(-1.5);
	});
});
