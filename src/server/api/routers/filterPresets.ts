import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { ERR_FILTER_PRESET_NOT_FOUND } from "@/lib/constants/errors";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { filterPresets } from "@/server/db/schema";

export const filterPresetsRouter = createTRPCRouter({
	// Get all filter presets for current user
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const presets = await ctx.db.query.filterPresets.findMany({
			where: eq(filterPresets.userId, ctx.user.id),
			orderBy: [desc(filterPresets.createdAt)],
		});
		return presets;
	}),

	// Get a single preset by ID
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const preset = await ctx.db.query.filterPresets.findFirst({
				where: and(
					eq(filterPresets.id, input.id),
					eq(filterPresets.userId, ctx.user.id),
				),
			});

			if (!preset) {
				throw new Error(ERR_FILTER_PRESET_NOT_FOUND);
			}

			return preset;
		}),

	// Create a new filter preset
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(50),
				filters: z.string(), // JSON string of filter config
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [preset] = await ctx.db
				.insert(filterPresets)
				.values({
					userId: ctx.user.id,
					name: input.name,
					filters: input.filters,
				})
				.returning();

			return preset;
		}),

	// Update a filter preset
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(50).optional(),
				filters: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.query.filterPresets.findFirst({
				where: and(
					eq(filterPresets.id, input.id),
					eq(filterPresets.userId, ctx.user.id),
				),
			});

			if (!existing) {
				throw new Error(ERR_FILTER_PRESET_NOT_FOUND);
			}

			const [updated] = await ctx.db
				.update(filterPresets)
				.set({
					name: input.name ?? existing.name,
					filters: input.filters ?? existing.filters,
				})
				.where(eq(filterPresets.id, input.id))
				.returning();

			return updated;
		}),

	// Delete a filter preset
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.query.filterPresets.findFirst({
				where: and(
					eq(filterPresets.id, input.id),
					eq(filterPresets.userId, ctx.user.id),
				),
			});

			if (!existing) {
				throw new Error(ERR_FILTER_PRESET_NOT_FOUND);
			}

			await ctx.db.delete(filterPresets).where(eq(filterPresets.id, input.id));

			return { success: true };
		}),
});
