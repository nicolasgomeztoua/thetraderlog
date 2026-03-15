import { eq, isNull, sql } from "drizzle-orm";
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

async function getUserTimezone(userId: string): Promise<string> {
	const result = await db.query.userSettings.findFirst({
		where: eq(schema.userSettings.userId, userId),
		columns: { timezone: true },
	});
	return result?.timezone ?? "UTC";
}

async function backfill() {
	console.log("Backfilling search vectors in batches...");

	const BATCH_SIZE = 200;
	// Cache user timezones to avoid repeated lookups
	const timezoneCache = new Map<string, string>();

	let updated = 0;
	let errors = 0;

	while (true) {
		const journals = await db.query.dailyJournals.findMany({
			where: isNull(schema.dailyJournals.searchVector),
			columns: {
				id: true,
				userId: true,
				date: true,
				content: true,
			},
			orderBy: (t, { asc }) => [asc(t.id)],
			limit: BATCH_SIZE,
		});

		if (journals.length === 0) break;

		for (const journal of journals) {
			try {
				let timezone = timezoneCache.get(journal.userId);
				if (!timezone) {
					timezone = await getUserTimezone(journal.userId);
					timezoneCache.set(journal.userId, timezone);
				}

				const texts = await gatherJournalSearchText(db, {
					journalId: journal.id,
					userId: journal.userId,
					content: journal.content,
					date: journal.date,
					timezone,
				});

				const vectorSql = buildSearchVectorSql(texts);
				const plainText = [
					texts.journalContent,
					texts.tradeNotes,
					texts.checklistText,
					texts.attachmentCaptions,
				]
					.filter(Boolean)
					.join(" ");

				await db.execute(
					sql`UPDATE daily_journal SET search_vector = ${vectorSql}, search_plain_text = ${plainText} WHERE id = ${journal.id}`,
				);

				updated++;
				if (updated % 100 === 0) {
					console.log(`  Updated ${updated}...`);
				}
			} catch (err) {
				errors++;
				console.error(`  Error updating journal ${journal.id}:`, err);
			}
		}
	}

	console.log(`\nBackfill complete: ${updated} updated, ${errors} errors.`);

	await conn.end();
}

backfill().catch((err) => {
	console.error("Backfill failed:", err);
	process.exit(1);
});
