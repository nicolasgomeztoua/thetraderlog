/**
 * Integration tests for AI data-access tools.
 *
 * Tests executeRunQuery (SQL tool), executeCallAnalytics (analytics tool),
 * and executeTool (dispatcher) against a real Postgres DB with known fixture data.
 *
 * These are regression tests for two production bugs:
 * 1. call_analytics: internal user ID vs Clerk ID mismatch in auth
 * 2. run_query: contradictory SQL instructions causing valid queries to be rejected
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeCallAnalytics } from "@/lib/ai/tools/call-analytics";
import { executeTool } from "@/lib/ai/tools/index";
import { executeRunQuery } from "@/lib/ai/tools/run-query";
import type { User } from "@/server/db/schema";
import {
	createTestUser,
	getTestDb,
	setupTraderWithAnalyticsData,
	truncateAllTables,
} from "../utils";

// =============================================================================
// SETUP
// =============================================================================

let userA: User;
let userB: User;
const db = getTestDb();

beforeAll(async () => {
	await truncateAllTables();

	// userA: trader with 7 trades and known P&L of 4423
	const fixtureData = await setupTraderWithAnalyticsData();
	userA = fixtureData.user;

	// userB: user with no trades or accounts — for isolation tests
	userB = await createTestUser();
});

afterAll(async () => {
	await truncateAllTables();
});

// =============================================================================
// executeRunQuery — SQL Tool
// =============================================================================

describe("executeRunQuery", () => {
	// -------------------------------------------------------------------------
	// Valid queries
	// -------------------------------------------------------------------------

	describe("valid queries", () => {
		it("should count trades grouped by symbol", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT symbol, COUNT(*) as trade_count FROM user_trades WHERE deleted_at IS NULL GROUP BY symbol ORDER BY trade_count DESC",
				db,
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{
				symbol: string;
				trade_count: string;
			}>;
			expect(rows).toHaveLength(3);

			const esRow = rows.find((r) => r.symbol === "ES");
			const nqRow = rows.find((r) => r.symbol === "NQ");
			const mesRow = rows.find((r) => r.symbol === "MES");

			expect(esRow?.trade_count).toBe("4");
			expect(nqRow?.trade_count).toBe("2");
			expect(mesRow?.trade_count).toBe("1");
		});

		it("should sum net_pnl with CAST to get total P&L", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT SUM(CAST(net_pnl AS NUMERIC)) as total_pnl FROM user_trades WHERE deleted_at IS NULL",
				db,
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{ total_pnl: string }>;
			expect(rows).toHaveLength(1);
			expect(Number.parseFloat(rows[0]?.total_pnl ?? "0")).toBeCloseTo(4423, 0);
		});

		it("should support queries across multiple user-scoped CTEs", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT COUNT(*) as trade_count FROM user_trades WHERE account_id IN (SELECT id FROM user_accounts) AND deleted_at IS NULL",
				db,
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{ trade_count: string }>;
			expect(rows).toHaveLength(1);
			expect(rows[0]?.trade_count).toBe("7");
		});

		it("should allow table alias dot notation in JOINs (t.column, s.column)", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT t.symbol, t.direction, CAST(t.net_pnl AS NUMERIC) AS pnl FROM user_trades t WHERE t.deleted_at IS NULL ORDER BY t.entry_time DESC LIMIT 5",
				db,
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{ symbol: string }>;
			expect(rows.length).toBeGreaterThan(0);
		});

		it("should handle trailing semicolons gracefully", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT COUNT(*) as cnt FROM user_trades WHERE deleted_at IS NULL;",
				db,
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{ cnt: string }>;
			expect(rows[0]?.cnt).toBe("7");
		});
	});

	// -------------------------------------------------------------------------
	// User scoping / isolation
	// -------------------------------------------------------------------------

	describe("user scoping / isolation", () => {
		it("should return 0 trades for userB and 7 for userA with the same query", async () => {
			const query =
				"SELECT COUNT(*) as cnt FROM user_trades WHERE deleted_at IS NULL";

			const resultA = await executeRunQuery(userA.id, query, db);
			const resultB = await executeRunQuery(userB.id, query, db);

			expect(resultA.success).toBe(true);
			expect(resultB.success).toBe(true);

			const rowsA = resultA.data as Array<{ cnt: string }>;
			const rowsB = resultB.data as Array<{ cnt: string }>;

			expect(rowsA[0]?.cnt).toBe("7");
			expect(rowsB[0]?.cnt).toBe("0");
		});

		it("should scope user_accounts correctly", async () => {
			const query = "SELECT COUNT(*) as cnt FROM user_accounts";

			const resultA = await executeRunQuery(userA.id, query, db);
			const resultB = await executeRunQuery(userB.id, query, db);

			expect(resultA.success).toBe(true);
			expect(resultB.success).toBe(true);

			const rowsA = resultA.data as Array<{ cnt: string }>;
			const rowsB = resultB.data as Array<{ cnt: string }>;

			expect(rowsA[0]?.cnt).toBe("1");
			expect(rowsB[0]?.cnt).toBe("0");
		});
	});

	// -------------------------------------------------------------------------
	// Table name validation — bug fix #2 regression tests
	// -------------------------------------------------------------------------

	describe("table name validation (bug fix #2 regression)", () => {
		it('should reject raw "FROM trade"', async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT * FROM trade WHERE deleted_at IS NULL",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not allowed");
		});

		it('should reject raw "FROM account"', async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT * FROM account",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not allowed");
		});

		it('should accept "FROM user_trades"', async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT COUNT(*) as cnt FROM user_trades WHERE deleted_at IS NULL",
				db,
			);

			expect(result.success).toBe(true);
		});

		it('should reject schema-qualified "public.trade"', async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT * FROM public.trade",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not allowed");
		});

		it('should reject comma bypass "FROM user_trades, trade"', async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT * FROM user_trades, trade",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not allowed");
		});

		it("should allow user-defined CTEs that reference user-scoped tables", async () => {
			const result = await executeRunQuery(
				userA.id,
				"WITH winning_trades AS (SELECT * FROM user_trades WHERE CAST(net_pnl AS NUMERIC) > 0 AND deleted_at IS NULL) SELECT COUNT(*) as cnt FROM winning_trades",
				db,
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{ cnt: string }>;
			expect(Number(rows[0]?.cnt)).toBeGreaterThan(0);
		});

		it("should allow multiple user-defined CTEs", async () => {
			const result = await executeRunQuery(
				userA.id,
				"WITH wins AS (SELECT * FROM user_trades WHERE CAST(net_pnl AS NUMERIC) > 0 AND deleted_at IS NULL), losses AS (SELECT * FROM user_trades WHERE CAST(net_pnl AS NUMERIC) < 0 AND deleted_at IS NULL) SELECT (SELECT COUNT(*) FROM wins) as win_count, (SELECT COUNT(*) FROM losses) as loss_count",
				db,
			);

			expect(result.success).toBe(true);
		});

		it("should allow EXTRACT(... FROM column) without false positive", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT EXTRACT(HOUR FROM entry_time) AS entry_hour, COUNT(*) AS cnt FROM user_trades GROUP BY entry_hour",
				db,
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{ entry_hour: number; cnt: string }>;
			expect(rows.length).toBeGreaterThan(0);
		});

		it("should allow EXTRACT with table alias (EXTRACT FROM t.column)", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT EXTRACT(HOUR FROM t.entry_time) AS entry_hour, t.symbol FROM user_trades t GROUP BY entry_hour, t.symbol",
				db,
			);

			expect(result.success).toBe(true);
		});

		it("should reject user-defined CTEs that reference raw tables inside", async () => {
			const result = await executeRunQuery(
				userA.id,
				"WITH evil AS (SELECT * FROM trade) SELECT * FROM evil",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not allowed");
		});
	});

	// -------------------------------------------------------------------------
	// Blocked patterns
	// -------------------------------------------------------------------------

	describe("blocked patterns", () => {
		it("should reject INSERT INTO", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT 1; INSERT INTO user_trades (symbol) VALUES ('HACK')",
				db,
			);

			expect(result.success).toBe(false);
			// Could be "Only SELECT" or "Multiple SQL statements"
			expect(result.error).toBeDefined();
		});

		it("should reject SELECT INTO", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT * INTO temp_table FROM user_trades",
				db,
			);

			expect(result.success).toBe(false);
			// May be caught by validator ("Write operation detected") or by Postgres
			// when the query is wrapped in a subquery ("SELECT ... INTO is not allowed here")
			expect(result.error).toBeDefined();
		});

		it("should reject CTE-wrapped INSERT", async () => {
			const result = await executeRunQuery(
				userA.id,
				"WITH x AS (SELECT 1) INSERT INTO user_trades (symbol) VALUES ('HACK')",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Write operation detected");
		});

		it("should reject DROP TABLE", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT 1; DROP TABLE trade",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// Blocked functions
	// -------------------------------------------------------------------------

	describe("blocked functions", () => {
		it("should reject pg_read_file", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT pg_read_file('/etc/passwd')",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Dangerous function");
		});

		it("should reject pg_sleep", async () => {
			const result = await executeRunQuery(userA.id, "SELECT pg_sleep(10)", db);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Dangerous function");
		});

		it("should reject dblink", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT * FROM dblink('host=evil.com', 'SELECT 1')",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Dangerous function");
		});
	});

	// -------------------------------------------------------------------------
	// Edge cases
	// -------------------------------------------------------------------------

	describe("edge cases", () => {
		it("should reject empty query", async () => {
			const result = await executeRunQuery(userA.id, "", db);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Query cannot be empty");
		});

		it("should reject EXPLAIN", async () => {
			const result = await executeRunQuery(
				userA.id,
				"EXPLAIN SELECT * FROM user_trades",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Only SELECT queries");
		});

		it("should return SQL error gracefully for invalid column", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT nonexistent_column FROM user_trades",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("SQL error");
		});

		it("should reject dollar-quoted strings", async () => {
			const result = await executeRunQuery(
				userA.id,
				"SELECT $$malicious code$$",
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Dollar-quoted strings");
		});
	});
});

// =============================================================================
// executeCallAnalytics — Analytics Tool
// =============================================================================

describe("executeCallAnalytics", () => {
	// -------------------------------------------------------------------------
	// Valid endpoints
	// -------------------------------------------------------------------------

	describe("valid endpoints", () => {
		it("should return overview with 7 trades and P&L ≈ 4423", async () => {
			const result = await executeCallAnalytics(
				userA.id,
				"analytics",
				"getOverview",
				undefined,
				db,
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();

			const data = result.data as { totalTrades: number; totalPnl: number };
			expect(data.totalTrades).toBe(7);
			expect(data.totalPnl).toBeCloseTo(4423, 0);
		});

		it("should return performance by symbol with ES, NQ, MES", async () => {
			const result = await executeCallAnalytics(
				userA.id,
				"analytics",
				"getPerformanceBySymbol",
				undefined,
				db,
			);

			expect(result.success).toBe(true);
			const data = result.data as Array<{ symbol: string }>;
			const symbols = data.map((d) => d.symbol);
			expect(symbols).toContain("ES");
			expect(symbols).toContain("NQ");
			expect(symbols).toContain("MES");
		});

		it("should return trade stats from trades router", async () => {
			const result = await executeCallAnalytics(
				userA.id,
				"trades",
				"getStats",
				undefined,
				db,
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();

			const data = result.data as {
				totalTrades: number;
				totalPnl: number;
			};
			expect(data.totalTrades).toBe(7);
		});
	});

	// -------------------------------------------------------------------------
	// User ID resolution — bug fix #1 regression tests
	// -------------------------------------------------------------------------

	describe("user ID resolution (bug fix #1 regression)", () => {
		it("should resolve internal user ID correctly and return real data", async () => {
			// This is the critical regression test — the bug was that the tool
			// received an internal ID but the tRPC context expected a clerkId
			const result = await executeCallAnalytics(
				userA.id,
				"analytics",
				"getOverview",
				undefined,
				db,
			);

			expect(result.success).toBe(true);
			const data = result.data as { totalTrades: number };
			expect(data.totalTrades).toBe(7);
		});

		it("should return error for nonexistent user ID", async () => {
			const result = await executeCallAnalytics(
				"usr_nonexistent_12345",
				"analytics",
				"getOverview",
				undefined,
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("User not found");
		});
	});

	// -------------------------------------------------------------------------
	// Invalid router/endpoint
	// -------------------------------------------------------------------------

	describe("invalid router/endpoint", () => {
		it('should reject invalid router "settings"', async () => {
			const result = await executeCallAnalytics(
				userA.id,
				"settings",
				"getAll",
				undefined,
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Invalid router");
		});

		it('should reject disallowed endpoint "deleteAllTrades"', async () => {
			const result = await executeCallAnalytics(
				userA.id,
				"analytics",
				"deleteAllTrades",
				undefined,
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not allowed");
		});

		it('should reject disallowed trades endpoint "delete"', async () => {
			const result = await executeCallAnalytics(
				userA.id,
				"trades",
				"delete",
				undefined,
				db,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not allowed");
		});
	});

	// -------------------------------------------------------------------------
	// User isolation
	// -------------------------------------------------------------------------

	describe("user isolation", () => {
		it("should return 0 trades for userB (never userA data)", async () => {
			const result = await executeCallAnalytics(
				userB.id,
				"analytics",
				"getOverview",
				undefined,
				db,
			);

			expect(result.success).toBe(true);
			const data = result.data as { totalTrades: number };
			expect(data.totalTrades).toBe(0);
		});
	});
});

// =============================================================================
// executeTool — Dispatcher
// =============================================================================

describe("executeTool", () => {
	// -------------------------------------------------------------------------
	// Routing
	// -------------------------------------------------------------------------

	describe("routing", () => {
		it("should route run_query correctly and return data", async () => {
			const result = await executeTool(
				"run_query",
				{
					query:
						"SELECT COUNT(*) as cnt FROM user_trades WHERE deleted_at IS NULL",
				},
				{ userId: userA.id, db },
			);

			expect(result.success).toBe(true);
			const rows = result.data as Array<{ cnt: string }>;
			expect(rows[0]?.cnt).toBe("7");
		});

		it("should route call_analytics correctly and return data", async () => {
			const result = await executeTool(
				"call_analytics",
				{ router: "analytics", endpoint: "getOverview" },
				{ userId: userA.id, db },
			);

			expect(result.success).toBe(true);
			const data = result.data as { totalTrades: number };
			expect(data.totalTrades).toBe(7);
		});

		it('should return "Unknown tool" for invalid tool name', async () => {
			const result = await executeTool(
				"hack_server",
				{},
				{ userId: userA.id, db },
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Unknown tool");
		});
	});

	// -------------------------------------------------------------------------
	// Missing params
	// -------------------------------------------------------------------------

	describe("missing params", () => {
		it("should reject run_query without query param", async () => {
			const result = await executeTool(
				"run_query",
				{},
				{ userId: userA.id, db },
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Missing required parameter");
		});

		it("should reject run_query without db in context", async () => {
			const result = await executeTool(
				"run_query",
				{ query: "SELECT 1" },
				{ userId: userA.id },
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Database instance required");
		});

		it("should reject call_analytics without router/endpoint", async () => {
			const result = await executeTool(
				"call_analytics",
				{},
				{ userId: userA.id, db },
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Missing required parameters");
		});
	});
});
