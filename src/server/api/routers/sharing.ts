import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
	ERR_SHARE_LINK_LIMIT_REACHED,
	ERR_SHARE_LINK_NOT_FOUND,
	ERR_SHARE_RESOURCE_NOT_COMPLETE,
	ERR_SHARE_RESOURCE_NOT_FOUND,
	MAX_SHARE_LINKS_PER_RESOURCE,
} from "@/lib/constants";
import { generateShareToken } from "@/lib/shared/id";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";
import { aiReports, shareLinks } from "@/server/db/schema";

export const sharingRouter = createTRPCRouter({
	// =========================================================================
	// PUBLIC: Resolve a share token → report content
	// =========================================================================
	resolveToken: publicProcedure
		.input(z.object({ token: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const link = await ctx.db.query.shareLinks.findFirst({
				where: eq(shareLinks.token, input.token),
			});

			if (!link) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: ERR_SHARE_LINK_NOT_FOUND,
				});
			}

			if (!link.isActive) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "revoked",
				});
			}

			if (link.expiresAt && link.expiresAt < new Date()) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "expired",
				});
			}

			// Increment view count
			await ctx.db
				.update(shareLinks)
				.set({
					viewCount: sql`${shareLinks.viewCount} + 1`,
					lastViewedAt: new Date(),
				})
				.where(eq(shareLinks.id, link.id));

			// Fetch the resource based on type
			if (link.resourceType === "report") {
				const report = await ctx.db.query.aiReports.findFirst({
					where: eq(aiReports.id, link.resourceId),
					columns: {
						title: true,
						content: true,
						dataArtifacts: true,
						completedAt: true,
						prompt: true,
						model: true,
					},
				});

				if (!report) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}

				return {
					resourceType: link.resourceType,
					report,
				};
			}

			throw new TRPCError({
				code: "NOT_FOUND",
				message: ERR_SHARE_RESOURCE_NOT_FOUND,
			});
		}),

	// =========================================================================
	// PROTECTED: Create a share link
	// =========================================================================
	createLink: protectedProcedure
		.input(
			z.object({
				resourceType: z.enum(["report"]),
				resourceId: z.string().min(1),
				expiryDays: z.number().int().positive().nullish(),
				label: z.string().max(100).nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership + status
			if (input.resourceType === "report") {
				const report = await ctx.db.query.aiReports.findFirst({
					where: and(
						eq(aiReports.id, input.resourceId),
						eq(aiReports.userId, ctx.user.id),
					),
					columns: { id: true, status: true },
				});

				if (!report) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: ERR_SHARE_RESOURCE_NOT_FOUND,
					});
				}

				if (report.status !== "complete") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: ERR_SHARE_RESOURCE_NOT_COMPLETE,
					});
				}
			}

			// Check link limit
			const existing = await ctx.db
				.select({ count: sql<number>`count(*)::int` })
				.from(shareLinks)
				.where(
					and(
						eq(shareLinks.resourceType, input.resourceType),
						eq(shareLinks.resourceId, input.resourceId),
						eq(shareLinks.userId, ctx.user.id),
						eq(shareLinks.isActive, true),
					),
				);

			if ((existing[0]?.count ?? 0) >= MAX_SHARE_LINKS_PER_RESOURCE) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: ERR_SHARE_LINK_LIMIT_REACHED,
				});
			}

			const token = generateShareToken();
			const expiresAt = input.expiryDays
				? new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000)
				: null;

			const [link] = await ctx.db
				.insert(shareLinks)
				.values({
					userId: ctx.user.id,
					token,
					resourceType: input.resourceType,
					resourceId: input.resourceId,
					label: input.label ?? null,
					expiresAt,
				})
				.returning();

			return link ?? null;
		}),

	// =========================================================================
	// PROTECTED: Get links for a resource
	// =========================================================================
	getLinksForResource: protectedProcedure
		.input(
			z.object({
				resourceType: z.enum(["report"]),
				resourceId: z.string().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db.query.shareLinks.findMany({
				where: and(
					eq(shareLinks.resourceType, input.resourceType),
					eq(shareLinks.resourceId, input.resourceId),
					eq(shareLinks.userId, ctx.user.id),
				),
				orderBy: [desc(shareLinks.createdAt)],
			});
		}),

	// =========================================================================
	// PROTECTED: Revoke a link (soft disable)
	// =========================================================================
	revokeLink: protectedProcedure
		.input(z.object({ linkId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [updated] = await ctx.db
				.update(shareLinks)
				.set({ isActive: false })
				.where(
					and(
						eq(shareLinks.id, input.linkId),
						eq(shareLinks.userId, ctx.user.id),
					),
				)
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: ERR_SHARE_LINK_NOT_FOUND,
				});
			}

			return updated;
		}),

	// =========================================================================
	// PROTECTED: Delete a link (hard delete)
	// =========================================================================
	deleteLink: protectedProcedure
		.input(z.object({ linkId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [deleted] = await ctx.db
				.delete(shareLinks)
				.where(
					and(
						eq(shareLinks.id, input.linkId),
						eq(shareLinks.userId, ctx.user.id),
					),
				)
				.returning();

			if (!deleted) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: ERR_SHARE_LINK_NOT_FOUND,
				});
			}

			return { success: true };
		}),

	// =========================================================================
	// PROTECTED: List all user's share links
	// =========================================================================
	listUserLinks: protectedProcedure
		.input(z.object({ limit: z.number().int().positive().default(50) }))
		.query(async ({ ctx, input }) => {
			return ctx.db.query.shareLinks.findMany({
				where: eq(shareLinks.userId, ctx.user.id),
				orderBy: [desc(shareLinks.createdAt)],
				limit: input.limit,
			});
		}),
});
