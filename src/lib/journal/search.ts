import { and, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { db as dbType } from "@/server/db";
import {
	dailyChecklistTemplates,
	journalAttachments,
	trades,
} from "@/server/db/schema";

/**
 * Strip HTML tags from content, returning plain text.
 * Reuses the same regex pattern from getJournalAdjacency.
 */
export function stripHtmlTags(html: string | null): string {
	if (!html) return "";
	return html.replace(/<[^>]*>/g, " ").trim();
}

/**
 * Build a weighted tsvector SQL expression from journal-related text.
 *
 * Weights:
 * - A: Journal content (highest relevance)
 * - B: Trade notes
 * - C: Checklist text and attachment captions
 */
export function buildSearchVectorSql(parts: {
	journalContent: string;
	tradeNotes: string;
	checklistText: string;
	attachmentCaptions: string;
}) {
	const combined = [
		{ text: parts.journalContent, weight: "A" },
		{ text: parts.tradeNotes, weight: "B" },
		{ text: parts.checklistText, weight: "C" },
		{ text: parts.attachmentCaptions, weight: "C" },
	]
		.filter((p) => p.text.length > 0)
		.map(
			(p) =>
				sql`setweight(to_tsvector('english', ${p.text}), ${sql.raw(`'${p.weight}'`)})`,
		);

	if (combined.length === 0) {
		return sql`to_tsvector('english', '')`;
	}

	// Concatenate tsvectors with ||
	let result = combined[0] ?? sql`to_tsvector('english', '')`;
	for (let i = 1; i < combined.length; i++) {
		result = sql`${result} || ${combined[i]}`;
	}

	return result;
}

/**
 * Gather all text related to a journal entry for search indexing.
 */
export async function gatherJournalSearchText(
	db: typeof dbType,
	params: {
		journalId: string;
		userId: string;
		content: string | null;
		date: Date;
	},
): Promise<{
	journalContent: string;
	tradeNotes: string;
	checklistText: string;
	attachmentCaptions: string;
}> {
	const journalContent = stripHtmlTags(params.content);

	// Gather trade notes for this date (trades within the same UTC day)
	const startOfDay = new Date(params.date);
	startOfDay.setUTCHours(0, 0, 0, 0);
	const endOfDay = new Date(startOfDay);
	endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

	const tradeRows = await db.query.trades.findMany({
		where: and(
			eq(trades.userId, params.userId),
			gte(trades.entryTime, startOfDay),
			lt(trades.entryTime, endOfDay),
			isNull(trades.deletedAt),
			isNotNull(trades.notes),
		),
		columns: { notes: true },
	});
	const tradeNotes = tradeRows
		.map((r) => r.notes ?? "")
		.filter(Boolean)
		.join(" ");

	// Gather attachment captions for this journal
	const captionRows = await db.query.journalAttachments.findMany({
		where: and(
			eq(journalAttachments.journalId, params.journalId),
			isNotNull(journalAttachments.caption),
		),
		columns: { caption: true },
	});
	const attachmentCaptions = captionRows
		.map((r) => r.caption ?? "")
		.filter(Boolean)
		.join(" ");

	// Gather checklist template text for this user's active templates
	const templateRows = await db.query.dailyChecklistTemplates.findMany({
		where: and(
			eq(dailyChecklistTemplates.userId, params.userId),
			eq(dailyChecklistTemplates.isActive, true),
		),
		columns: { text: true },
	});
	const checklistText = templateRows.map((r) => r.text).join(" ");

	return {
		journalContent,
		tradeNotes,
		checklistText,
		attachmentCaptions,
	};
}

/**
 * Update the search vector for a journal entry.
 */
export async function updateJournalSearchVector(
	db: typeof dbType,
	params: {
		journalId: string;
		userId: string;
		content: string | null;
		date: Date;
	},
): Promise<void> {
	const texts = await gatherJournalSearchText(db, params);
	const vectorSql = buildSearchVectorSql(texts);

	await db.execute(
		sql`UPDATE daily_journal SET search_vector = ${vectorSql} WHERE id = ${params.journalId}`,
	);
}
