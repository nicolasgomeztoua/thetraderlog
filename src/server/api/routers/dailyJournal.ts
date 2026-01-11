import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { dailyJournals } from "@/server/db/schema";

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
});
