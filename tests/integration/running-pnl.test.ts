/**
 * Integration tests for running P&L calculation utilities.
 *
 * These tests verify that the running P&L calculations work correctly
 * for different trade directions and execution scenarios.
 */

import { describe, expect, it } from "vitest";
import type { ChartBar } from "@/lib/market-data/candle-aggregation";
import {
	calculateRunningPnlAtTime,
	type Execution,
	generateRunningPnlSeries,
	type RunningPnlOptions,
} from "@/lib/trades/running-pnl";

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a mock ChartBar at a given timestamp
 */
function createBar(
	time: number,
	close: number,
	open?: number,
	high?: number,
	low?: number,
): ChartBar {
	return {
		time,
		open: open ?? close,
		high: high ?? close,
		low: low ?? close,
		close,
	};
}

/**
 * Create a mock execution
 */
function createExecution(
	id: string,
	executionType: Execution["executionType"],
	price: string,
	quantity: string,
	executedAt: number,
	realizedPnl?: string,
): Execution {
	return {
		id,
		executionType,
		price,
		quantity,
		executedAt: new Date(executedAt * 1000),
		realizedPnl: realizedPnl ?? null,
	};
}

// =============================================================================
// LONG TRADE TESTS
// =============================================================================

describe("calculateRunningPnlAtTime - Long trades", () => {
	it("should calculate profit for a winning long trade", () => {
		// Long ES at 5000, price goes to 5020
		// Expected profit: 20 points × $50/point × 1 contract = $1000
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			5020, // current price
			"long",
			"ES",
		);

		expect(pnl).toBe(1000);
	});

	it("should calculate loss for a losing long trade", () => {
		// Long ES at 5000, price drops to 4980
		// Expected loss: -20 points × $50/point × 1 contract = -$1000
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			4980, // current price
			"long",
			"ES",
		);

		expect(pnl).toBe(-1000);
	});

	it("should scale with multiple contracts", () => {
		// Long 2 ES contracts at 5000, price goes to 5010
		// Expected profit: 10 points × $50/point × 2 contracts = $1000
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "2", 1000),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			5010, // current price
			"long",
			"ES",
		);

		expect(pnl).toBe(1000);
	});
});

// =============================================================================
// SHORT TRADE TESTS
// =============================================================================

describe("calculateRunningPnlAtTime - Short trades", () => {
	it("should calculate profit for a winning short trade", () => {
		// Short ES at 5000, price drops to 4980
		// Expected profit: 20 points × $50/point × 1 contract = $1000
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			4980, // current price
			"short",
			"ES",
		);

		expect(pnl).toBe(1000);
	});

	it("should calculate loss for a losing short trade", () => {
		// Short ES at 5000, price rises to 5020
		// Expected loss: -20 points × $50/point × 1 contract = -$1000
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			5020, // current price
			"short",
			"ES",
		);

		expect(pnl).toBe(-1000);
	});

	it("should scale with multiple contracts", () => {
		// Short 3 NQ contracts at 18000, price drops to 17980
		// Expected profit: 20 points × $20/point × 3 contracts = $1200
		const executions: Execution[] = [
			createExecution("1", "entry", "18000", "3", 1000),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			17980, // current price
			"short",
			"NQ",
		);

		expect(pnl).toBe(1200);
	});
});

// =============================================================================
// PARTIAL EXIT (SCALE-OUT) TESTS
// =============================================================================

describe("calculateRunningPnlAtTime - Partial exits", () => {
	it("should include realized P&L from scale-outs", () => {
		// Long 2 ES at 5000
		// Scale out 1 contract at 5010 for $500 realized profit
		// Current price 5020, remaining 1 contract unrealized = $1000
		// Total P&L = $500 (realized) + $1000 (unrealized) = $1500
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "2", 1000),
			createExecution("2", "scale_out", "5010", "1", 1100, "500"),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			5020, // current price
			"long",
			"ES",
		);

		expect(pnl).toBe(1500);
	});

	it("should accumulate multiple scale-outs", () => {
		// Long 3 ES at 5000
		// Scale out 1 at 5010 for $500 realized
		// Scale out 1 at 5015 for $750 realized
		// Current price 5020, remaining 1 contract unrealized = $1000
		// Total = $500 + $750 + $1000 = $2250
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "3", 1000),
			createExecution("2", "scale_out", "5010", "1", 1100, "500"),
			createExecution("3", "scale_out", "5015", "1", 1200, "750"),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			5020, // current price
			"long",
			"ES",
		);

		expect(pnl).toBe(2250);
	});

	it("should include realized P&L from final exit", () => {
		// Long 1 ES at 5000
		// Exit at 5020 for $1000 realized
		// After exit, position is closed (0 remaining contracts)
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
			createExecution("2", "exit", "5020", "1", 1100, "1000"),
		];

		// At exit price, should show only realized P&L (no unrealized since position is flat)
		const pnl = calculateRunningPnlAtTime(
			executions,
			5020, // current price at exit
			"long",
			"ES",
		);

		// After full exit, unrealized = 0, only realized P&L remains
		expect(pnl).toBe(1000); // $0 unrealized + $1000 realized
	});
});

