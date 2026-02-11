import { sql } from "drizzle-orm";
import type { ToolDefinition } from "@/lib/ai/client";
import type { db as DbInstance } from "@/server/db";

type Db = typeof DbInstance;

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const runQueryToolDefinition: ToolDefinition = {
	type: "function",
	function: {
		name: "run_query",
		description:
			"Execute a read-only SQL SELECT query against the trading database. " +
			"All queries are automatically scoped to the current user via CTEs. " +
			"Use user_trades, user_accounts, user_tags, user_strategies, user_journals, " +
			"user_executions, user_trade_tags as table aliases (they filter to the current user). " +
			"P&L columns (realized_pnl, net_pnl, fees) are stored as decimal strings — use CAST(column AS NUMERIC) for aggregation. " +
			"Always include deleted_at IS NULL for trade queries to exclude soft-deleted trades. " +
			"Results are limited to 500 rows.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"A SELECT SQL query. Use the user-scoped CTE aliases (user_trades, user_accounts, etc.) instead of raw table names. Example: SELECT symbol, COUNT(*) as trades, SUM(CAST(net_pnl AS NUMERIC)) as total_pnl FROM user_trades WHERE deleted_at IS NULL GROUP BY symbol ORDER BY total_pnl DESC LIMIT 20",
				},
			},
			required: ["query"],
		},
	},
};

// =============================================================================
// BLOCKED STATEMENTS
// =============================================================================

/**
 * These keywords indicate write/DDL operations when they appear at the start
 * of a statement or as standalone SQL commands. We check them as word boundaries
 * after stripping string literals and comments.
 *
 * Note: We do NOT block "DELETE" as a standalone word since "deleted_at" is a
 * common column reference. Instead we block "DELETE FROM" as a phrase.
 */
const BLOCKED_PATTERNS = [
	/\bINSERT\s+INTO\b/i,
	/\bDELETE\s+FROM\b/i,
	/\bUPDATE\s+\S+\s+SET\b/i,
	/\bDROP\b/i,
	/\bALTER\b/i,
	/\bTRUNCATE\b/i,
	/\bCREATE\b/i,
	/\bGRANT\b/i,
	/\bREVOKE\b/i,
	/\bCOPY\b/i,
	/\bVACUUM\b/i,
	/\bREINDEX\b/i,
	/\bCLUSTER\b/i,
	/\bLOCK\b/i,
	/\bNOTIFY\b/i,
	/\bLISTEN\b/i,
	/\bUNLISTEN\b/i,
] as const;

const MAX_ROWS = 500;

// =============================================================================
// EXECUTOR
// =============================================================================

export async function executeRunQuery(
	userId: string,
	query: string,
	db: Db,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	const validationError = validateQuery(query);
	if (validationError) {
		return { success: false, error: validationError };
	}

	try {
		const scopedQuery = buildScopedQuery(userId, query);

		const result = await db.execute(sql.raw(scopedQuery));

		// Limit rows in application layer as a safety net
		const rows = Array.isArray(result) ? result.slice(0, MAX_ROWS) : result;

		return {
			success: true,
			data: rows,
		};
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Unknown database error";
		return {
			success: false,
			error: `SQL error: ${message}`,
		};
	}
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateQuery(query: string): string | null {
	const trimmed = query.trim();

	if (!trimmed) {
		return "Query cannot be empty";
	}

	// Must start with SELECT or WITH
	const upperTrimmed = trimmed.toUpperCase();
	if (!upperTrimmed.startsWith("SELECT") && !upperTrimmed.startsWith("WITH")) {
		return "Only SELECT queries are allowed. Query must start with SELECT or WITH.";
	}

	// Strip string literals and comments to avoid false positives
	const sanitized = trimmed
		.replace(/'[^']*'/g, "''") // Remove string contents
		.replace(/--[^\n]*/g, "") // Remove line comments
		.replace(/\/\*[\s\S]*?\*\//g, ""); // Remove block comments

	// Check for blocked patterns
	for (const pattern of BLOCKED_PATTERNS) {
		if (pattern.test(sanitized)) {
			return `Write operation detected. Only SELECT queries are allowed.`;
		}
	}

	// Block multiple statements (semicolons followed by more SQL)
	const statements = sanitized.split(";").filter((s) => s.trim());
	if (statements.length > 1) {
		return "Multiple SQL statements are not allowed. Send one SELECT query at a time.";
	}

	return null;
}

// =============================================================================
// SCOPED QUERY BUILDER
// =============================================================================

function buildScopedQuery(userId: string, userQuery: string): string {
	// Escape single quotes in userId to prevent SQL injection
	const safeUserId = userId.replace(/'/g, "''");

	const ctes = `WITH user_trades AS (
  SELECT * FROM trade WHERE user_id = '${safeUserId}'
),
user_accounts AS (
  SELECT * FROM account WHERE user_id = '${safeUserId}'
),
user_account_groups AS (
  SELECT * FROM account_group WHERE user_id = '${safeUserId}'
),
user_tags AS (
  SELECT * FROM tag WHERE user_id = '${safeUserId}'
),
user_strategies AS (
  SELECT * FROM strategy WHERE user_id = '${safeUserId}'
),
user_strategy_rules AS (
  SELECT sr.* FROM strategy_rule sr
  INNER JOIN strategy s ON sr.strategy_id = s.id
  WHERE s.user_id = '${safeUserId}'
),
user_trade_tags AS (
  SELECT tt.* FROM trade_tag tt
  INNER JOIN trade t ON tt.trade_id = t.id
  WHERE t.user_id = '${safeUserId}'
),
user_executions AS (
  SELECT te.* FROM trade_execution te
  INNER JOIN trade t ON te.trade_id = t.id
  WHERE t.user_id = '${safeUserId}'
),
user_journals AS (
  SELECT * FROM daily_journal WHERE user_id = '${safeUserId}'
),
user_settings AS (
  SELECT * FROM user_settings WHERE user_id = '${safeUserId}'
),
user_conversations AS (
  SELECT * FROM ai_conversation WHERE user_id = '${safeUserId}'
),
user_reports AS (
  SELECT * FROM ai_report WHERE user_id = '${safeUserId}'
),
user_trade_rule_checks AS (
  SELECT trc.* FROM trade_rule_check trc
  INNER JOIN trade t ON trc.trade_id = t.id
  WHERE t.user_id = '${safeUserId}'
),
user_trade_attachments AS (
  SELECT ta.* FROM trade_attachment ta
  INNER JOIN trade t ON ta.trade_id = t.id
  WHERE t.user_id = '${safeUserId}'
),
user_filter_presets AS (
  SELECT * FROM filter_preset WHERE user_id = '${safeUserId}'
)`;

	// Clean the user query
	let cleanQuery = userQuery.trim();
	if (cleanQuery.endsWith(";")) {
		cleanQuery = cleanQuery.slice(0, -1).trim();
	}

	// Wrap in a subquery with LIMIT to guarantee row cap,
	// even if the user query already has a LIMIT
	return `${ctes}\nSELECT * FROM (${cleanQuery}) AS _result LIMIT ${MAX_ROWS}`;
}
