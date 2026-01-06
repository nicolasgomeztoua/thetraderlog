/**
 * Trade log table constants
 */

/** Maps column IDs to trade property names for sorting */
export const TRADE_SORT_FIELDS = {
	symbol: "symbol",
	side: "direction",
	entry: "entryTime",
	exit: "exitTime",
	size: "quantity",
	pnl: "netPnl",
	result: "exitReason",
	rating: "rating",
	reviewed: "isReviewed",
	setup: "setupType",
	fees: "fees",
	duration: "_duration",
	account: "_accountName",
	strategy: "_strategyName",
} as const;

export type SortField = keyof typeof TRADE_SORT_FIELDS;
export type SortDirection = "asc" | "desc";

export interface TradeSort {
	field: SortField;
	direction: SortDirection;
}

/** Default sort: entry time descending (newest first) */
export const DEFAULT_TRADE_SORT: TradeSort = {
	field: "entry",
	direction: "desc",
};

/** Columns that cannot be sorted */
export const NON_SORTABLE_COLUMNS = [
	"checkbox",
	"actions",
	"tags",
	"rMultiple",
];
