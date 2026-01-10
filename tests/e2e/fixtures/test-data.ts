/**
 * E2E Test Data Utilities
 *
 * Provides database seeding and cleanup for E2E tests.
 * Reuses existing integration test fixtures.
 *
 * Note: Playwright test hooks (beforeAll, afterAll) run in Node.js,
 * so we can use direct database access just like integration tests.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/server/db/schema";

export {
	createTestAccount,
	resetAccountCounter,
} from "../../utils/fixtures/accounts";
export {
	setupPropChallenge,
	setupTrader,
	setupTraderWithAnalyticsData,
	setupTraderWithMixedTrades,
	setupTraderWithMultipleAccounts,
	setupTraderWithTrades,
} from "../../utils/fixtures/scenarios";

export {
	createTestTrade,
	createTestTrades,
	resetTradeCounter,
} from "../../utils/fixtures/trades";
// Re-export fixtures for use in E2E tests
export {
	createTestUser,
	resetUserCounter,
} from "../../utils/fixtures/users";

// E2E-specific database utilities
let e2eDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let e2eConn: ReturnType<typeof postgres> | null = null;

/**
 * Get database connection for E2E tests.
 * Uses DATABASE_URL (same as dev server) by default,
 * or TEST_DATABASE_URL if set (for isolated testing).
 */
export function getE2EDb() {
	if (!e2eDb) {
		const connectionUrl =
			process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

		if (!connectionUrl) {
			throw new Error(
				"No database URL found. Set DATABASE_URL or TEST_DATABASE_URL.",
			);
		}

		e2eConn = postgres(connectionUrl);
		e2eDb = drizzle(e2eConn, { schema });
	}

	return e2eDb;
}

/**
 * Truncate all tables in the database.
 * Use with caution - this clears ALL data!
 */
export async function truncateAllTables() {
	const db = getE2EDb();

	await db.execute(sql`
		DO $$
		DECLARE
			r RECORD;
			old_client_min_messages TEXT;
		BEGIN
			old_client_min_messages := current_setting('client_min_messages');
			SET client_min_messages = 'warning';
			SET session_replication_role = replica;

			FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
				EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
			END LOOP;

			SET session_replication_role = DEFAULT;
			EXECUTE 'SET client_min_messages = ' || quote_literal(old_client_min_messages);
		END $$;
	`);
}

/**
 * Delete test data by user clerkId pattern.
 * Safer alternative to truncateAllTables - only removes test data.
 */
export async function cleanupTestUsers(clerkIdPattern = "test-%") {
	const db = getE2EDb();

	// Delete users matching the test pattern (cascade handles related data)
	await db.execute(sql`
		DELETE FROM "user" WHERE "clerkId" LIKE ${clerkIdPattern}
	`);
}

/**
 * Close E2E database connection.
 * Call this in globalTeardown or afterAll.
 */
export async function closeE2EDb() {
	if (e2eConn) {
		await e2eConn.end();
		e2eConn = null;
		e2eDb = null;
	}
}

/**
 * Reset all fixture counters.
 * Call this at the start of each test file for predictable IDs.
 */
export function resetAllCounters() {
	const { resetUserCounter } = require("../../utils/fixtures/users");
	const { resetAccountCounter } = require("../../utils/fixtures/accounts");
	const { resetTradeCounter } = require("../../utils/fixtures/trades");

	resetUserCounter();
	resetAccountCounter();
	resetTradeCounter();
}
