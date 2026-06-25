/**
 * Display + sort constants for auto-detected trade results.
 * Single source of truth for the journal "Result" column labels and colors.
 */

import type { TradeResult } from "@/lib/trades/result";

export interface TradeResultMeta {
	/** Short label shown in the table. */
	label: string;
	/** Terminal-design color class for the label. */
	className: string;
}

/** Label + color for each derived trade result. */
export const TRADE_RESULT_META: Record<TradeResult, TradeResultMeta> = {
	open: { label: "Open", className: "text-muted-foreground" },
	tp: { label: "TP", className: "text-profit" },
	sl: { label: "SL", className: "text-loss" },
	trailing: { label: "Trail", className: "text-accent" },
	breakeven: { label: "BE", className: "text-breakeven" },
	manual: { label: "Manual", className: "text-muted-foreground" },
};

/**
 * Stable integer rank for each result, used to sort/group the "Result" column
 * server-side. Winners first, losers last. These exact values are mirrored by
 * the SQL CASE in the sort builder, so changing them changes both sides.
 */
export const TRADE_RESULT_SORT_RANK: Record<TradeResult, number> = {
	tp: 0,
	trailing: 1,
	breakeven: 2,
	manual: 3,
	sl: 4,
	open: 5,
};
