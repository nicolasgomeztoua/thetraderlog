import {
	and,
	asc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
	ERR_ATTACHMENT_CREATE_FAILED,
	ERR_ATTACHMENT_NOT_FOUND,
	ERR_CHECKLIST_AUTO_CALCULATED,
	ERR_JOURNAL_CREATE_FAILED,
	ERR_JOURNAL_FIND_OR_CREATE_FAILED,
	ERR_JOURNAL_NOT_FOUND,
	ERR_S3_NOT_CONFIGURED,
	ERR_TEMPLATE_CREATE_FAILED,
	ERR_TEMPLATE_NOT_FOUND,
	errTemplateNotOwned,
} from "@/lib/constants/errors";
import {
	SEARCH_DEFAULT_LIMIT,
	SEARCH_MIN_QUERY_LENGTH,
} from "@/lib/constants/search";
import { updateJournalSearchVector } from "@/lib/journal/search";
import {
	getDateStringInTimezone,
	getDayBoundsInTimezone,
	getUTCDateString,
} from "@/lib/shared";
import {
	deleteObject,
	getPresignedDownloadUrl,
	getPresignedUploadUrl,
	isS3Configured,
	transformHtmlWithPresignedUrls,
} from "@/lib/storage/s3";
import { getUserTimezone } from "@/server/api/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	dailyChecklistChecks,
	dailyChecklistTemplates,
	dailyJournals,
	journalAttachments,
	trades,
} from "@/server/db/schema";

// Helper to normalize date to midnight UTC
function normalizeDate(date: Date): Date {
	const normalized = new Date(date);
	normalized.setUTCHours(0, 0, 0, 0);
	return normalized;
}

// Helper to find or create a journal for a date, handling race conditions
async function findOrCreateJournal(
	db: typeof import("@/server/db").db,
	userId: string,
	date: Date,
) {
	// Try to find existing journal
	const existing = await db.query.dailyJournals.findFirst({
		where: and(eq(dailyJournals.userId, userId), eq(dailyJournals.date, date)),
	});

	if (existing) {
		return existing;
	}

	// Try to insert, using onConflictDoNothing to handle race conditions
	const [created] = await db
		.insert(dailyJournals)
		.values({
			userId,
			date,
			content: null,
			contentFormat: "html",
		})
		.onConflictDoNothing({
			target: [dailyJournals.userId, dailyJournals.date],
		})
		.returning();

	// If insert succeeded, return the created record
	if (created) {
		return created;
	}

	// If insert was a no-op due to conflict, fetch the existing record
	const journal = await db.query.dailyJournals.findFirst({
		where: and(eq(dailyJournals.userId, userId), eq(dailyJournals.date, date)),
	});

	if (!journal) {
		throw new Error(ERR_JOURNAL_FIND_OR_CREATE_FAILED);
	}

	return journal;
}

// Type for attachment from database
interface AttachmentRecord {
	id: string;
	journalId: string;
	url: string; // Contains S3 key
	key: string | null;
	filename: string;
	mimeType: string;
	size: number;
	caption: string | null;
	createdAt: Date;
}

// Helper to generate presigned URLs for attachments on-demand
function withPresignedUrls<T extends { attachments: AttachmentRecord[] }>(
	journal: T,
): T {
	if (!isS3Configured()) {
		return journal;
	}

	return {
		...journal,
		attachments: journal.attachments.map((attachment) => ({
			...attachment,
			// Generate fresh presigned URL from the stored key
			url: getPresignedDownloadUrl(attachment.key ?? attachment.url, 3600), // 1 hour expiry
		})),
	};
}

