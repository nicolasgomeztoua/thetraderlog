import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
	readConn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

const readConn =
	globalForDb.readConn ?? postgres(env.DATABASE_READ_URL ?? env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.readConn = readConn;

export const db = drizzle(conn, { schema });
export const dbReadOnly = drizzle(readConn, { schema });