// =============================================================================
// FUTURES SYMBOL TESTS
// =============================================================================

describe("calculateRunningPnlAtTime - Futures symbols", () => {
	it("should calculate ES P&L correctly ($50/point)", () => {
		// ES: $50 per point
		// 10 points × $50 = $500
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(executions, 5010, "long", "ES");

		expect(pnl).toBe(500);
	});

	it("should calculate NQ P&L correctly ($20/point)", () => {
		// NQ: $20 per point
		// 10 points × $20 = $200
		const executions: Execution[] = [
			createExecution("1", "entry", "18000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(executions, 18010, "long", "NQ");

		expect(pnl).toBe(200);
	});

	it("should calculate MES P&L correctly ($5/point)", () => {
		// MES (micro): $5 per point
		// 10 points × $5 = $50
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(executions, 5010, "long", "MES");

		expect(pnl).toBe(50);
	});
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("calculateRunningPnlAtTime - Edge cases", () => {
	it("should return 0 for empty executions", () => {
		const pnl = calculateRunningPnlAtTime([], 5000, "long", "ES");
		expect(pnl).toBe(0);
	});

	it("should return 0 when no entry execution exists", () => {
		// Only has an exit (shouldn't happen in practice)
		const executions: Execution[] = [
			createExecution("1", "exit", "5020", "1", 1100, "1000"),
		];

		const pnl = calculateRunningPnlAtTime(executions, 5020, "long", "ES");

		expect(pnl).toBe(0);
	});

	it("should handle zero price movement", () => {
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const pnl = calculateRunningPnlAtTime(
			executions,
			5000, // same as entry
			"long",
			"ES",
		);

		expect(pnl).toBe(0);
	});
});

// =============================================================================
// GENERATE RUNNING P&L SERIES TESTS
// =============================================================================

describe("generateRunningPnlSeries", () => {
	it("should generate P&L series for each bar after entry", () => {
		const entryTime = 1000;
		const bars: ChartBar[] = [
			createBar(900, 4990), // before entry
			createBar(1000, 5000), // at entry
			createBar(1100, 5010), // $500 profit
			createBar(1200, 5020), // $1000 profit
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", entryTime),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		// Should skip bar before entry
		expect(series).toHaveLength(3);
		expect(series[0]).toEqual({ time: 1000, pnl: 0 }); // at entry, no movement
		expect(series[1]).toEqual({ time: 1100, pnl: 500 }); // 10 points × $50
		expect(series[2]).toEqual({ time: 1200, pnl: 1000 }); // 20 points × $50
	});

	it("should include scale-out realized P&L in series", () => {
		const entryTime = 1000;
		const scaleOutTime = 1100;

		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 5010), // at scale-out
			createBar(1200, 5020), // after scale-out
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "2", entryTime),
			createExecution("2", "scale_out", "5010", "1", scaleOutTime, "500"),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toHaveLength(3);
		// At entry: 0 unrealized, 0 realized
		expect(series[0]).toEqual({ time: 1000, pnl: 0 });
		// At scale-out: 10pts × $50 × 1 remaining = $500 unrealized + $500 realized = $1000
		expect(series[1]).toEqual({ time: 1100, pnl: 1000 });
		// After scale-out: 20pts × $50 × 1 remaining = $1000 unrealized + $500 realized = $1500
		expect(series[2]).toEqual({ time: 1200, pnl: 1500 });
	});

	it("should return empty array for empty bars", () => {
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", 1000),
		];

		const options: RunningPnlOptions = {
			bars: [],
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toEqual([]);
	});

	it("should return empty array for empty executions", () => {
		const bars: ChartBar[] = [createBar(1000, 5000), createBar(1100, 5010)];

		const options: RunningPnlOptions = {
			bars,
			executions: [],
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toEqual([]);
	});

	it("should return empty array when no entry execution exists", () => {
		const bars: ChartBar[] = [createBar(1000, 5000), createBar(1100, 5010)];

		const executions: Execution[] = [
			createExecution("1", "exit", "5010", "1", 1100, "500"),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toEqual([]);
	});

	it("should handle short trades correctly", () => {
		const entryTime = 1000;
		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 4990), // +10 pts profit for short
			createBar(1200, 5010), // -10 pts loss for short
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", entryTime),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "short",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toHaveLength(3);
		expect(series[0]).toEqual({ time: 1000, pnl: 0 });
		expect(series[1]).toEqual({ time: 1100, pnl: 500 }); // 10 pts profit
		expect(series[2]).toEqual({ time: 1200, pnl: -500 }); // 10 pts loss
	});
});

// =============================================================================
// EXIT TIME BOUNDARY TESTS
// =============================================================================

describe("generateRunningPnlSeries - Exit time boundary", () => {
	it("should stop P&L series at exit time for closed trades", () => {
		const entryTime = 1000;
		const exitTime = 1200;

		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 5010), // during trade
			createBar(1200, 5020), // at exit
			createBar(1300, 5030), // after exit - should NOT be included
			createBar(1400, 5040), // after exit - should NOT be included
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", entryTime),
			createExecution("2", "exit", "5020", "1", exitTime, "1000"),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		// Should only include bars up to and including exit time
		expect(series).toHaveLength(3);
		expect(series[0]).toEqual({ time: 1000, pnl: 0 });
		expect(series[1]).toEqual({ time: 1100, pnl: 500 });
		expect(series[2]).toEqual({ time: 1200, pnl: 1000 }); // Final P&L at exit
	});

	it("should use exit price for final P&L point", () => {
		const entryTime = 1000;
		const exitTime = 1200;

		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 5010), // during trade
			// Bar close is 5025 but exit was at 5020 - should use exit price
			createBar(1200, 5025),
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", entryTime),
			// Exit at 5020, not at bar close of 5025
			createExecution("2", "exit", "5020", "1", exitTime, "1000"),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toHaveLength(3);
		// Final P&L should be $1000 (20 pts × $50), using exit price 5020
		// NOT $1250 (25 pts × $50) from bar close
		expect(series[2]).toEqual({ time: 1200, pnl: 1000 });
	});

	it("should continue chart for open trades without exit", () => {
		const entryTime = 1000;

		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 5010), // during trade
			createBar(1200, 5020), // still open
			createBar(1300, 5030), // still open - should be included
		];

		// No exit execution - trade is still open
		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", entryTime),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		// Should include all bars since trade is still open
		expect(series).toHaveLength(4);
		expect(series[0]).toEqual({ time: 1000, pnl: 0 });
		expect(series[1]).toEqual({ time: 1100, pnl: 500 });
		expect(series[2]).toEqual({ time: 1200, pnl: 1000 });
		expect(series[3]).toEqual({ time: 1300, pnl: 1500 });
	});

	it("should handle exit before last bar (no matching exit bar)", () => {
		const entryTime = 1000;
		const exitTime = 1150; // Between bar timestamps

		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 5010), // before exit
			// Exit happened at 1150, but next bar is 1200
			createBar(1200, 5025), // after exit - should NOT be included
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", entryTime),
			createExecution("2", "exit", "5015", "1", exitTime, "750"),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		// Should include bars up to exit time (1000 and 1100) + final exit point
		// Bar at 1200 is after exit (1150), so excluded
		// Final point at exact exit time (1150) uses exit price for accurate P&L
		expect(series).toHaveLength(3);
		expect(series[0]).toEqual({ time: 1000, pnl: 0 });
		expect(series[1]).toEqual({ time: 1100, pnl: 500 }); // 10 pts × $50
		expect(series[2]).toEqual({ time: 1150, pnl: 750 }); // Exit: 15 pts × $50
	});

	it("should handle short trade exit correctly", () => {
		const entryTime = 1000;
		const exitTime = 1200;

		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 4990), // profit for short
			createBar(1200, 4980), // at exit
			createBar(1300, 4970), // after exit - should NOT be included
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "1", entryTime),
			createExecution("2", "exit", "4980", "1", exitTime, "1000"),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "short",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toHaveLength(3);
		expect(series[0]).toEqual({ time: 1000, pnl: 0 });
		expect(series[1]).toEqual({ time: 1100, pnl: 500 }); // 10 pts profit
		expect(series[2]).toEqual({ time: 1200, pnl: 1000 }); // 20 pts profit at exit
	});

	it("should handle scale-outs with exit correctly", () => {
		const entryTime = 1000;
		const scaleOutTime = 1100;
		const exitTime = 1200;

		const bars: ChartBar[] = [
			createBar(1000, 5000), // at entry
			createBar(1100, 5010), // at scale-out
			createBar(1200, 5020), // at exit
			createBar(1300, 5030), // after exit - should NOT be included
		];

		const executions: Execution[] = [
			createExecution("1", "entry", "5000", "2", entryTime),
			createExecution("2", "scale_out", "5010", "1", scaleOutTime, "500"),
			createExecution("3", "exit", "5020", "1", exitTime, "1000"),
		];

		const options: RunningPnlOptions = {
			bars,
			executions,
			direction: "long",
			symbol: "ES",
		};

		const series = generateRunningPnlSeries(options);

		expect(series).toHaveLength(3);
		expect(series[0]).toEqual({ time: 1000, pnl: 0 });
		// At scale-out: $500 realized + $500 unrealized (1 remaining × 10 pts) = $1000
		expect(series[1]).toEqual({ time: 1100, pnl: 1000 });
		// At exit: $500 (first scale-out) + $1000 (final exit) = $1500 realized, 0 unrealized
		expect(series[2]).toEqual({ time: 1200, pnl: 1500 });
	});
});
