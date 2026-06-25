/**
 * Unit tests for automatic trade-result detection.
 *
 * Pure function in src/lib/trades/result.ts — no database required.
 * Verifies that the journal "Result" column is inferred from where a trade
 * exited relative to its planned TP/SL levels (directional, slippage-tolerant),
 * while still honoring an explicitly recorded exit reason.
 */

import { describe, expect, it } from "vitest";
import { type DerivableTrade, deriveTradeResult } from "@/lib/trades/result";

/** Build a closed trade with sensible defaults, overridable per-test. */
function trade(overrides: Partial<DerivableTrade> = {}): DerivableTrade {
	return {
		status: "closed",
		direction: "long",
		exitPrice: "100",
		stopLoss: null,
		takeProfit: null,
		trailedStopLoss: null,
		wasTrailed: false,
		exitReason: null,
		stopLossHit: null,
		takeProfitHit: null,
		...overrides,
	};
}

describe("deriveTradeResult", () => {
	describe("open trades", () => {
		it("returns open when status is not closed", () => {
			expect(
				deriveTradeResult(trade({ status: "open", exitPrice: null })),
			).toBe("open");
		});

		it("returns open when closed but missing an exit price", () => {
			expect(deriveTradeResult(trade({ exitPrice: null }))).toBe("open");
		});
	});

	describe("long trades — price detection", () => {
		it("detects TP when exit reaches the target exactly", () => {
			expect(
				deriveTradeResult(
					trade({ direction: "long", takeProfit: "110", exitPrice: "110" }),
				),
			).toBe("tp");
		});

		it("detects TP when exit overshoots the target (positive slippage)", () => {
			expect(
				deriveTradeResult(
					trade({ direction: "long", takeProfit: "110", exitPrice: "111.5" }),
				),
			).toBe("tp");
		});

		it("detects SL when exit reaches the stop exactly", () => {
			expect(
				deriveTradeResult(
					trade({ direction: "long", stopLoss: "90", exitPrice: "90" }),
				),
			).toBe("sl");
		});

		it("detects SL when exit slips through the stop", () => {
			expect(
				deriveTradeResult(
					trade({ direction: "long", stopLoss: "90", exitPrice: "88.25" }),
				),
			).toBe("sl");
		});

		it("returns manual when exit lands between SL and TP", () => {
			expect(
				deriveTradeResult(
					trade({
						direction: "long",
						stopLoss: "90",
						takeProfit: "110",
						exitPrice: "103",
					}),
				),
			).toBe("manual");
		});
	});

	describe("short trades — price detection", () => {
		it("detects TP when exit drops to/below the target", () => {
			expect(
				deriveTradeResult(
					trade({ direction: "short", takeProfit: "90", exitPrice: "89" }),
				),
			).toBe("tp");
		});

		it("detects SL when exit rises to/above the stop", () => {
			expect(
				deriveTradeResult(
					trade({ direction: "short", stopLoss: "110", exitPrice: "112" }),
				),
			).toBe("sl");
		});

		it("returns manual when exit lands between TP and SL", () => {
			expect(
				deriveTradeResult(
					trade({
						direction: "short",
						stopLoss: "110",
						takeProfit: "90",
						exitPrice: "100",
					}),
				),
			).toBe("manual");
		});
	});

	describe("explicit exit reason wins over price", () => {
		it("respects a manual close even when price hit TP", () => {
			expect(
				deriveTradeResult(
					trade({
						takeProfit: "110",
						exitPrice: "110",
						exitReason: "manual",
					}),
				),
			).toBe("manual");
		});

		it("maps stop_loss reason even when no level is set", () => {
			expect(deriveTradeResult(trade({ exitReason: "stop_loss" }))).toBe("sl");
		});

		it("maps take_profit reason", () => {
			expect(deriveTradeResult(trade({ exitReason: "take_profit" }))).toBe(
				"tp",
			);
		});

		it("maps breakeven reason", () => {
			expect(deriveTradeResult(trade({ exitReason: "breakeven" }))).toBe(
				"breakeven",
			);
		});

		it("treats time_based as manual (no distinct display)", () => {
			expect(deriveTradeResult(trade({ exitReason: "time_based" }))).toBe(
				"manual",
			);
		});
	});

	describe("trailing stop", () => {
		it("detects a trailed-stop exit (long)", () => {
			expect(
				deriveTradeResult(
					trade({
						direction: "long",
						wasTrailed: true,
						trailedStopLoss: "105",
						takeProfit: "120",
						exitPrice: "105",
					}),
				),
			).toBe("trailing");
		});

		it("falls through to TP when trailed but exit did not hit the trail", () => {
			expect(
				deriveTradeResult(
					trade({
						direction: "long",
						wasTrailed: true,
						trailedStopLoss: "105",
						takeProfit: "120",
						exitPrice: "120",
					}),
				),
			).toBe("tp");
		});
	});

	describe("broker-provided hit flags (no level recorded)", () => {
		it("uses takeProfitHit when no take-profit level exists", () => {
			expect(deriveTradeResult(trade({ takeProfitHit: true }))).toBe("tp");
		});

		it("uses stopLossHit when no stop-loss level exists", () => {
			expect(deriveTradeResult(trade({ stopLossHit: true }))).toBe("sl");
		});

		it("ignores a stale hit flag once a level proves otherwise", () => {
			// Level says exit did not reach TP, so the stale flag is overridden.
			expect(
				deriveTradeResult(
					trade({
						direction: "long",
						takeProfit: "110",
						exitPrice: "105",
						takeProfitHit: true,
					}),
				),
			).toBe("manual");
		});
	});

	describe("no levels and no flags", () => {
		it("returns manual for a bare closed trade", () => {
			expect(deriveTradeResult(trade())).toBe("manual");
		});
	});
});
