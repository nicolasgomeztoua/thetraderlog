import { and, asc, eq, gte, lt, lte } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { economicEvents, eventImpactEnum } from "@/server/db/schema";

// Get start and end of today in UTC
function getTodayBoundsUTC(): { start: Date; end: Date } {
	const now = new Date();
	const start = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	const end = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
	);
	return { start, end };
}

export const economicCalendarRouter = createTRPCRouter({
	// Get today's economic events with optional filters
	getTodayEvents: protectedProcedure
		.input(
			z
				.object({
					currency: z.string().optional(),
					impact: z.enum(eventImpactEnum.enumValues).optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const { start, end } = getTodayBoundsUTC();

			const conditions = [
				gte(economicEvents.eventTime, start),
				lt(economicEvents.eventTime, end),
			];

			if (input?.currency) {
				conditions.push(eq(economicEvents.currency, input.currency));
			}

			if (input?.impact) {
				conditions.push(eq(economicEvents.impact, input.impact));
			}

			const events = await ctx.db.query.economicEvents.findMany({
				where: and(...conditions),
				orderBy: [asc(economicEvents.eventTime)],
			});

			return events;
		}),

	// Get upcoming events for the next N hours (default 24)
	getUpcoming: protectedProcedure
		.input(
			z
				.object({
					hoursAhead: z.number().min(1).max(168).default(24), // Max 1 week
					limit: z.number().min(1).max(50).default(10),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const now = new Date();
			const hoursAhead = input?.hoursAhead ?? 24;
			const limit = input?.limit ?? 10;

			const endTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

			const events = await ctx.db.query.economicEvents.findMany({
				where: and(
					gte(economicEvents.eventTime, now),
					lte(economicEvents.eventTime, endTime),
				),
				orderBy: [asc(economicEvents.eventTime)],
				limit,
			});

			return events;
		}),
});
