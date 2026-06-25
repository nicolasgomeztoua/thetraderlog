/**
 * Trade result derivation.
 *
 * The "Result" of a closed trade (Take Profit / Stop Loss / Trailing / etc.) is
 * inferred automatically from where the trade actually exited relative to its
 * planned levels — the user never has to tag it manually.
 *
 * Detection is directional and tolerant of slippage:
 *  - LONG  closed at/above TP → TP,   closed at/below SL → SL
 *  - SHORT closed at/below TP → TP,   closed at/above SL → SL
 *
 * Precedence: an explicitly recorded `exitReason` (set by the user or supplied
 * by a broker import) always wins; otherwise we derive from price. When a level
 * is present the live price comparison is authoritative (so editing TP/SL/exit
 * updates the result instantly); when no level exists we fall back to any
 * persisted hit flag a broker may have provided.
 */

/** Auto-detected outcome of a trade, as shown in the journal "Result" column. */
export type TradeResult =
	| "open"
	| "tp"
	| "sl"
	| "trailing"
	| "breakeven"
	| "manual";

/** Minimal trade shape required to derive a result. */
export interface DerivableTrade {
	status: string;
	direction: "long" | "short";
	exitPrice: string | null;
	stopLoss?: string | null;
	takeProfit?: string | null;
	trailedStopLoss?: string | null;
	wasTrailed?: boolean | null;
	exitReason?: string | null;
	stopLossHit?: boolean | null;
	takeProfitHit?: boolean | null;
}

/**
 * Derive the result of a trade from its exit price and planned levels.
 * Returns "open" for trades that are not yet closed.
 */
export function deriveTradeResult(trade: DerivableTrade): TradeResult {
	if (trade.status !== "closed" || !trade.exitPrice) return "open";

	// 1. An explicitly recorded exit reason reflects stated intent and wins.
	switch (trade.exitReason) {
		case "take_profit":
			return "tp";
		case "stop_loss":
			return "sl";
		case "trailing_stop":
			return "trailing";
		case "breakeven":
			return "breakeven";
		case "manual":
		case "time_based":
			return "manual";
		default:
			break; // null / unset → auto-detect from price
	}

	const exit = Number.parseFloat(trade.exitPrice);
	const isLong = trade.direction === "long";

	// 2. Trailed stop is the effective stop once trailing was engaged.
	if (trade.wasTrailed && trade.trailedStopLoss) {
		const tsl = Number.parseFloat(trade.trailedStopLoss);
		if (isLong ? exit <= tsl : exit >= tsl) return "trailing";
	}

	// 3. Take profit — level comparison wins when a level exists, otherwise
	//    trust a broker-provided hit flag.
	const tp = trade.takeProfit ? Number.parseFloat(trade.takeProfit) : null;
	const takeProfitHit =
		tp !== null
			? isLong
				? exit >= tp
				: exit <= tp
			: (trade.takeProfitHit ?? false);
	if (takeProfitHit) return "tp";

	// 4. Stop loss — same precedence as take profit.
	const sl = trade.stopLoss ? Number.parseFloat(trade.stopLoss) : null;
	const stopLossHit =
		sl !== null
			? isLong
				? exit <= sl
				: exit >= sl
			: (trade.stopLossHit ?? false);
	if (stopLossHit) return "sl";

	return "manual";
}
