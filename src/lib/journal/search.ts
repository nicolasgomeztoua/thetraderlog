import { and, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { FORCED_CHECKLIST_LABELS } from "@/lib/constants/checklist";
import {
	getDayBoundsInTimezone,
	getUTCDateString,
} from "@/lib/shared/timezone";
import type { db as dbType } from "@/server/db";
import {
	dailyChecklistChecks,
	journalAttachments,
	trades,
} from "@/server/db/schema";

/**
 * Strip HTML tags from content, returning plain text.
 * Reuses the same regex pattern from getJournalAdjacency.
 */
export function stripHtmlTags(html: string | null): string {
	if (!html) return "";
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&#160;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/<[^>]*>/g, " ")
		.trim();
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
	const weightLiterals: Record<string, ReturnType<typeof sql>> = {
		A: sql`'A'`,
		B: sql`'B'`,
		C: sql`'C'`,
		D: sql`'D'`,
	};

	const combined = [
		{ text: parts.journalContent, weight: "A" },
		{ text: parts.tradeNotes, weight: "B" },
		{ text: parts.checklistText, weight: "C" },
		{ text: parts.attachmentCaptions, weight: "C" },
	]
		.filter((p) => p.text.length > 0)
		.map(
			(p) =>
				sql`setweight(to_tsvector('english', ${p.text}), ${weightLiterals[p.weight] ?? weightLiterals.D})`,
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
		timezone: string;
	},
): Promise<{
	journalContent: string;
	tradeNotes: string;
	checklistText: string;
	attachmentCaptions: string;
}> {
	const journalContent = stripHtmlTags(params.content);

	// Gather trade notes for this date using timezone-aware day boundaries
	const dateString = getUTCDateString(params.date);
	const { start: startOfDay, end: endOfDay } = getDayBoundsInTimezone(
		dateString,
		params.timezone,
	);

	const [tradeRows, captionRows, checkRows] = await Promise.all([
		db.query.trades.findMany({
			where: and(
				eq(trades.userId, params.userId),
				gte(trades.entryTime, startOfDay),
				lt(trades.entryTime, endOfDay),
				isNull(trades.deletedAt),
				isNotNull(trades.notes),
			),
			columns: { notes: true },
		}),
		db.query.journalAttachments.findMany({
			where: and(
				eq(journalAttachments.journalId, params.journalId),
				isNotNull(journalAttachments.caption),
			),
			columns: { caption: true },
		}),
		db.query.dailyChecklistChecks.findMany({
			where: and(
				eq(dailyChecklistChecks.journalId, params.journalId),
				eq(dailyChecklistChecks.checked, true),
			),
			with: {
				template: {
					columns: { text: true },
				},
			},
		}),
	]);
	const tradeNotes = tradeRows
		.map((r) => r.notes ?? "")
		.filter(Boolean)
		.join(" ");
	const attachmentCaptions = captionRows
		.map((r) => r.caption ?? "")
		.filter(Boolean)
		.join(" ");
	const checklistText = checkRows
		.map(
			(r) =>
				r.template?.text ??
				(r.forcedItemId ? (FORCED_CHECKLIST_LABELS[r.forcedItemId] ?? "") : ""),
		)
		.filter(Boolean)
		.join(" ");

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
		timezone: string;
	},
): Promise<void> {
	const texts = await gatherJournalSearchText(db, params);
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
		sql`UPDATE daily_journal SET search_vector = ${vectorSql}, search_plain_text = ${plainText} WHERE id = ${params.journalId}`,
	);
}
