/**
 * Cursor utilities for compound cursor pagination
 * Supports server-side sorting with deterministic ordering
 */

import type { SortField } from "@/lib/constants/trade-log";

/**
 * Compound cursor containing both sort value and trade ID
 * This ensures deterministic pagination with custom sort orders
 */
export interface CompoundCursor {
	/** The value of the sorted field for the cursor row */
	sortValue: string | number | boolean | null;
	/** The trade ID for tie-breaking when sort values are equal */
	id: string;
}

/**
 * Encode a compound cursor to a string for transport
 */
export function encodeCursor(cursor: CompoundCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString("base64");
}

/**
 * Decode a cursor string back to a compound cursor
 */
export function decodeCursor(encoded: string): CompoundCursor {
	try {
		return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
	} catch {
		// If decoding fails, return a minimal cursor that will start from the beginning
		throw new Error("Invalid cursor format");
	}
}

/**
 * Trade type with all relations loaded
 * Used for extracting sort values from fetched trades
 */
interface TradeWithRelations {
	id: string;
	symbol: string;
	direction: "long" | "short";
	entryTime: Date;
	exitTime: Date | null;
	entryPrice: string;
	exitPrice: string | null;
	stopLoss: string | null;
	quantity: string;
	netPnl: string | null;
	fees: string | null;
	rating: number | null;
	isReviewed: boolean | null;
	setupType: string | null;
	exitReason: string | null;
	account: { name: string } | null;
	strategy: { name: string } | null;
}

/**
 * Extract the sort value from a trade for a given sort field
 * Returns a value that can be compared in the database
 */
export function extractSortValue(
	trade: TradeWithRelations,
	field: SortField,
): string | number | boolean | null {
	switch (field) {
		case "symbol":
			return trade.symbol;
		case "side":
			return trade.direction;
		case "entry":
			return trade.entryTime.toISOString();
		case "exit":
			return trade.exitTime?.toISOString() ?? null;
		case "size":
			return trade.quantity ? Number.parseFloat(trade.quantity) : null;
		case "pnl":
			return trade.netPnl ? Number.parseFloat(trade.netPnl) : null;
		case "result":
			return trade.exitReason;
		case "rating":
			return trade.rating;
		case "reviewed":
			return trade.isReviewed;
		case "setup":
			return trade.setupType;
		case "fees":
			return trade.fees ? Number.parseFloat(trade.fees) : null;

		// Computed: duration in seconds
		case "duration":
			if (!trade.exitTime || !trade.entryTime) return null;
			return (
				(new Date(trade.exitTime).getTime() -
					new Date(trade.entryTime).getTime()) /
				1000
			);

		// Computed: R-Multiple
		case "rMultiple": {
			if (!trade.entryPrice || !trade.exitPrice || !trade.stopLoss) return null;
			const entry = Number.parseFloat(trade.entryPrice);
			const exit = Number.parseFloat(trade.exitPrice);
			const stop = Number.parseFloat(trade.stopLoss);
			const risk = trade.direction === "long" ? entry - stop : stop - entry;
			if (risk === 0) return null;
			const profit = trade.direction === "long" ? exit - entry : entry - exit;
			return profit / risk;
		}

		// Join fields
		case "account":
			return trade.account?.name ?? null;
		case "strategy":
			return trade.strategy?.name ?? null;

		default:
			return null;
	}
}
