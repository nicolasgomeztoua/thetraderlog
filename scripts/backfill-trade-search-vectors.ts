import { and, isNotNull, isNull, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { updateTradeSearchVector } from "../src/lib/trades/search";
import * as schema from "../src/server/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL environment variable is required");
	process.exit(1);
}

const conn = postgres(DATABASE_URL);
const db = drizzle(conn, { schema });

async function backfill() {
	console.log("Backfilling trade search vectors in batches...");

	const BATCH_SIZE = 100;

	let updated = 0;
	let errors = 0;
	const failedIds = new Set<string>();

	while (true) {
		const tradeRows = await db.query.trades.findMany({
			where: and(
				isNotNull(schema.trades.notes),
				isNull(schema.trades.searchVector),
				isNull(schema.trades.deletedAt),
				failedIds.size > 0
					? notInArray(schema.trades.id, [...failedIds])
					: undefined,
			),
			columns: {
				id: true,
				notes: true,
			},
			orderBy: (t, { asc }) => [asc(t.id)],
			limit: BATCH_SIZE,
		});

		if (tradeRows.length === 0) break;

		if (failedIds.size > 500) {
			console.warn(
				`Warning: ${failedIds.size} failed trades excluded from query. Consider investigating.`,
			);
		}

		for (const trade of tradeRows) {
			try {
				await updateTradeSearchVector(db, {
					tradeId: trade.id,
					notes: trade.notes,
				});

				updated++;
				if (updated % 100 === 0) {
					console.log(`  Updated ${updated}...`);
				}
			} catch (err) {
				errors++;
				failedIds.add(trade.id);
				console.error(`  Error updating trade ${trade.id}:`, err);
			}
		}
	}

	console.log(`\nBackfill complete: ${updated} updated, ${errors} errors.`);

	await conn.end();

	if (errors > 0) {
		process.exit(1);
	}
}

backfill().catch((err) => {
	console.error("Backfill failed:", err);
	process.exit(1);
});
