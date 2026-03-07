import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { getEffectivePlan, isBetaUser } from "@/lib/billing/utils";
import {
	AI_CHAT_DAILY_LIMIT,
	AI_REPORTS_MONTHLY_LIMIT,
	PLAN_METADATA,
} from "@/lib/constants/billing";
import {
	ERR_AI_CHAT_LIMIT_REACHED,
	ERR_AI_REPORT_LIMIT_REACHED,
} from "@/lib/constants/errors";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { Database } from "@/server/db/create-db";
import { aiUsage } from "@/server/db/schema";

/**
 * Minimal interface matching what isBetaUser/getEffectivePlan expect.
 * DB users don't have publicMetadata, so beta defaults to false.
 * In production, Clerk's session claims handle beta access through has().
 */
type UserWithMetadata = { publicMetadata?: Record<string, unknown> };

/**
 * Get today's date as YYYY-MM-DD string (UTC).
 */
function getTodayDateString(): string {
	return new Date().toISOString().split("T")[0] as string;
}

/**
 * Get current month and year (UTC).
 */
function getCurrentMonthYear(): { month: number; year: number } {
	const now = new Date();
	return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

/**
 * Increment daily chat usage and enforce limit.
 * Throws TRPCError FORBIDDEN if limit exceeded (non-beta users).
 * Shared by the billing router endpoint and the AI router.
 */
export async function incrementAndCheckChatUsage(
	db: Database,
	userId: string,
	beta: boolean,
): Promise<{ used: number; limit: number | null }> {
	const today = getTodayDateString();

	const [row] = await db
		.insert(aiUsage)
		.values({
			userId,
			chatMessagesUsed: 1,
			chatMessagesDate: today,
			reportsUsed: 0,
		})
		.onConflictDoUpdate({
			target: [aiUsage.userId, aiUsage.chatMessagesDate],
			set: {
				chatMessagesUsed: sql`${aiUsage.chatMessagesUsed} + 1`,
			},
		})
		.returning();

	const used = row?.chatMessagesUsed ?? 1;

	if (!beta && used > AI_CHAT_DAILY_LIMIT) {
		await db
			.update(aiUsage)
			.set({
				chatMessagesUsed: sql`${aiUsage.chatMessagesUsed} - 1`,
			})
			.where(
				and(eq(aiUsage.userId, userId), eq(aiUsage.chatMessagesDate, today)),
			);

		throw new TRPCError({
			code: "FORBIDDEN",
			message: ERR_AI_CHAT_LIMIT_REACHED,
		});
	}

	return { used, limit: beta ? null : AI_CHAT_DAILY_LIMIT };
}

/**
 * Increment monthly report usage and enforce limit.
 * Throws TRPCError FORBIDDEN if limit exceeded (non-beta users).
 * Shared by the billing router endpoint and the AI router.
 */
export async function incrementAndCheckReportUsage(
	db: Database,
	userId: string,
	beta: boolean,
): Promise<{ used: number; limit: number | null }> {
	const { month, year } = getCurrentMonthYear();

	const [row] = await db
		.insert(aiUsage)
		.values({
			userId,
			chatMessagesUsed: 0,
			reportsUsed: 1,
			reportsMonth: month,
			reportsYear: year,
		})
		.onConflictDoUpdate({
			target: [aiUsage.userId, aiUsage.reportsMonth, aiUsage.reportsYear],
			set: {
				reportsUsed: sql`${aiUsage.reportsUsed} + 1`,
			},
		})
		.returning();

	const used = row?.reportsUsed ?? 1;

	if (!beta && used > AI_REPORTS_MONTHLY_LIMIT) {
		await db
			.update(aiUsage)
			.set({
				reportsUsed: sql`${aiUsage.reportsUsed} - 1`,
			})
			.where(
				and(
					eq(aiUsage.userId, userId),
					eq(aiUsage.reportsMonth, month),
					eq(aiUsage.reportsYear, year),
				),
			);

		throw new TRPCError({
			code: "FORBIDDEN",
			message: ERR_AI_REPORT_LIMIT_REACHED,
		});
	}

	return { used, limit: beta ? null : AI_REPORTS_MONTHLY_LIMIT };
}

export const billingRouter = createTRPCRouter({
	getCurrentPlan: protectedProcedure.query(({ ctx }) => {
		const userMeta = ctx.user as unknown as UserWithMetadata;
		const beta = isBetaUser(userMeta);
		const effectivePlan = ctx.clerkAuth
			? getEffectivePlan(ctx.clerkAuth, userMeta)
			: "free";
		const metadata = PLAN_METADATA[effectivePlan];

		return {
			plan: effectivePlan,
			metadata: metadata ?? PLAN_METADATA.free,
			beta,
		};
	}),

	getUsage: protectedProcedure.query(async ({ ctx }) => {
		const userMeta = ctx.user as unknown as UserWithMetadata;
		const beta = isBetaUser(userMeta);
		const today = getTodayDateString();
		const { month, year } = getCurrentMonthYear();

		// Upsert daily chat usage row
		const [chatRow] = await ctx.db
			.insert(aiUsage)
			.values({
				userId: ctx.user.id,
				chatMessagesUsed: 0,
				chatMessagesDate: today,
				reportsUsed: 0,
			})
			.onConflictDoUpdate({
				target: [aiUsage.userId, aiUsage.chatMessagesDate],
				set: { updatedAt: new Date() },
			})
			.returning();

		// Upsert monthly report usage row
		const [reportRow] = await ctx.db
			.insert(aiUsage)
			.values({
				userId: ctx.user.id,
				chatMessagesUsed: 0,
				reportsUsed: 0,
				reportsMonth: month,
				reportsYear: year,
			})
			.onConflictDoUpdate({
				target: [aiUsage.userId, aiUsage.reportsMonth, aiUsage.reportsYear],
				set: { updatedAt: new Date() },
			})
			.returning();

		return {
			chat: {
				used: chatRow?.chatMessagesUsed ?? 0,
				limit: beta ? null : AI_CHAT_DAILY_LIMIT,
			},
			reports: {
				used: reportRow?.reportsUsed ?? 0,
				limit: beta ? null : AI_REPORTS_MONTHLY_LIMIT,
			},
		};
	}),

	incrementChatUsage: protectedProcedure.mutation(async ({ ctx }) => {
		const userMeta = ctx.user as unknown as UserWithMetadata;
		const beta = isBetaUser(userMeta);
		return incrementAndCheckChatUsage(ctx.db, ctx.user.id, beta);
	}),

	incrementReportUsage: protectedProcedure.mutation(async ({ ctx }) => {
		const userMeta = ctx.user as unknown as UserWithMetadata;
		const beta = isBetaUser(userMeta);
		return incrementAndCheckReportUsage(ctx.db, ctx.user.id, beta);
	}),
});
