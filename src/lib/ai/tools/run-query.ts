import { sql } from "drizzle-orm";
import { MAX_SQL_QUERY_ROWS } from "@/lib/constants/ai";
import type { db as DbInstance } from "@/server/db";

type Db = typeof DbInstance;

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
	/\bSELECT\s+INTO\b/i,
	/\bINTO\s+TEMP\b/i,
	/\bINTO\s+TEMPORARY\b/i,
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
	/\bEXECUTE\b/i,
	/\bDO\s+\$/i,
] as const;

/**
 * Dangerous PostgreSQL functions that must never appear in user queries.
 * These can read the server filesystem, cause DoS, or modify configuration.
 */
const BLOCKED_FUNCTIONS = [
	/\bpg_read_file\s*\(/i,
	/\bpg_read_binary_file\s*\(/i,
	/\bpg_ls_dir\s*\(/i,
	/\bpg_sleep\s*\(/i,
	/\blo_import\s*\(/i,
	/\blo_export\s*\(/i,
	/\bdblink\s*\(/i,
	/\bset_config\s*\(/i,
	/\bpg_notify\s*\(/i,
	/\bpg_terminate_backend\s*\(/i,
	/\bpg_cancel_backend\s*\(/i,
] as const;

/**
 * Allowed table names in FROM/JOIN clauses. Only user-scoped CTE aliases are permitted.
 * This prevents cross-tenant data access via raw table names.
 */
const ALLOWED_TABLE_NAMES = new Set([
	"user_trades",
	"user_accounts",
	"user_account_groups",
	"user_tags",
	"user_strategies",
	"user_strategy_rules",
	"user_trade_tags",
	"user_executions",
	"user_journals",
	"user_settings",
	"user_conversations",
	"user_reports",
	"user_trade_rule_checks",
	"user_trade_attachments",
	"user_filter_presets",
]);

const MAX_ROWS = MAX_SQL_QUERY_ROWS;

// =============================================================================
// EXECUTOR
// =============================================================================

export async function executeRunQuery(
	userId: string,
	query: string,
	db: Db,
	accountId?: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	const validationError = validateQuery(query);
	if (validationError) {
		return { success: false, error: validationError };
	}

	try {
		const scopedQuery = buildScopedQuery(userId, query, accountId);

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

	// Block dollar-quoting (used for PL/pgSQL code blocks)
	if (/\$[a-zA-Z_]*\$/.test(trimmed)) {
		return "Dollar-quoted strings are not allowed in queries.";
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

	// Check for dangerous function calls
	for (const pattern of BLOCKED_FUNCTIONS) {
		if (pattern.test(sanitized)) {
			return "Dangerous function call detected. This function is not allowed.";
		}
	}

	// Block multiple statements (semicolons followed by more SQL)
	const statements = sanitized.split(";").filter((s) => s.trim());
	if (statements.length > 1) {
		return "Multiple SQL statements are not allowed. Send one SELECT query at a time.";
	}

	// Extract user-defined CTE names from WITH clauses so they're allowed as table refs.
	// The AI commonly writes queries like: WITH my_agg AS (SELECT ... FROM user_trades ...) SELECT ... FROM my_agg
	const userDefinedCTEs = extractCTENames(sanitized);

	// Validate that all FROM/JOIN table references use allowed CTE aliases only.
	// This prevents cross-tenant data access via raw table names.
	const tableRefError = validateTableReferences(sanitized, userDefinedCTEs);
	if (tableRefError) {
		return tableRefError;
	}

	return null;
}

/**
 * Extract CTE names from WITH clauses in the user query.
 * Handles: WITH cte1 AS (...), cte2 AS (...) SELECT ...
 */
function extractCTENames(sanitized: string): Set<string> {
	const cteNames = new Set<string>();
	// Match CTE definitions: WITH name AS or , name AS
	const cteRegex = /\bWITH\s+(\w+)\s+AS\b/gi;
	const commaCteRegex = /,\s*(\w+)\s+AS\s*\(/gi;

	for (const match of sanitized.matchAll(cteRegex)) {
		if (match[1]) cteNames.add(match[1].toLowerCase());
	}
	for (const match of sanitized.matchAll(commaCteRegex)) {
		if (match[1]) cteNames.add(match[1].toLowerCase());
	}

	return cteNames;
}

/**
 * Validates that all table references in FROM and JOIN clauses use only
 * the user-scoped CTE aliases (or user-defined CTEs within the query).
 * Prevents direct access to raw tables which would bypass user scoping
 * and expose other users' data.
 *
 * Also catches comma-separated table lists (e.g., FROM user_trades, trade)
 * and schema-qualified names (e.g., public.trade).
 */
function validateTableReferences(
	sanitized: string,
	userDefinedCTEs?: Set<string>,
): string | null {
	// Block schema-qualified table names (e.g., public.trade, pg_catalog.pg_class).
	// Only target known PostgreSQL schemas — NOT alias.column refs like t.symbol or s.name.
	if (
		/\b(?:public|pg_catalog|information_schema|pg_temp(?:_\d+)?)\s*\.\s*[a-zA-Z_]/i.test(
			sanitized,
		)
	) {
		return "Schema-qualified table names (e.g., public.tablename) are not allowed.";
	}

	// Strip SQL function uses of FROM before checking table references.
	// EXTRACT(... FROM col), SUBSTRING(... FROM ...), TRIM(... FROM ...) use FROM
	// as a keyword, NOT as a table reference. Remove them to prevent false positives.
	const withoutFunctionFrom = sanitized
		.replace(/\bEXTRACT\s*\([^)]*\bFROM\b[^)]*\)/gi, "EXTRACT(/*removed*/)")
		.replace(/\bSUBSTRING\s*\([^)]*\bFROM\b[^)]*\)/gi, "SUBSTRING(/*removed*/)")
		.replace(/\bTRIM\s*\([^)]*\bFROM\b[^)]*\)/gi, "TRIM(/*removed*/)")
		.replace(/\bOVERLAY\s*\([^)]*\bFROM\b[^)]*\)/gi, "OVERLAY(/*removed*/)");

	// Extract all table names from FROM and JOIN clauses, including comma-separated lists.
	// Captures: FROM table1, table2, table3 and JOIN table_name
	const fromJoinRegex =
		/\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)/gi;

	for (const match of withoutFunctionFrom.matchAll(fromJoinRegex)) {
		const tableList = match[1];
		if (!tableList) continue;

		// Split comma-separated tables and validate each
		const tables = tableList.split(",").map((t) => t.trim());

		for (const rawName of tables) {
			const tableName = rawName.toLowerCase();
			if (!tableName) continue;

			// Skip the wrapper alias used by buildScopedQuery
			if (tableName === "_result") continue;

			// Skip SQL keywords that can appear after FROM/JOIN
			if (tableName === "select" || tableName === "lateral") continue;

			// Allow user-defined CTEs from the same query's WITH clause
			if (userDefinedCTEs?.has(tableName)) continue;

			if (!ALLOWED_TABLE_NAMES.has(tableName)) {
				return `Table "${tableName}" is not allowed. Use the user-scoped aliases: ${[...ALLOWED_TABLE_NAMES].join(", ")}.`;
			}
		}
	}

	return null;
}

// =============================================================================
// SCOPED QUERY BUILDER
// =============================================================================

function buildScopedQuery(
	userId: string,
	userQuery: string,
	accountId?: string,
): string {
	// Escape single quotes in userId/accountId to prevent SQL injection
	const safeUserId = userId.replace(/'/g, "''");
	const safeAccountId = accountId?.replace(/'/g, "''");

	// Account filter for trade-level CTEs:
	// - If specific accountId provided, scope to that account
	// - Otherwise, scope to all active accounts for the user
	const accountFilter = safeAccountId
		? `AND account_id = '${safeAccountId}'`
		: `AND account_id IN (SELECT id FROM account WHERE user_id = '${safeUserId}' AND is_active = true)`;

	// Same filter but using the joined trade alias (t.account_id)
	const joinedAccountFilter = safeAccountId
		? `AND t.account_id = '${safeAccountId}'`
		: `AND t.account_id IN (SELECT id FROM account WHERE user_id = '${safeUserId}' AND is_active = true)`;

	const ctes = `WITH user_trades AS (
  SELECT * FROM trade WHERE user_id = '${safeUserId}' AND deleted_at IS NULL ${accountFilter}
),
user_accounts AS (
  SELECT * FROM account WHERE user_id = '${safeUserId}' AND is_active = true
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
  WHERE t.user_id = '${safeUserId}' AND t.deleted_at IS NULL ${joinedAccountFilter}
),
user_executions AS (
  SELECT te.* FROM trade_execution te
  INNER JOIN trade t ON te.trade_id = t.id
  WHERE t.user_id = '${safeUserId}' AND t.deleted_at IS NULL ${joinedAccountFilter}
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
  WHERE t.user_id = '${safeUserId}' AND t.deleted_at IS NULL ${joinedAccountFilter}
),
user_trade_attachments AS (
  SELECT ta.* FROM trade_attachment ta
  INNER JOIN trade t ON ta.trade_id = t.id
  WHERE t.user_id = '${safeUserId}' AND t.deleted_at IS NULL ${joinedAccountFilter}
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