export const dailyJournalRouter = createTRPCRouter({
	// ============================================================================
	// JOURNAL MUTATIONS
	// ============================================================================

	// Update journal content (upsert)
	updateContent: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string
				content: z.string().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Try to find existing journal
			const existing = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					eq(dailyJournals.date, normalizedDate),
				),
			});

			if (existing) {
				// Update existing journal
				const [updated] = await ctx.db
					.update(dailyJournals)
					.set({
						content: input.content,
						updatedAt: new Date(),
					})
					.where(eq(dailyJournals.id, existing.id))
					.returning();

				// Update search vector asynchronously (non-blocking)
				// Fetch timezone lazily to avoid extra DB round-trip on the hot path
				void getUserTimezone(ctx.db, ctx.user.id)
					.then((timezone) =>
						updateJournalSearchVector(ctx.db, {
							journalId: existing.id,
							userId: ctx.user.id,
							content: input.content,
							date: normalizedDate,
							timezone,
						}),
					)
					.catch((err) => {
						console.error("Failed to update search vector:", err);
					});

				return updated;
			}

			// Create new journal with content
			const [created] = await ctx.db
				.insert(dailyJournals)
				.values({
					userId: ctx.user.id,
					date: normalizedDate,
					content: input.content,
					contentFormat: "html",
				})
				.returning();

			if (!created) {
				throw new Error(ERR_JOURNAL_CREATE_FAILED);
			}

			// Update search vector asynchronously (non-blocking)
			// Fetch timezone lazily to avoid extra DB round-trip on the hot path
			void getUserTimezone(ctx.db, ctx.user.id)
				.then((timezone) =>
					updateJournalSearchVector(ctx.db, {
						journalId: created.id,
						userId: ctx.user.id,
						content: input.content,
						date: normalizedDate,
						timezone,
					}),
				)
				.catch((err) => {
					console.error("Failed to update search vector:", err);
				});

			return created;
		}),

	// Start journal for a day (marks the day as actively started)
	startDay: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Find or create journal for this date
			const journal = await findOrCreateJournal(
				ctx.db,
				ctx.user.id,
				normalizedDate,
			);

			// If already started, return as-is
			if (journal.dayStartedAt) {
				return journal;
			}

			// Set dayStartedAt timestamp
			const [updated] = await ctx.db
				.update(dailyJournals)
				.set({
					dayStartedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(dailyJournals.id, journal.id))
				.returning();

			return updated;
		}),

	// ============================================================================
	// JOURNAL QUERIES
	// ============================================================================

	// Search across journal entries by keyword
	search: protectedProcedure
		.input(
			z.object({
				query: z.string().min(SEARCH_MIN_QUERY_LENGTH),
				limit: z.number().int().min(1).max(50).default(SEARCH_DEFAULT_LIMIT),
			}),
		)
		.query(async ({ ctx, input }) => {
			const results = await ctx.db.execute<{
				id: string;
				date: Date;
				snippet: string;
				rank: number;
			}>(
				sql`WITH search_query AS (
					SELECT plainto_tsquery('english', ${input.query}) AS q
				)
				(SELECT
					dj.id,
					dj.date,
					ts_headline('english', COALESCE(dj.search_plain_text, regexp_replace(COALESCE(dj.content, ''), '<[^>]*>', ' ', 'g')), sq.q,
						'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'
					) AS snippet,
					ts_rank(dj.search_vector, sq.q, 1) AS rank
				FROM daily_journal dj, search_query sq
				WHERE dj.user_id = ${ctx.user.id}
					AND dj.search_vector @@ sq.q)
				UNION ALL
				(SELECT
					dj.id,
					dj.date,
					ts_headline('english', stripped.plain_text, sq.q,
						'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'
					) AS snippet,
					ts_rank(stripped.vec, sq.q, 1) AS rank
				FROM daily_journal dj, search_query sq,
				LATERAL (SELECT
					regexp_replace(COALESCE(dj.content, ''), '<[^>]*>', ' ', 'g') AS plain_text,
					to_tsvector('english', regexp_replace(COALESCE(dj.content, ''), '<[^>]*>', ' ', 'g')) AS vec
				) stripped
				WHERE dj.user_id = ${ctx.user.id}
					AND dj.search_vector IS NULL
					AND dj.content IS NOT NULL
					AND stripped.vec @@ sq.q)
				ORDER BY rank DESC
				LIMIT ${input.limit}`,
			);

			return (Array.isArray(results) ? results : []).map((row) => ({
				journalId: row.id,
				date: row.date,
				snippet: row.snippet,
				rank: row.rank,
			}));
		}),

	// Get journal by date, auto-create if not exists
	getByDate: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string (YYYY-MM-DD or full ISO)
			}),
		)
		.query(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Find or create journal for this date (handles race conditions)
			const baseJournal = await findOrCreateJournal(
				ctx.db,
				ctx.user.id,
				normalizedDate,
			);

			// Fetch with relations
			const journal = await ctx.db.query.dailyJournals.findFirst({
				where: eq(dailyJournals.id, baseJournal.id),
				with: {
					attachments: true,
					checklistChecks: {
						with: {
							template: true,
						},
					},
				},
			});

			// Generate presigned URLs for attachments and content images on-demand
			if (journal) {
				const withAttachmentUrls = withPresignedUrls(journal);
				return {
					...withAttachmentUrls,
					content: transformHtmlWithPresignedUrls(withAttachmentUrls.content),
				};
			}
			return journal;
		}),

	// Get journals for a date range (for calendar display)
	getRange: protectedProcedure
		.input(
			z.object({
				startDate: z.string(), // ISO date string
				endDate: z.string(), // ISO date string
			}),
		)
		.query(async ({ ctx, input }) => {
			const startNormalized = normalizeDate(new Date(input.startDate));
			const endNormalized = normalizeDate(new Date(input.endDate));

			const journals = await ctx.db.query.dailyJournals.findMany({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					gte(dailyJournals.date, startNormalized),
					lte(dailyJournals.date, endNormalized),
				),
				columns: {
					id: true,
					date: true,
					content: true,
					createdAt: true,
					updatedAt: true,
				},
			});

			// Transform to include hasContent indicator for calendar display
			return journals.map((journal) => ({
				id: journal.id,
				date: journal.date,
				hasContent: journal.content !== null && journal.content.trim() !== "",
				createdAt: journal.createdAt,
				updatedAt: journal.updatedAt,
			}));
		}),

	// Get multiple journals by specific dates (batch fetch for dashboard widgets)
	getBatchByDates: protectedProcedure
		.input(
			z.object({
				dates: z.array(z.string()), // Array of ISO date strings (YYYY-MM-DD or full ISO)
			}),
		)
		.query(async ({ ctx, input }) => {
			if (input.dates.length === 0) {
				return [];
			}

			const normalizedDates = input.dates.map((d) =>
				normalizeDate(new Date(d)),
			);

			const journals = await ctx.db.query.dailyJournals.findMany({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					inArray(dailyJournals.date, normalizedDates),
				),
			});

			return journals;
		}),

	// Get journal with trades for a specific date
	getWithTrades: protectedProcedure
		.input(
			z.object({
				date: z.string(), // YYYY-MM-DD date string in user's timezone
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get user's timezone for trade filtering
			const userTimezone = await getUserTimezone(ctx.db, ctx.user.id);

			// Journal uses UTC midnight for storage (date only, no time component)
			const normalizedDate = normalizeDate(new Date(input.date));

			// Get UTC bounds for the day in user's timezone (for trade filtering)
			const { start: dayStart, end: dayEnd } = getDayBoundsInTimezone(
				input.date,
				userTimezone,
			);

			// Find or create journal for this date (handles race conditions)
			const baseJournal = await findOrCreateJournal(
				ctx.db,
				ctx.user.id,
				normalizedDate,
			);

			// Fetch with relations
			const journal = await ctx.db.query.dailyJournals.findFirst({
				where: eq(dailyJournals.id, baseJournal.id),
				with: {
					attachments: true,
					checklistChecks: {
						with: {
							template: true,
						},
					},
				},
			});

			// Get trades for the date (filter by entry time within the day in user's timezone)
			const tradesForDate = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					gte(trades.entryTime, dayStart),
					lt(trades.entryTime, dayEnd),
					isNull(trades.deletedAt),
					isNotNull(trades.accountId),
				),
				with: {
					account: true,
					tradeTags: {
						with: {
							tag: true,
						},
					},
				},
				orderBy: (trades, { asc }) => [asc(trades.entryTime)],
			});

			// Build forced checklist items based on conditions
			const forcedItems: Array<{
				id: string;
				text: string;
				isForced: true;
				checked: boolean;
				autoChecked: boolean;
			}> = [];

			const hasTrades = tradesForDate.length > 0;
			const dayStarted = journal?.dayStartedAt !== null;

			// Pre Market Check - show if day started OR has trades
			if (dayStarted || hasTrades) {
				// Check if pre-market check exists in checklist checks (uses forcedItemId column)
				const preMarketCheck = journal?.checklistChecks?.find(
					(c) => c.forcedItemId === "forced-pre-market",
				);
				forcedItems.push({
					id: "forced-pre-market",
					text: "Pre Market Check",
					isForced: true,
					checked: preMarketCheck?.checked ?? false,
					autoChecked: false, // Manual toggle
				});
			}

			// SL Check - show if has trades, auto-check if ALL trades have stopLoss
			if (hasTrades) {
				const allTradesHaveSL = tradesForDate.every((t) => t.stopLoss !== null);
				forcedItems.push({
					id: "forced-sl-check",
					text: "Added SL to all trades",
					isForced: true,
					checked: allTradesHaveSL, // Auto-calculated from trade data
					autoChecked: true, // Can't manually toggle - reflects reality
				});
			}

			// Generate presigned URLs for attachments and content images on-demand
			let processedJournal = journal;
			if (journal) {
				const withAttachmentUrls = withPresignedUrls(journal);
				processedJournal = {
					...withAttachmentUrls,
					content: transformHtmlWithPresignedUrls(withAttachmentUrls.content),
				};
			}

			return {
				journal: processedJournal,
				trades: tradesForDate,
				forcedItems,
			};
		}),

	// ============================================================================
	// CHECKLIST TEMPLATE QUERIES
	// ============================================================================

	// Get all templates for the current user, ordered by order field
	getTemplates: protectedProcedure.query(async ({ ctx }) => {
		const templates = await ctx.db.query.dailyChecklistTemplates.findMany({
			where: eq(dailyChecklistTemplates.userId, ctx.user.id),
			orderBy: [asc(dailyChecklistTemplates.order)],
		});

		return templates;
	}),

	// ============================================================================
	// CHECKLIST TEMPLATE MUTATIONS
	// ============================================================================

	// Create a new checklist template
	createTemplate: protectedProcedure
		.input(
			z.object({
				text: z.string().min(1),
				order: z.number().int().min(0).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// If order not provided, calculate the next order
			let order = input.order;
			if (order === undefined) {
				const existingTemplates =
					await ctx.db.query.dailyChecklistTemplates.findMany({
						where: eq(dailyChecklistTemplates.userId, ctx.user.id),
						columns: { order: true },
						orderBy: [asc(dailyChecklistTemplates.order)],
					});
				order =
					existingTemplates.length > 0
						? Math.max(...existingTemplates.map((t) => t.order)) + 1
						: 0;
			}

			const [created] = await ctx.db
				.insert(dailyChecklistTemplates)
				.values({
					userId: ctx.user.id,
					text: input.text,
					order,
				})
				.returning();

			if (!created) {
				throw new Error(ERR_TEMPLATE_CREATE_FAILED);
			}

			return created;
		}),

	// Update an existing checklist template
	updateTemplate: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				text: z.string().min(1).optional(),
				order: z.number().int().min(0).optional(),
				isActive: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns this template
			const existing = await ctx.db.query.dailyChecklistTemplates.findFirst({
				where: and(
					eq(dailyChecklistTemplates.id, input.id),
					eq(dailyChecklistTemplates.userId, ctx.user.id),
				),
			});

			if (!existing) {
				throw new Error(ERR_TEMPLATE_NOT_FOUND);
			}

			const updateData: Partial<{
				text: string;
				order: number;
				isActive: boolean;
			}> = {};
			if (input.text !== undefined) updateData.text = input.text;
			if (input.order !== undefined) updateData.order = input.order;
			if (input.isActive !== undefined) updateData.isActive = input.isActive;

			if (Object.keys(updateData).length === 0) {
				return existing;
			}

			const [updated] = await ctx.db
				.update(dailyChecklistTemplates)
				.set(updateData)
				.where(eq(dailyChecklistTemplates.id, input.id))
				.returning();

			return updated;
		}),

	// Delete a checklist template
	deleteTemplate: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns this template
			const existing = await ctx.db.query.dailyChecklistTemplates.findFirst({
				where: and(
					eq(dailyChecklistTemplates.id, input.id),
					eq(dailyChecklistTemplates.userId, ctx.user.id),
				),
			});

			if (!existing) {
				throw new Error(ERR_TEMPLATE_NOT_FOUND);
			}

			await ctx.db
				.delete(dailyChecklistTemplates)
				.where(eq(dailyChecklistTemplates.id, input.id));

			return { success: true };
		}),

	// Reorder checklist templates in bulk
	reorderTemplates: protectedProcedure
		.input(
			z.object({
				items: z.array(
					z.object({
						id: z.string(),
						order: z.number().int().min(0),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Validate user owns all templates
			const templateIds = input.items.map((item) => item.id);
			const existingTemplates =
				await ctx.db.query.dailyChecklistTemplates.findMany({
					where: eq(dailyChecklistTemplates.userId, ctx.user.id),
					columns: { id: true },
				});
			const ownedIds = new Set(existingTemplates.map((t) => t.id));

			for (const id of templateIds) {
				if (!ownedIds.has(id)) {
					throw new Error(errTemplateNotOwned(id));
				}
			}

			// Update all orders in a transaction
			await ctx.db.transaction(async (tx) => {
				for (const item of input.items) {
					await tx
						.update(dailyChecklistTemplates)
						.set({ order: item.order })
						.where(eq(dailyChecklistTemplates.id, item.id));
				}
			});

			// Return updated templates in order
			const updated = await ctx.db.query.dailyChecklistTemplates.findMany({
				where: eq(dailyChecklistTemplates.userId, ctx.user.id),
				orderBy: [asc(dailyChecklistTemplates.order)],
			});

			return updated;
		}),

	// ============================================================================
	// CHECKLIST CHECK QUERIES
	// ============================================================================

	// Get checks for a date (auto-creates journal if needed)
	getChecks: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string
			}),
		)
		.query(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Find or create journal for this date (handles race conditions)
			const journal = await findOrCreateJournal(
				ctx.db,
				ctx.user.id,
				normalizedDate,
			);

			// Get all checks for this journal with template info
			const checks = await ctx.db.query.dailyChecklistChecks.findMany({
				where: eq(dailyChecklistChecks.journalId, journal.id),
				with: {
					template: true,
				},
			});

			return {
				journalId: journal.id,
				checks,
			};
		}),

	// ============================================================================
	// CHECKLIST CHECK MUTATIONS
	// ============================================================================

	// Toggle a check for a journal+template (creates if not exists)
	toggleCheck: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string
				templateId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Verify user owns the template
			const template = await ctx.db.query.dailyChecklistTemplates.findFirst({
				where: and(
					eq(dailyChecklistTemplates.id, input.templateId),
					eq(dailyChecklistTemplates.userId, ctx.user.id),
				),
			});

			if (!template) {
				throw new Error(ERR_TEMPLATE_NOT_FOUND);
			}

			// Find or create journal for this date (handles race conditions)
			const journal = await findOrCreateJournal(
				ctx.db,
				ctx.user.id,
				normalizedDate,
			);

			// Check if check record exists
			const existingCheck = await ctx.db.query.dailyChecklistChecks.findFirst({
				where: and(
					eq(dailyChecklistChecks.journalId, journal.id),
					eq(dailyChecklistChecks.templateId, input.templateId),
				),
			});

			if (existingCheck) {
				// Toggle the check
				const newChecked = !existingCheck.checked;
				await ctx.db
					.update(dailyChecklistChecks)
					.set({
						checked: newChecked,
						checkedAt: newChecked ? new Date() : null,
					})
					.where(
						and(
							eq(dailyChecklistChecks.journalId, journal.id),
							eq(dailyChecklistChecks.templateId, input.templateId),
						),
					);

				return {
					journalId: journal.id,
					templateId: input.templateId,
					checked: newChecked,
					checkedAt: newChecked ? new Date() : null,
				};
			}

			// Create new check (starts as checked since it was unchecked before)
			await ctx.db.insert(dailyChecklistChecks).values({
				journalId: journal.id,
				templateId: input.templateId,
				checked: true,
				checkedAt: new Date(),
			});

			return {
				journalId: journal.id,
				templateId: input.templateId,
				checked: true,
				checkedAt: new Date(),
			};
		}),

	// Toggle a forced checklist item check (e.g., "Pre Market Check")
	toggleForcedCheck: protectedProcedure
		.input(
			z.object({
				date: z.string(), // YYYY-MM-DD date string
				itemId: z.string(), // e.g., "forced-pre-market"
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Only allow toggling specific forced items (not auto-calculated ones)
			const allowedForcedItems = ["forced-pre-market"];
			if (!allowedForcedItems.includes(input.itemId)) {
				throw new Error(ERR_CHECKLIST_AUTO_CALCULATED);
			}

			// Find or create journal for this date
			const journal = await findOrCreateJournal(
				ctx.db,
				ctx.user.id,
				normalizedDate,
			);

			// Check if check record exists for this forced item
			// Forced items use forcedItemId column (not templateId which has FK constraint)
			const existingCheck = await ctx.db.query.dailyChecklistChecks.findFirst({
				where: and(
					eq(dailyChecklistChecks.journalId, journal.id),
					eq(dailyChecklistChecks.forcedItemId, input.itemId),
				),
			});

			if (existingCheck) {
				// Toggle the check
				const newChecked = !existingCheck.checked;
				await ctx.db
					.update(dailyChecklistChecks)
					.set({
						checked: newChecked,
						checkedAt: newChecked ? new Date() : null,
					})
					.where(eq(dailyChecklistChecks.id, existingCheck.id));

				return {
					journalId: journal.id,
					itemId: input.itemId,
					checked: newChecked,
				};
			}

			// Create new check (starts as checked since it was unchecked before)
			await ctx.db.insert(dailyChecklistChecks).values({
				journalId: journal.id,
				forcedItemId: input.itemId, // Use forcedItemId for system-level forced items
				checked: true,
				checkedAt: new Date(),
			});

			return {
				journalId: journal.id,
				itemId: input.itemId,
				checked: true,
			};
		}),

	// Bulk update checks for a journal
	bulkUpdateChecks: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string
				checks: z.array(
					z.object({
						templateId: z.string(),
						checked: z.boolean(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Verify user owns all templates
			const templateIds = input.checks.map((c) => c.templateId);
			const templates = await ctx.db.query.dailyChecklistTemplates.findMany({
				where: eq(dailyChecklistTemplates.userId, ctx.user.id),
				columns: { id: true },
			});
			const ownedIds = new Set(templates.map((t) => t.id));

			for (const id of templateIds) {
				if (!ownedIds.has(id)) {
					throw new Error(errTemplateNotOwned(id));
				}
			}

			// Find or create journal for this date (handles race conditions)
			const journal = await findOrCreateJournal(
				ctx.db,
				ctx.user.id,
				normalizedDate,
			);

			// Update/insert all checks in a transaction
			await ctx.db.transaction(async (tx) => {
				for (const check of input.checks) {
					const existingCheck = await tx.query.dailyChecklistChecks.findFirst({
						where: and(
							eq(dailyChecklistChecks.journalId, journal.id),
							eq(dailyChecklistChecks.templateId, check.templateId),
						),
					});

					if (existingCheck) {
						await tx
							.update(dailyChecklistChecks)
							.set({
								checked: check.checked,
								checkedAt: check.checked ? new Date() : null,
							})
							.where(
								and(
									eq(dailyChecklistChecks.journalId, journal.id),
									eq(dailyChecklistChecks.templateId, check.templateId),
								),
							);
					} else {
						await tx.insert(dailyChecklistChecks).values({
							journalId: journal.id,
							templateId: check.templateId,
							checked: check.checked,
							checkedAt: check.checked ? new Date() : null,
						});
					}
				}
			});

			// Return updated checks
			const updatedChecks = await ctx.db.query.dailyChecklistChecks.findMany({
				where: eq(dailyChecklistChecks.journalId, journal.id),
				with: {
					template: true,
				},
			});

			return {
				journalId: journal.id,
				checks: updatedChecks,
			};
		}),

	// ============================================================================
	// FILE UPLOAD MUTATIONS
	// ============================================================================

	// Get a presigned URL for uploading a file to S3
	getUploadUrl: protectedProcedure
		.input(
			z.object({
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().int().positive(),
				date: z.string(), // ISO date string
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(ERR_S3_NOT_CONFIGURED);
			}

			const normalizedDate = normalizeDate(new Date(input.date));
			const dateStr = normalizedDate.toISOString().split("T")[0]; // YYYY-MM-DD

			// Generate a unique key for the file
			// Format: journals/{userId}/{date}/{uuid}-{filename}
			const uuid = nanoid();
			const key = `journals/${ctx.user.id}/${dateStr}/${uuid}-${input.filename}`;

			// Generate presigned PUT URL (valid for 1 hour)
			const presignedUrl = getPresignedUploadUrl(key, 3600);

			return {
				presignedUrl,
				key,
			};
		}),

	// Confirm an upload completed and create database record
	confirmUpload: protectedProcedure
		.input(
			z.object({
				journalId: z.string(),
				key: z.string(),
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().int().positive(),
				caption: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(ERR_S3_NOT_CONFIGURED);
			}

			// Verify user owns the journal
			const journal = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.id, input.journalId),
					eq(dailyJournals.userId, ctx.user.id),
				),
			});

			if (!journal) {
				throw new Error(ERR_JOURNAL_NOT_FOUND);
			}

			// Store the key, not the presigned URL - URLs will be generated on-demand
			// when fetching attachments to avoid expiration issues
			const [attachment] = await ctx.db
				.insert(journalAttachments)
				.values({
					journalId: input.journalId,
					url: input.key, // Store key in url field - will generate presigned URL on read
					key: input.key,
					filename: input.filename,
					mimeType: input.mimeType,
					size: input.size,
					caption: input.caption ?? null,
				})
				.returning();

			if (!attachment) {
				throw new Error(ERR_ATTACHMENT_CREATE_FAILED);
			}

			// Generate presigned URL for immediate use (e.g., inserting into editor)
			const presignedUrl = isS3Configured()
				? getPresignedDownloadUrl(input.key, 3600)
				: attachment.url;

			return { ...attachment, url: presignedUrl };
		}),

	// ============================================================================
	// STREAK & COMPLIANCE QUERIES
	// ============================================================================

	// Get checklist compliance statistics for a date range
	getComplianceStats: protectedProcedure
		.input(
			z.object({
				startDate: z.string(), // ISO date string
				endDate: z.string(), // ISO date string
			}),
		)
		.query(async ({ ctx, input }) => {
			const startNormalized = normalizeDate(new Date(input.startDate));
			const endNormalized = normalizeDate(new Date(input.endDate));

			// Get user timezone for trade filtering
			const userTimezone = await getUserTimezone(ctx.db, ctx.user.id);

			// Get all active templates for this user
			const templates = await ctx.db.query.dailyChecklistTemplates.findMany({
				where: and(
					eq(dailyChecklistTemplates.userId, ctx.user.id),
					eq(dailyChecklistTemplates.isActive, true),
				),
				columns: { id: true },
			});

			const templateIds = new Set(templates.map((t) => t.id));
			const userTemplatesCount = templates.length;

			// Get all journals in the date range with their checks
			const journals = await ctx.db.query.dailyJournals.findMany({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					gte(dailyJournals.date, startNormalized),
					lte(dailyJournals.date, endNormalized),
				),
				with: {
					checklistChecks: true,
				},
			});

			// Get all trades in the date range to determine which days have trades
			// Extract YYYY-MM-DD from ISO strings (getDayBoundsInTimezone expects date-only format)
			const startDateStr = input.startDate.split("T")[0] ?? input.startDate;
			const endDateStr = input.endDate.split("T")[0] ?? input.endDate;

			const { start: rangeStart } = getDayBoundsInTimezone(
				startDateStr,
				userTimezone,
			);
			const { end: rangeEnd } = getDayBoundsInTimezone(
				endDateStr,
				userTimezone,
			);

			const allTrades = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					gte(trades.entryTime, rangeStart),
					lt(trades.entryTime, rangeEnd),
					isNull(trades.deletedAt),
					isNotNull(trades.accountId),
				),
				columns: {
					entryTime: true,
					stopLoss: true,
				},
			});

			// Group trades by date (using user's timezone and entry time)
			const tradesByDate = new Map<string, typeof allTrades>();
			for (const trade of allTrades) {
				const dateStr = getDateStringInTimezone(trade.entryTime, userTimezone);
				if (!tradesByDate.has(dateStr)) {
					tradesByDate.set(dateStr, []);
				}
				tradesByDate.get(dateStr)?.push(trade);
			}

			// Calculate compliance per day - ONLY for eligible days
			const dailyCompliance: Array<{
				date: Date;
				checkedCount: number;
				totalTemplates: number;
				compliance: number;
			}> = [];

			for (const journal of journals) {
				const dateStr = getUTCDateString(journal.date);
				const dayTrades = tradesByDate.get(dateStr) ?? [];
				const hasTrades = dayTrades.length > 0;
				const dayStarted = journal.dayStartedAt !== null;

				// ONLY count days where dayStarted OR hasTrades
				if (!dayStarted && !hasTrades) {
					continue; // Skip this day - not eligible for compliance
				}

				// Calculate forced items for this day
				let forcedItemsCount = 0;
				let forcedItemsChecked = 0;

				// Pre Market Check - required if dayStarted OR hasTrades
				if (dayStarted || hasTrades) {
					forcedItemsCount++;
					const preMarketCheck = journal.checklistChecks.find(
						(c) => c.forcedItemId === "forced-pre-market",
					);
					if (preMarketCheck?.checked) {
						forcedItemsChecked++;
					}
				}

				// SL Check - required if hasTrades, auto-checked based on data
				if (hasTrades) {
					forcedItemsCount++;
					const allTradesHaveSL = dayTrades.every((t) => t.stopLoss !== null);
					if (allTradesHaveSL) {
						forcedItemsChecked++;
					}
				}

				// Count user template checks (templateId is nullable now, only count if set)
				const userCheckedCount = journal.checklistChecks.filter(
					(check) =>
						check.checked &&
						check.templateId !== null &&
						templateIds.has(check.templateId),
				).length;

				// Total = user templates + forced items
				const totalItems = userTemplatesCount + forcedItemsCount;
				const totalChecked = userCheckedCount + forcedItemsChecked;

				const compliance =
					totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 100;

				dailyCompliance.push({
					date: journal.date,
					checkedCount: totalChecked,
					totalTemplates: totalItems,
					compliance,
				});
			}

			// Calculate average compliance across eligible days
			const averageCompliance =
				dailyCompliance.length > 0
					? Math.round(
							dailyCompliance.reduce((sum, day) => sum + day.compliance, 0) /
								dailyCompliance.length,
						)
					: null;

			return {
				dailyCompliance,
				averageCompliance,
				totalDays: dailyCompliance.length,
			};
		}),

	// Get current journaling streak (consecutive days with content from today backwards)
	getStreak: protectedProcedure.query(async ({ ctx }) => {
		// Get all journals with content, ordered by date descending
		const journals = await ctx.db.query.dailyJournals.findMany({
			where: eq(dailyJournals.userId, ctx.user.id),
			columns: {
				date: true,
				content: true,
			},
			orderBy: (journals, { desc }) => [desc(journals.date)],
		});

		// Filter to only journals with content
		const journalsWithContent = journals.filter(
			(j) => j.content !== null && j.content.trim() !== "",
		);

		// Calculate streak starting from today
		const today = normalizeDate(new Date());
		let streak = 0;
		const currentDate = new Date(today);

		// Create a Set of dates with content for O(1) lookup
		const datesWithContent = new Set(
			journalsWithContent.map((j) => j.date.toISOString().split("T")[0]),
		);

		// Count consecutive days backwards from today
		while (true) {
			const dateStr = currentDate.toISOString().split("T")[0];
			if (datesWithContent.has(dateStr)) {
				streak++;
				// Move to previous day
				currentDate.setUTCDate(currentDate.getUTCDate() - 1);
			} else {
				// Gap found, streak ends
				break;
			}
		}

		return { streak };
	}),

	// Get journal adjacency data for a date range
	// Returns journal + trading data per day for streak calendar widget
	getJournalAdjacency: protectedProcedure
		.input(
			z.object({
				accountId: z.string().optional(), // Optional account filter
				startDate: z.string(), // YYYY-MM-DD date string
				endDate: z.string(), // YYYY-MM-DD date string
			}),
		)
		.query(async ({ ctx, input }) => {
			const startNormalized = normalizeDate(new Date(input.startDate));
			const endNormalized = normalizeDate(new Date(input.endDate));

			// Get user timezone for trade filtering
			const userTimezone = await getUserTimezone(ctx.db, ctx.user.id);

			// Get all active templates for this user (for checklist completion)
			const templates = await ctx.db.query.dailyChecklistTemplates.findMany({
				where: and(
					eq(dailyChecklistTemplates.userId, ctx.user.id),
					eq(dailyChecklistTemplates.isActive, true),
				),
				columns: { id: true },
			});
			const templateIds = new Set(templates.map((t) => t.id));
			const userTemplatesCount = templates.length;

			// Get all journals in the date range with their checks
			const journals = await ctx.db.query.dailyJournals.findMany({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					gte(dailyJournals.date, startNormalized),
					lte(dailyJournals.date, endNormalized),
				),
				with: {
					checklistChecks: true,
				},
			});

			// Get all trades in the date range
			const startDateStr = input.startDate.split("T")[0] ?? input.startDate;
			const endDateStr = input.endDate.split("T")[0] ?? input.endDate;

			const { start: rangeStart } = getDayBoundsInTimezone(
				startDateStr,
				userTimezone,
			);
			const { end: rangeEnd } = getDayBoundsInTimezone(
				endDateStr,
				userTimezone,
			);

			// Build trade query conditions
			const tradeConditions = [
				eq(trades.userId, ctx.user.id),
				gte(trades.entryTime, rangeStart),
				lt(trades.entryTime, rangeEnd),
				isNull(trades.deletedAt),
				isNotNull(trades.accountId),
			];

			// Filter by account if specified
			if (input.accountId) {
				tradeConditions.push(eq(trades.accountId, input.accountId));
			}

			const allTrades = await ctx.db.query.trades.findMany({
				where: and(...tradeConditions),
				columns: {
					entryTime: true,
					netPnl: true,
					stopLoss: true,
				},
			});

			// Group trades by date (using user's timezone)
			const tradesByDate = new Map<
				string,
				{ trades: typeof allTrades; pnl: number }
			>();
			for (const trade of allTrades) {
				const dateStr = getDateStringInTimezone(trade.entryTime, userTimezone);
				if (!tradesByDate.has(dateStr)) {
					tradesByDate.set(dateStr, { trades: [], pnl: 0 });
				}
				const dayData = tradesByDate.get(dateStr);
				if (dayData) {
					dayData.trades.push(trade);
					dayData.pnl += trade.netPnl ? parseFloat(trade.netPnl) : 0;
				}
			}

			// Create lookup for journals by date
			const journalsByDate = new Map<string, (typeof journals)[0]>();
			for (const journal of journals) {
				const dateStr = getUTCDateString(journal.date);
				journalsByDate.set(dateStr, journal);
			}

			// Build result for each date in the range
			const result: Array<{
				date: string;
				hasTrades: boolean;
				tradeCount: number;
				pnl: number;
				hasJournal: boolean;
				journalWordCount: number;
				checklistCompletion: number;
			}> = [];

			// Iterate through each day in the range
			const currentDate = new Date(startNormalized);
			while (currentDate <= endNormalized) {
				const dateStr = currentDate.toISOString().split("T")[0] ?? "";
				const journal = journalsByDate.get(dateStr);
				const dayTradeData = tradesByDate.get(dateStr);

				// Calculate journal word count (strip HTML tags)
				let journalWordCount = 0;
				if (journal?.content) {
					const textContent = journal.content.replace(/<[^>]*>/g, " ").trim();
					journalWordCount = textContent
						? textContent.split(/\s+/).filter(Boolean).length
						: 0;
				}

				// Determine if has journal (dayStarted or has content)
				// Note: Must check journal exists first, as undefined !== null is true in JS
				const hasJournal = journal
					? journal.dayStartedAt !== null ||
						(journal.content !== null && journal.content.trim() !== "")
					: false;

				// Calculate checklist completion for this day
				let checklistCompletion = 0;
				if (journal) {
					const dayTrades = dayTradeData?.trades ?? [];
					const hasTrades = dayTrades.length > 0;
					const dayStarted = journal.dayStartedAt !== null;

					// Only calculate if day was eligible (started or has trades)
					if (dayStarted || hasTrades) {
						// Forced items count
						let forcedItemsCount = 0;
						let forcedItemsChecked = 0;

						// Pre Market Check - required if dayStarted OR hasTrades
						if (dayStarted || hasTrades) {
							forcedItemsCount++;
							const preMarketCheck = journal.checklistChecks.find(
								(c) => c.forcedItemId === "forced-pre-market",
							);
							if (preMarketCheck?.checked) {
								forcedItemsChecked++;
							}
						}

						// SL Check - required if hasTrades
						if (hasTrades) {
							forcedItemsCount++;
							const allTradesHaveSL = dayTrades.every(
								(t) => t.stopLoss !== null,
							);
							if (allTradesHaveSL) {
								forcedItemsChecked++;
							}
						}

						// User template checks
						const userCheckedCount = journal.checklistChecks.filter(
							(check) =>
								check.checked &&
								check.templateId !== null &&
								templateIds.has(check.templateId),
						).length;

						// Total = user templates + forced items
						const totalItems = userTemplatesCount + forcedItemsCount;
						const totalChecked = userCheckedCount + forcedItemsChecked;

						checklistCompletion =
							totalItems > 0
								? Math.round((totalChecked / totalItems) * 100)
								: 100;
					}
				}

				result.push({
					date: dateStr,
					hasTrades: (dayTradeData?.trades.length ?? 0) > 0,
					tradeCount: dayTradeData?.trades.length ?? 0,
					pnl: dayTradeData?.pnl ?? 0,
					hasJournal: hasJournal ?? false,
					journalWordCount,
					checklistCompletion,
				});

				// Move to next day
				currentDate.setUTCDate(currentDate.getUTCDate() + 1);
			}

			return result;
		}),

	// Delete an attachment (from S3 and database)
	deleteAttachment: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Find the attachment and verify ownership through journal
			const attachment = await ctx.db.query.journalAttachments.findFirst({
				where: eq(journalAttachments.id, input.id),
				with: {
					journal: true,
				},
			});

			if (!attachment) {
				throw new Error(ERR_ATTACHMENT_NOT_FOUND);
			}

			// Verify user owns the journal that contains this attachment
			if (attachment.journal.userId !== ctx.user.id) {
				throw new Error(ERR_ATTACHMENT_NOT_FOUND);
			}

			// Delete from S3 if configured
			if (isS3Configured() && attachment.key) {
				try {
					await deleteObject(attachment.key);
				} catch {
					// Log error but continue with database deletion
					// The file may have already been deleted or not exist
					console.error(`Failed to delete S3 object: ${attachment.key}`);
				}
			}

			// Delete from database
			await ctx.db
				.delete(journalAttachments)
				.where(eq(journalAttachments.id, input.id));

			return { success: true };
		}),
});
