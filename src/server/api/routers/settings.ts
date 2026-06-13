import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { userSettings } from "@/server/db/schema";

export const settingsRouter = createTRPCRouter({
	// Get user settings (creates default if doesn't exist)
	get: protectedProcedure.query(async ({ ctx }) => {
		let settings = await ctx.db.query.userSettings.findFirst({
			where: eq(userSettings.userId, ctx.user.id),
		});

		// Create default settings if none exist
		if (!settings) {
			const [newSettings] = await ctx.db
				.insert(userSettings)
				.values({
					userId: ctx.user.id,
				})
				.returning();
			settings = newSettings;
		}

		return settings;
	}),

	// Update user settings
	update: protectedProcedure
		.input(
			z.object({
				timezone: z.string().optional(),
				currency: z.string().optional(),
				breakevenThreshold: z.string().optional(), // Dollar amount for breakeven threshold
				tradeLogColumns: z.string().optional(), // JSON string of column visibility/order
				tradeLogSort: z.string().optional(), // JSON string of { field, direction }
				tradingSessions: z.string().optional(), // JSON string of session definitions
				theme: z.string().optional(), // Theme ID (e.g., "terminal", "midnight", "paper")
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if settings exist
			const existing = await ctx.db.query.userSettings.findFirst({
				where: eq(userSettings.userId, ctx.user.id),
			});

			if (existing) {
				// Update existing
				const [updated] = await ctx.db
					.update(userSettings)
					.set(input)
					.where(eq(userSettings.userId, ctx.user.id))
					.returning();
				// Invalidate the per-request settings cache so any later read in
				// this request reflects the write.
				ctx.userSettingsCache.delete(ctx.user.id);
				return updated;
			} else {
				// Create new
				const [created] = await ctx.db
					.insert(userSettings)
					.values({
						userId: ctx.user.id,
						...input,
					})
					.returning();
				// Invalidate the per-request settings cache so any later read in
				// this request reflects the write.
				ctx.userSettingsCache.delete(ctx.user.id);
				return created;
			}
		}),

	// Get current user info (id, role, name, email, imageUrl)
	me: protectedProcedure.query(({ ctx }) => {
		return {
			id: ctx.user.id,
			role: ctx.user.role,
			name: ctx.user.name,
			email: ctx.user.email,
			imageUrl: ctx.user.imageUrl,
		};
	}),

	// Get just the breakeven threshold (for stats calculations)
	getBreakevenThreshold: protectedProcedure.query(async ({ ctx }) => {
		const settings = await ctx.db.query.userSettings.findFirst({
			where: eq(userSettings.userId, ctx.user.id),
			columns: {
				breakevenThreshold: true,
			},
		});

		return parseFloat(settings?.breakevenThreshold ?? "3.00");
	}),
});
