import { createHash } from "crypto";

/**
 * Trade data required for hash computation.
 * Uses a minimal subset of trade properties that uniquely identify a trade.
 */
export interface TradeHashInput {
	accountId: string;
	symbol: string;
	direction: "long" | "short";
	entryPrice: string;
	entryTime: Date;
	exitPrice: string;
	exitTime: Date;
	quantity: string;
}

/**
 * Normalizes a decimal string to exactly 8 decimal places.
 * This ensures consistent hashing regardless of input precision.
 *
 * @example
 * normalizeDecimal("123.4") => "123.40000000"
 * normalizeDecimal("123.456789012") => "123.45678901"
 */
function normalizeDecimal(value: string): string {
	const num = parseFloat(value);
	if (isNaN(num)) {
		return "0.00000000";
	}
	return num.toFixed(8);
}

/**
 * Normalizes a symbol string for consistent hashing.
 * Converts to lowercase and trims whitespace.
 */
function normalizeSymbol(symbol: string): string {
	return symbol.toLowerCase().trim();
}

/**
 * Converts a Date to UTC ISO string for consistent hashing.
 * Always produces the same string regardless of local timezone.
 */
function normalizeTimestamp(date: Date): string {
	return date.toISOString();
}

/**
 * Computes a SHA-256 hash for a trade to enable duplicate detection.
 *
 * The hash is computed from a normalized combination of:
 * - accountId (trades are unique per account)
 * - symbol (lowercase, trimmed)
 * - direction (long/short)
 * - entryPrice (8 decimal places)
 * - entryTime (UTC ISO string)
 * - exitPrice (8 decimal places)
 * - exitTime (UTC ISO string)
 * - quantity (8 decimal places)
 *
 * Two trades with identical values for all these fields will produce
 * the same hash, allowing efficient duplicate detection via database lookup.
 *
 * @param trade - The trade data to hash
 * @returns A 64-character hexadecimal SHA-256 hash string
 *
 * @example
 * const hash = computeTradeHash({
 *   accountId: "ac-123",
 *   symbol: "ES",
 *   direction: "long",
 *   entryPrice: "4500.25",
 *   entryTime: new Date("2024-01-15T09:30:00Z"),
 *   exitPrice: "4510.50",
 *   exitTime: new Date("2024-01-15T10:30:00Z"),
 *   quantity: "1"
 * });
 */
export function computeTradeHash(trade: TradeHashInput): string {
	// Build a deterministic string from normalized trade properties
	const hashInput = [
		trade.accountId,
		normalizeSymbol(trade.symbol),
		trade.direction,
		normalizeDecimal(trade.entryPrice),
		normalizeTimestamp(trade.entryTime),
		normalizeDecimal(trade.exitPrice),
		normalizeTimestamp(trade.exitTime),
		normalizeDecimal(trade.quantity),
	].join("|");

	// Compute SHA-256 hash
	return createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Computes trade hashes for a batch of trades.
 * This is more efficient than calling computeTradeHash individually
 * when processing large CSV imports.
 *
 * @param trades - Array of trade data to hash
 * @returns Array of hash strings in the same order as input trades
 */
export function computeTradeHashes(trades: TradeHashInput[]): string[] {
	return trades.map((trade) => computeTradeHash(trade));
}
