import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import {
	getEffectivePlan,
	isBetaUser,
	type UserWithMetadata,
} from "@/lib/billing/utils";
import {
	AI_CHAT_DAILY_LIMIT,
	AI_REPORTS_MONTHLY_LIMIT,
	PLAN_FREE,
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
): Promise<{ used: number; limit: number | null; date: string }> {
	const today = getTodayDateString();

	const [row] = await db
		.insert(aiUsage)
		.values({
			userId,
			chatMessagesUsed: 1,
			chatMessagesDate: today,
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
		try {
			await db
				.update(aiUsage)
				.set({
					chatMessagesUsed: sql`GREATEST(${aiUsage.chatMessagesUsed} - 1, 0)`,
				})
				.where(
					and(eq(aiUsage.userId, userId), eq(aiUsage.chatMessagesDate, today)),
				);
		} catch {
			console.error(
				"Failed to rollback chat usage counter after limit exceeded",
			);
		}

		throw new TRPCError({
			code: "FORBIDDEN",
			message: ERR_AI_CHAT_LIMIT_REACHED,
		});
	}

	return { used, limit: beta ? null : AI_CHAT_DAILY_LIMIT, date: today };
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
): Promise<{
	used: number;
	limit: number | null;
	month: number;
	year: number;
}> {
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
		try {
			await db
				.update(aiUsage)
				.set({
					reportsUsed: sql`GREATEST(${aiUsage.reportsUsed} - 1, 0)`,
				})
				.where(
					and(
						eq(aiUsage.userId, userId),
						eq(aiUsage.reportsMonth, month),
						eq(aiUsage.reportsYear, year),
					),
				);
		} catch {
			console.error(
				"Failed to rollback report usage counter after limit exceeded",
			);
		}

		throw new TRPCError({
			code: "FORBIDDEN",
			message: ERR_AI_REPORT_LIMIT_REACHED,
		});
	}

	return { used, limit: beta ? null : AI_REPORTS_MONTHLY_LIMIT, month, year };
}

/**
 * Decrement daily chat usage (rollback on AI call failure).
 * Accepts the date from the increment call to avoid midnight boundary issues.
 */
export async function decrementChatUsage(
	db: Database,
	userId: string,
	date: string,
): Promise<void> {
	await db
		.update(aiUsage)
		.set({
			chatMessagesUsed: sql`GREATEST(${aiUsage.chatMessagesUsed} - 1, 0)`,
		})
		.where(and(eq(aiUsage.userId, userId), eq(aiUsage.chatMessagesDate, date)));
}

/**
 * Decrement monthly report usage (rollback on task trigger failure).
 * Accepts month/year from the increment call to avoid month boundary issues.
 */
export async function decrementReportUsage(
	db: Database,
	userId: string,
	month: number,
	year: number,
): Promise<void> {
	await db
		.update(aiUsage)
		.set({
			reportsUsed: sql`GREATEST(${aiUsage.reportsUsed} - 1, 0)`,
		})
		.where(
			and(
				eq(aiUsage.userId, userId),
				eq(aiUsage.reportsMonth, month),
				eq(aiUsage.reportsYear, year),
			),
		);
}

export const billingRouter = createTRPCRouter({
	getCurrentPlan: protectedProcedure.query(({ ctx }) => {
		const userMeta = ctx.user as unknown as UserWithMetadata;
		const beta = isBetaUser(userMeta);
		const effectivePlan = ctx.clerkAuth
			? getEffectivePlan(ctx.clerkAuth, userMeta)
			: PLAN_FREE;
		const metadata = PLAN_METADATA[effectivePlan];

		return {
			plan: effectivePlan,
			metadata: metadata ?? PLAN_METADATA[PLAN_FREE],
			beta,
		};
	}),

	getUsage: protectedProcedure.query(async ({ ctx }) => {
		const userMeta = ctx.user as unknown as UserWithMetadata;
		const beta = isBetaUser(userMeta);
		const today = getTodayDateString();
		const { month, year } = getCurrentMonthYear();

		const [chatRow, reportRow] = await Promise.all([
			ctx.db
				.select({ used: aiUsage.chatMessagesUsed })
				.from(aiUsage)
				.where(
					and(
						eq(aiUsage.userId, ctx.user.id),
						eq(aiUsage.chatMessagesDate, today),
					),
				)
				.then((rows) => rows[0]),
			ctx.db
				.select({ used: aiUsage.reportsUsed })
				.from(aiUsage)
				.where(
					and(
						eq(aiUsage.userId, ctx.user.id),
						eq(aiUsage.reportsMonth, month),
						eq(aiUsage.reportsYear, year),
					),
				)
				.then((rows) => rows[0]),
		]);

		return {
			chat: {
				used: chatRow?.used ?? 0,
				limit: beta ? null : AI_CHAT_DAILY_LIMIT,
			},
			reports: {
				used: reportRow?.used ?? 0,
				limit: beta ? null : AI_REPORTS_MONTHLY_LIMIT,
			},
		};
	}),
});
