/**
 * Sort builder for server-side trade sorting
 * Maps frontend sort fields to SQL expressions
 */

import { type SQL, sql } from "drizzle-orm";
import type { SortDirection, SortField } from "@/lib/constants/trade-log";
import { TRADE_RESULT_SORT_RANK } from "@/lib/constants/trade-result";
import { accounts, strategies, trades } from "@/server/db/schema";

/**
 * SQL expression that derives a trade's result rank, mirroring
 * `deriveTradeResult` in @/lib/trades/result. Returns the integer ranks from
 * TRADE_RESULT_SORT_RANK so server-side sorting/filtering of the "Result"
 * column matches exactly what the UI renders (explicit exit reason wins, then
 * trailing stop, take profit, stop loss, else manual).
 */
export function derivedResultRankSql(): SQL {
	const r = TRADE_RESULT_SORT_RANK;
	return sql`
		CASE
			WHEN ${trades.status} <> 'closed' OR ${trades.exitPrice} IS NULL THEN ${r.open}
			WHEN ${trades.exitReason} = 'take_profit' THEN ${r.tp}
			WHEN ${trades.exitReason} = 'stop_loss' THEN ${r.sl}
			WHEN ${trades.exitReason} = 'trailing_stop' THEN ${r.trailing}
			WHEN ${trades.exitReason} = 'breakeven' THEN ${r.breakeven}
			WHEN ${trades.exitReason} IN ('manual', 'time_based') THEN ${r.manual}
			WHEN ${trades.wasTrailed} = TRUE AND ${trades.trailedStopLoss} IS NOT NULL
				AND (
					(${trades.direction} = 'long' AND CAST(${trades.exitPrice} AS DECIMAL) <= CAST(${trades.trailedStopLoss} AS DECIMAL))
					OR (${trades.direction} = 'short' AND CAST(${trades.exitPrice} AS DECIMAL) >= CAST(${trades.trailedStopLoss} AS DECIMAL))
				) THEN ${r.trailing}
			WHEN (
				${trades.takeProfit} IS NOT NULL AND (
					(${trades.direction} = 'long' AND CAST(${trades.exitPrice} AS DECIMAL) >= CAST(${trades.takeProfit} AS DECIMAL))
					OR (${trades.direction} = 'short' AND CAST(${trades.exitPrice} AS DECIMAL) <= CAST(${trades.takeProfit} AS DECIMAL))
				)
			) OR (${trades.takeProfit} IS NULL AND ${trades.takeProfitHit} = TRUE) THEN ${r.tp}
			WHEN (
				${trades.stopLoss} IS NOT NULL AND (
					(${trades.direction} = 'long' AND CAST(${trades.exitPrice} AS DECIMAL) <= CAST(${trades.stopLoss} AS DECIMAL))
					OR (${trades.direction} = 'short' AND CAST(${trades.exitPrice} AS DECIMAL) >= CAST(${trades.stopLoss} AS DECIMAL))
				)
			) OR (${trades.stopLoss} IS NULL AND ${trades.stopLossHit} = TRUE) THEN ${r.sl}
			ELSE ${r.manual}
		END
	`;
}

/**
 * Get the SQL expression for a sort field
 * Some fields map directly to columns, others require SQL expressions
 */
