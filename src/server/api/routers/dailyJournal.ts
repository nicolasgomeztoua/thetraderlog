import { and, asc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
	deleteObject,
	getPresignedDownloadUrl,
	getPresignedUploadUrl,
	isS3Configured,
} from "@/lib/storage/s3";
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
				throw new Error("Failed to create journal");
			}

			return created;
		}),

	// ============================================================================
	// JOURNAL QUERIES
	// ============================================================================

	// Get journal by date, auto-create if not exists
	getByDate: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string (YYYY-MM-DD or full ISO)
			}),
		)
		.query(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));

			// Try to find existing journal
			let journal = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					eq(dailyJournals.date, normalizedDate),
				),
				with: {
					attachments: true,
					checklistChecks: {
						with: {
							template: true,
						},
					},
				},
			});

			// Auto-create if not exists
			if (!journal) {
				const [created] = await ctx.db
					.insert(dailyJournals)
					.values({
						userId: ctx.user.id,
						date: normalizedDate,
						content: null,
						contentFormat: "html",
					})
					.returning();

				if (!created) {
					throw new Error("Failed to create journal");
				}

				// Fetch with relations
				journal = await ctx.db.query.dailyJournals.findFirst({
					where: eq(dailyJournals.id, created.id),
					with: {
						attachments: true,
						checklistChecks: {
							with: {
								template: true,
							},
						},
					},
				});
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

	// Get journal with trades for a specific date
	getWithTrades: protectedProcedure
		.input(
			z.object({
				date: z.string(), // ISO date string
			}),
		)
		.query(async ({ ctx, input }) => {
			const normalizedDate = normalizeDate(new Date(input.date));
			// End of day is start of next day
			const nextDay = new Date(normalizedDate);
			nextDay.setUTCDate(nextDay.getUTCDate() + 1);

			// Get journal for the date (auto-create if not exists)
			let journal = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					eq(dailyJournals.date, normalizedDate),
				),
				with: {
					attachments: true,
					checklistChecks: {
						with: {
							template: true,
						},
					},
				},
			});

			// Auto-create if not exists
			if (!journal) {
				const [created] = await ctx.db
					.insert(dailyJournals)
					.values({
						userId: ctx.user.id,
						date: normalizedDate,
						content: null,
						contentFormat: "html",
					})
					.returning();

				if (!created) {
					throw new Error("Failed to create journal");
				}

				// Fetch with relations
				journal = await ctx.db.query.dailyJournals.findFirst({
					where: eq(dailyJournals.id, created.id),
					with: {
						attachments: true,
						checklistChecks: {
							with: {
								template: true,
							},
						},
					},
				});
			}

			// Get trades for the date (filter by entry time within the day)
			const tradesForDate = await ctx.db.query.trades.findMany({
				where: and(
					eq(trades.userId, ctx.user.id),
					gte(trades.entryTime, normalizedDate),
					lt(trades.entryTime, nextDay),
					isNull(trades.deletedAt),
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

			return {
				journal,
				trades: tradesForDate,
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
				throw new Error("Failed to create template");
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
				throw new Error("Template not found");
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
				throw new Error("Template not found");
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
					throw new Error(`Template ${id} not found or not owned by user`);
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

			// Find or create journal for this date
			let journal = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					eq(dailyJournals.date, normalizedDate),
				),
			});

			if (!journal) {
				const [created] = await ctx.db
					.insert(dailyJournals)
					.values({
						userId: ctx.user.id,
						date: normalizedDate,
						content: null,
						contentFormat: "html",
					})
					.returning();

				if (!created) {
					throw new Error("Failed to create journal");
				}

				journal = created;
			}

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
				throw new Error("Template not found");
			}

			// Find or create journal for this date
			let journal = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					eq(dailyJournals.date, normalizedDate),
				),
			});

			if (!journal) {
				const [created] = await ctx.db
					.insert(dailyJournals)
					.values({
						userId: ctx.user.id,
						date: normalizedDate,
						content: null,
						contentFormat: "html",
					})
					.returning();

				if (!created) {
					throw new Error("Failed to create journal");
				}

				journal = created;
			}

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
					throw new Error(`Template ${id} not found or not owned by user`);
				}
			}

			// Find or create journal for this date
			let journal = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.userId, ctx.user.id),
					eq(dailyJournals.date, normalizedDate),
				),
			});

			if (!journal) {
				const [created] = await ctx.db
					.insert(dailyJournals)
					.values({
						userId: ctx.user.id,
						date: normalizedDate,
						content: null,
						contentFormat: "html",
					})
					.returning();

				if (!created) {
					throw new Error("Failed to create journal");
				}

				journal = created;
			}

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
				throw new Error(
					"File uploads are not configured. S3 settings are missing.",
				);
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
				throw new Error(
					"File uploads are not configured. S3 settings are missing.",
				);
			}

			// Verify user owns the journal
			const journal = await ctx.db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.id, input.journalId),
					eq(dailyJournals.userId, ctx.user.id),
				),
			});

			if (!journal) {
				throw new Error("Journal not found");
			}

			// Generate a presigned URL for viewing the file
			const url = getPresignedDownloadUrl(input.key, 86400 * 7); // 7 day expiry

			// Create the attachment record
			const [attachment] = await ctx.db
				.insert(journalAttachments)
				.values({
					journalId: input.journalId,
					url,
					key: input.key,
					filename: input.filename,
					mimeType: input.mimeType,
					size: input.size,
					caption: input.caption ?? null,
				})
				.returning();

			if (!attachment) {
				throw new Error("Failed to create attachment");
			}

			return attachment;
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
				throw new Error("Attachment not found");
			}

			// Verify user owns the journal that contains this attachment
			if (attachment.journal.userId !== ctx.user.id) {
				throw new Error("Attachment not found");
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
