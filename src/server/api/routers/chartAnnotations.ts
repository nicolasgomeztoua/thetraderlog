import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_ANNOTATION_COLOR } from "@/lib/constants/chart";
import {
	ERR_ANNOTATION_CREATE_FAILED,
	ERR_ANNOTATION_NOT_FOUND,
	ERR_TRADE_NOT_FOUND,
} from "@/lib/constants/errors";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { chartAnnotations, trades } from "@/server/db/schema";

export const chartAnnotationsRouter = createTRPCRouter({
	list: protectedProcedure
		.input(z.object({ tradeId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify user owns the trade
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
					isNull(trades.deletedAt),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			return ctx.db.query.chartAnnotations.findMany({
				where: and(
					eq(chartAnnotations.tradeId, input.tradeId),
					eq(chartAnnotations.userId, ctx.user.id),
				),
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				tradeId: z.string(),
				type: z.enum(["horizontal", "vertical"]),
				value: z
					.string()
					.refine((v) => !Number.isNaN(Number(v)) && v.trim() !== "", {
						message: "Value must be a valid numeric string",
					}),
				lineStyle: z.enum(["solid", "dashed"]).optional(),
				color: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns the trade
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
					isNull(trades.deletedAt),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			const [annotation] = await ctx.db
				.insert(chartAnnotations)
				.values({
					tradeId: input.tradeId,
					userId: ctx.user.id,
					type: input.type,
					value: input.value,
					lineStyle: input.lineStyle ?? "solid",
					color: input.color ?? DEFAULT_ANNOTATION_COLOR,
				})
				.returning();

			if (!annotation) {
				throw new Error(ERR_ANNOTATION_CREATE_FAILED);
			}

			return annotation;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership through the trade
			const annotation = await ctx.db.query.chartAnnotations.findFirst({
				where: eq(chartAnnotations.id, input.id),
				with: { trade: true },
			});

			if (
				!annotation ||
				annotation.trade.userId !== ctx.user.id ||
				annotation.trade.deletedAt !== null
			) {
				throw new Error(ERR_ANNOTATION_NOT_FOUND);
			}

			await ctx.db
				.delete(chartAnnotations)
				.where(eq(chartAnnotations.id, input.id));

			return { success: true };
		}),

	clearAll: protectedProcedure
		.input(z.object({ tradeId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify user owns the trade
			const trade = await ctx.db.query.trades.findFirst({
				where: and(
					eq(trades.id, input.tradeId),
					eq(trades.userId, ctx.user.id),
					isNull(trades.deletedAt),
				),
			});

			if (!trade) {
				throw new Error(ERR_TRADE_NOT_FOUND);
			}

			await ctx.db
				.delete(chartAnnotations)
				.where(eq(chartAnnotations.tradeId, input.tradeId));

			return { success: true };
		}),
});
