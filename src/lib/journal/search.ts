import { and, eq, isNotNull, sql } from "drizzle-orm";
import { FORCED_CHECKLIST_LABELS } from "@/lib/constants/checklist";
import type { db as dbType } from "@/server/db";
import {
	dailyChecklistChecks,
	dailyJournals,
	journalAttachments,
} from "@/server/db/schema";

/**
 * Strip HTML tags from content, returning plain text.
 */
export function stripHtmlTags(html: string | null): string {
	if (!html) return "";
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&#160;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.trim();
}

/**
 * Build a weighted tsvector SQL expression from journal-related text.
 *
 * Weights:
 * - A: Journal content (highest relevance)
 * - B: Checklist text and attachment captions
 */
export function buildSearchVectorSql(parts: {
	journalContent: string;
	checklistText: string;
	attachmentCaptions: string;
}) {
	const weightLiterals = {
		A: sql`'A'`,
		B: sql`'B'`,
	} as const satisfies Record<string, ReturnType<typeof sql>>;

	const combined = [
		{ text: parts.journalContent, weight: "A" as const },
		{ text: parts.checklistText, weight: "B" as const },
		{ text: parts.attachmentCaptions, weight: "B" as const },
	]
		.filter((p) => p.text.length > 0)
		.map(
			(p) =>
				sql`setweight(to_tsvector('english', ${p.text}), ${weightLiterals[p.weight]})`,
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
 * Trade notes are indexed separately on the trades table.
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
	checklistText: string;
	attachmentCaptions: string;
}> {
	const journalContent = stripHtmlTags(params.content);

	const [captionRows, checkRows] = await Promise.all([
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
		texts.checklistText,
		texts.attachmentCaptions,
	]
		.filter(Boolean)
		.join(" ");

	await db
		.update(dailyJournals)
		.set({
			searchVector: sql`${vectorSql}` as unknown as string,
			searchPlainText: plainText,
		})
		.where(eq(dailyJournals.id, params.journalId));
}
