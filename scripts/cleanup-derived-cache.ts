/**
 * One-time cleanup script to delete redundant derived-interval rows from candle_cache.
 *
 * Since US-003, only base intervals (1min, 1h) are cached. Derived intervals
 * (5min, 15min, 30min, 4h) are computed on the fly from base data. This script
 * removes any leftover derived-interval rows to reclaim storage.
 *
 * Usage: bun run scripts/cleanup-derived-cache.ts
 *
 * Safe to run multiple times (idempotent).
 */

import { notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { candleCache } from "../src/server/db/schema";

const BASE_INTERVALS = ["1min", "1h"] as const;

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("DATABASE_URL environment variable is required");
		process.exit(1);
	}

	const conn = postgres(databaseUrl);
	const db = drizzle(conn);

	console.info("[cleanup] Deleting derived-interval rows from candle_cache...");
	console.info("[cleanup] Keeping only base intervals: 1min, 1h");

	const result = await db
		.delete(candleCache)
		.where(notInArray(candleCache.interval, [...BASE_INTERVALS]))
		.returning({ id: candleCache.id });

	console.info(`[cleanup] Deleted ${result.length} derived-interval rows`);

	await conn.end();
}

main().catch((err) => {
	console.error("[cleanup] Error:", err);
	process.exit(1);
});
