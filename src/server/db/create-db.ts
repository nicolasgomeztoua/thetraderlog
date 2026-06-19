import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Creates a new Drizzle database connection.
 * This factory function allows creating database connections with different URLs,
 * which is essential for testing with Testcontainers.
 */
export function createDatabase(connectionUrl: string) {
	const conn = postgres(connectionUrl);
	return drizzle(conn, { schema });
}

/**
 * Type for the database instance
 */
export type Database = ReturnType<typeof createDatabase>;
