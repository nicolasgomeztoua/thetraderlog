import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { getEffectivePlan } from "@/lib/billing/utils";
import {
	AI_CHAT_DAILY_LIMIT,
	AI_REPORTS_MONTHLY_LIMIT,
	FEATURE_AI_CHAT,
	FEATURE_BETA_ACCESS,
	PLAN_FREE,
	PLAN_METADATA,
	PLAN_PRO,
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
export function getCurrentMonthYear(): { month: number; year: number } {
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
				updatedAt: new Date(),
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
		} catch (rollbackErr) {
			console.error(
				"Failed to rollback chat usage counter after limit exceeded",
				{ userId, date: today, staleCount: used, rollbackErr },
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
			reportsUsed: 1,
			reportsMonth: month,
			reportsYear: year,
		})
		.onConflictDoUpdate({
			target: [aiUsage.userId, aiUsage.reportsMonth, aiUsage.reportsYear],
			set: {
				reportsUsed: sql`${aiUsage.reportsUsed} + 1`,
				updatedAt: new Date(),
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
		} catch (rollbackErr) {
			console.error(
				"Failed to rollback report usage counter after limit exceeded",
				{ userId, month, year, staleCount: used, rollbackErr },
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
		const isBeta =
			ctx.clerkAuth?.has({ feature: FEATURE_BETA_ACCESS }) ?? false;
		const effectivePlan = ctx.clerkAuth
			? isBeta
				? PLAN_PRO
				: getEffectivePlan(ctx.clerkAuth)
			: PLAN_FREE;
		const metadata = PLAN_METADATA[effectivePlan];

		return {
			plan: effectivePlan,
			beta: isBeta,
			metadata: metadata ?? PLAN_METADATA[PLAN_FREE],
		};
	}),

	getUsage: protectedProcedure.query(async ({ ctx }) => {
		const isBeta =
			ctx.clerkAuth?.has({ feature: FEATURE_BETA_ACCESS }) ?? false;
		const hasAiAccess =
			isBeta || (ctx.clerkAuth?.has({ feature: FEATURE_AI_CHAT }) ?? false);
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

		// null limit = unlimited (beta) or no AI access (free/starter).
		// Numeric limit = paid plan with AI entitlements.
		return {
			chat: {
				used: chatRow?.used ?? 0,
				limit: isBeta ? null : hasAiAccess ? AI_CHAT_DAILY_LIMIT : null,
			},
			reports: {
				used: reportRow?.used ?? 0,
				limit: isBeta ? null : hasAiAccess ? AI_REPORTS_MONTHLY_LIMIT : null,
			},
		};
	}),
});