export function getSortExpression(field: SortField): SQL {
	switch (field) {
		// Direct column mappings
		case "symbol":
			return sql`${trades.symbol}`;
		case "side":
			return sql`${trades.direction}`;
		case "entry":
			return sql`${trades.entryTime}`;
		case "exit":
			return sql`${trades.exitTime}`;
		case "result":
			return derivedResultRankSql();
		case "rating":
			return sql`${trades.rating}`;
		case "reviewed":
			return sql`${trades.isReviewed}`;
		case "setup":
			return sql`${trades.setupType}`;

		// Decimal fields - cast for numeric comparison
		case "size":
			return sql`CAST(${trades.quantity} AS DECIMAL)`;
		case "pnl":
			return sql`CAST(${trades.netPnl} AS DECIMAL)`;
		case "fees":
			return sql`CAST(${trades.fees} AS DECIMAL)`;

		// Computed: duration in seconds (exit - entry)
		case "duration":
			return sql`EXTRACT(EPOCH FROM (${trades.exitTime} - ${trades.entryTime}))`;

		// Computed: R-Multiple (theoretical, price-based for SQL sorting)
		// Note: Uses simplified formula without point values for SQL performance.
		// Actual R-multiple display/filtering uses netPnl / (risk * pointValue * qty).
		// For long: (exitPrice - entryPrice) / (entryPrice - stopLoss)
		// For short: (entryPrice - exitPrice) / (stopLoss - entryPrice)
		case "rMultiple":
			return sql`
				CASE
					WHEN ${trades.stopLoss} IS NULL THEN NULL
					WHEN ${trades.direction} = 'long' THEN
						(CAST(${trades.exitPrice} AS DECIMAL) - CAST(${trades.entryPrice} AS DECIMAL)) /
						NULLIF(CAST(${trades.entryPrice} AS DECIMAL) - CAST(${trades.stopLoss} AS DECIMAL), 0)
					ELSE
						(CAST(${trades.entryPrice} AS DECIMAL) - CAST(${trades.exitPrice} AS DECIMAL)) /
						NULLIF(CAST(${trades.stopLoss} AS DECIMAL) - CAST(${trades.entryPrice} AS DECIMAL), 0)
				END
			`;

		// Join fields - use scalar subqueries
		case "account":
			return sql`(SELECT ${accounts.name} FROM ${accounts} WHERE ${accounts.id} = ${trades.accountId})`;
		case "strategy":
			return sql`(SELECT ${strategies.name} FROM ${strategies} WHERE ${strategies.id} = ${trades.strategyId})`;

		default:
			// Fallback to entry time
			return sql`${trades.entryTime}`;
	}
}

/**
 * Build the ORDER BY clause with NULLS LAST and secondary sort by ID
 * Returns raw SQL for use in orderBy
 */
export function buildOrderByClause(
	field: SortField,
	direction: SortDirection,
): SQL {
	const sortExpr = getSortExpression(field);

	// Build: sortExpr ASC/DESC NULLS LAST, trades.id ASC/DESC
	if (direction === "asc") {
		return sql`${sortExpr} ASC NULLS LAST, ${trades.id} ASC`;
	}
	return sql`${sortExpr} DESC NULLS LAST, ${trades.id} DESC`;
}

/**
 * Build cursor comparison condition for pagination
 * Handles compound cursor with sort value + ID for deterministic ordering
 */
export function buildCursorCondition(
	sortValue: string | number | boolean | null,
	cursorId: string,
	field: SortField,
	direction: SortDirection,
): SQL {
	const sortExpr = getSortExpression(field);

	// If cursor's sort value is null, we're in the "nulls last" section
	// Just compare by ID in that section
	if (sortValue === null) {
		if (direction === "asc") {
			return sql`(${sortExpr} IS NULL AND ${trades.id} > ${cursorId})`;
		}
		return sql`(${sortExpr} IS NULL AND ${trades.id} < ${cursorId})`;
	}

	// Compound comparison for non-null values:
	// For DESC: (sortField < cursorValue) OR (sortField = cursorValue AND id < cursorId)
	// For ASC: (sortField > cursorValue) OR (sortField = cursorValue AND id > cursorId)
	// Note: NULL values are handled by NULLS LAST in ORDER BY - they come after all non-null values
	if (direction === "asc") {
		return sql`(
			${sortExpr} > ${sortValue}
			OR (${sortExpr} = ${sortValue} AND ${trades.id} > ${cursorId})
		)`;
	}
	return sql`(
		${sortExpr} < ${sortValue}
		OR (${sortExpr} = ${sortValue} AND ${trades.id} < ${cursorId})
	)`;
}
