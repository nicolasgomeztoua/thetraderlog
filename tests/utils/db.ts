import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/server/db/schema";

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let testConn: ReturnType<typeof postgres> | null = null;

/**
 * Get the test database connection.
 * Creates a new connection if one doesn't exist.
 */
export function getTestDb() {
	if (!testDb) {
		const connectionUrl = process.env.TEST_DATABASE_URL;
		if (!connectionUrl) {
			throw new Error(
				"TEST_DATABASE_URL not set. Make sure global-setup.ts ran successfully.",
			);
		}

		testConn = postgres(connectionUrl);
		testDb = drizzle(testConn, { schema });
	}

	return testDb;
}

/**
 * Truncate all tables in the database.
 * Used to reset state between test files.
 */
export async function truncateAllTables() {
	const db = getTestDb();

	// Disable foreign key checks, truncate all tables, re-enable
	// SET client_min_messages suppresses NOTICE about cascades
	await db.execute(sql`
		DO $$ 
		DECLARE
			r RECORD;
			old_client_min_messages TEXT;
		BEGIN
			-- Save current setting and suppress notices
			old_client_min_messages := current_setting('client_min_messages');
			SET client_min_messages = 'warning';
			
			-- Disable triggers
			SET session_replication_role = replica;
			
			-- Truncate all tables in the public schema
			FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
				EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
			END LOOP;
			
			-- Re-enable triggers
			SET session_replication_role = DEFAULT;
			
			-- Restore original setting
			EXECUTE 'SET client_min_messages = ' || quote_literal(old_client_min_messages);
		END $$;
	`);
}

/**
 * Close the test database connection.
 * Should be called after all tests complete.
 */
export async function closeTestDb() {
	if (testConn) {
		await testConn.end();
		testConn = null;
		testDb = null;
	}
}

export { schema };
