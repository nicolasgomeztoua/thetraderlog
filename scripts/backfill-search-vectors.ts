import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
	buildSearchVectorSql,
	gatherJournalSearchText,
} from "../src/lib/journal/search";
import * as schema from "../src/server/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL environment variable is required");
	process.exit(1);
}

const conn = postgres(DATABASE_URL);
const db = drizzle(conn, { schema });

async function backfill() {
	console.log("Fetching all daily journals...");

	const journals = await db.query.dailyJournals.findMany({
		columns: {
			id: true,
			userId: true,
			date: true,
			content: true,
		},
	});

	console.log(`Found ${journals.length} journals to backfill.`);

	let updated = 0;
	let errors = 0;

	for (const journal of journals) {
		try {
			const texts = await gatherJournalSearchText(db, {
				journalId: journal.id,
				userId: journal.userId,
				content: journal.content,
				date: journal.date,
			});

			const vectorSql = buildSearchVectorSql(texts);

			await db.execute(
				sql`UPDATE daily_journal SET search_vector = ${vectorSql} WHERE id = ${journal.id}`,
			);

			updated++;
			if (updated % 100 === 0) {
				console.log(`  Updated ${updated}/${journals.length}...`);
			}
		} catch (err) {
			errors++;
			console.error(`  Error updating journal ${journal.id}:`, err);
		}
	}

	console.log(
		`\nBackfill complete: ${updated} updated, ${errors} errors out of ${journals.length} total.`,
	);

	await conn.end();
}

backfill().catch((err) => {
	console.error("Backfill failed:", err);
	process.exit(1);
});
