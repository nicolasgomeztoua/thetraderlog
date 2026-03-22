import { eq, sql } from "drizzle-orm";
import { stripHtmlTags } from "@/lib/journal/search";
import type { db as dbType } from "@/server/db";
import { trades } from "@/server/db/schema";

/**
 * Update the search vector for a trade's notes.
 * Sets both columns to null if notes are empty.
 */
export async function updateTradeSearchVector(
	db: typeof dbType,
	params: { tradeId: string; notes: string | null },
): Promise<void> {
	const plainText = stripHtmlTags(params.notes);

	if (!plainText) {
		await db
			.update(trades)
			.set({
				searchVector: sql`NULL` as unknown as string,
				searchPlainText: null,
			})
			.where(eq(trades.id, params.tradeId));
		return;
	}

	await db
		.update(trades)
		.set({
			searchVector:
				sql`to_tsvector('english', ${plainText})` as unknown as string,
			searchPlainText: plainText,
		})
		.where(eq(trades.id, params.tradeId));
}
