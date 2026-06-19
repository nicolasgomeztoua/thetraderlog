import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ERR_BUG_REPORT_CREATE_FAILED } from "@/lib/constants/errors";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { bugReports } from "@/server/db/schema";

export const bugReportsRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				title: z.string().min(1).max(200),
				description: z.string().min(1).max(5000),
				category: z.enum(["ui", "data", "performance", "crash", "other"]),
				screenshotKey: z.string().optional(),
				pageUrl: z.string().optional(),
				userAgent: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [report] = await ctx.db
				.insert(bugReports)
				.values({
					userId: ctx.user.id,
					title: input.title,
					description: input.description,
					category: input.category,
					screenshotKey: input.screenshotKey,
					pageUrl: input.pageUrl,
					userAgent: input.userAgent,
					metadata: {
						clerkId: ctx.user.clerkId,
						email: ctx.user.email,
						name: ctx.user.name,
						signedUpAt: ctx.user.createdAt?.toISOString(),
					},
				})
				.returning();

			if (!report) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: ERR_BUG_REPORT_CREATE_FAILED,
				});
			}

			return report;
		}),
});
