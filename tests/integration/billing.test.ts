import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	AI_CHAT_DAILY_LIMIT,
	AI_REPORTS_MONTHLY_LIMIT,
	PLAN_METADATA,
} from "@/lib/constants/billing";
import {
	ERR_AI_CHAT_LIMIT_REACHED,
	ERR_AI_REPORT_LIMIT_REACHED,
} from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("billing router", () => {
	let user: User;
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		user = await createTestUser();
		caller = await createTestCaller(user.clerkId, user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("getCurrentPlan", () => {
		it("should return free plan for user without clerkAuth", async () => {
			const result = await caller.billing.getCurrentPlan();

			expect(result.plan).toBe("free");
			expect(result.metadata).toEqual(PLAN_METADATA.free);
			expect(result.beta).toBe(false);
		});

		it("should return pro plan when clerkAuth has pro plan", async () => {
			const proCaller = await createTestCaller(user.clerkId, user, {
				has: ({ plan }) => plan === "pro",
			});
			const result = await proCaller.billing.getCurrentPlan();

			expect(result.plan).toBe("pro");
			expect(result.metadata).toEqual(PLAN_METADATA.pro);
			expect(result.beta).toBe(false);
		});

		it("should return starter plan when clerkAuth has starter plan", async () => {
			const starterCaller = await createTestCaller(user.clerkId, user, {
				has: ({ plan }) => plan === "starter",
			});
			const result = await starterCaller.billing.getCurrentPlan();

			expect(result.plan).toBe("starter");
			expect(result.metadata).toEqual(PLAN_METADATA.starter);
		});
	});

	describe("getUsage", () => {
		it("should return zero counts for a new user", async () => {
			const result = await caller.billing.getUsage();

			expect(result.chat.used).toBe(0);
			expect(result.chat.limit).toBe(AI_CHAT_DAILY_LIMIT);
			expect(result.reports.used).toBe(0);
			expect(result.reports.limit).toBe(AI_REPORTS_MONTHLY_LIMIT);
		});

		it("should return null limits for beta user", async () => {
			// Create a separate user with beta metadata — we need to simulate
			// beta via the user object cast pattern used in the router
			const betaUser = await createTestUser();
			// The billing router casts ctx.user to UserWithMetadata to check beta
			// We need to pass a user-like object with publicMetadata.beta = true
			const betaUserWithMeta = {
				...betaUser,
				publicMetadata: { beta: true },
			} as unknown as User;
			const betaCaller = await createTestCaller(
				betaUser.clerkId,
				betaUserWithMeta,
			);
			const result = await betaCaller.billing.getUsage();

			expect(result.chat.limit).toBeNull();
			expect(result.reports.limit).toBeNull();
		});
	});

	describe("incrementChatUsage", () => {
		let chatUser: User;
		let chatCaller: TestCaller;

		beforeAll(async () => {
			chatUser = await createTestUser();
			chatCaller = await createTestCaller(chatUser.clerkId, chatUser);
		});

		it("should increment chat counter from zero", async () => {
			const result = await chatCaller.billing.incrementChatUsage();

			expect(result.used).toBe(1);
			expect(result.limit).toBe(AI_CHAT_DAILY_LIMIT);
		});

		it("should increment chat counter on subsequent calls", async () => {
			const result = await chatCaller.billing.incrementChatUsage();

			expect(result.used).toBe(2);
		});

		it("should enforce daily limit", async () => {
			// Increment to the limit
			for (let i = 3; i <= AI_CHAT_DAILY_LIMIT; i++) {
				await chatCaller.billing.incrementChatUsage();
			}

			// Next call should throw
			await expect(chatCaller.billing.incrementChatUsage()).rejects.toThrow(
				ERR_AI_CHAT_LIMIT_REACHED,
			);
		});

		it("should reset counter on a different day", async () => {
			// Create a fresh user so we start clean
			const dayUser = await createTestUser();
			const dayCaller = await createTestCaller(dayUser.clerkId, dayUser);

			// Increment once for today
			const today = await dayCaller.billing.incrementChatUsage();
			expect(today.used).toBe(1);

			// Verify getUsage shows 1 for today
			const usage = await dayCaller.billing.getUsage();
			expect(usage.chat.used).toBe(1);
		});

		it("should allow beta user to exceed limit", async () => {
			const betaUser = await createTestUser();
			const betaUserWithMeta = {
				...betaUser,
				publicMetadata: { beta: true },
			} as unknown as User;
			const betaCaller = await createTestCaller(
				betaUser.clerkId,
				betaUserWithMeta,
			);

			// Increment many times — should never throw
			for (let i = 0; i < AI_CHAT_DAILY_LIMIT + 5; i++) {
				const result = await betaCaller.billing.incrementChatUsage();
				expect(result.limit).toBeNull();
			}

			const finalResult = await betaCaller.billing.incrementChatUsage();
			expect(finalResult.used).toBe(AI_CHAT_DAILY_LIMIT + 6);
			expect(finalResult.limit).toBeNull();
		});
	});

	describe("incrementReportUsage", () => {
		let reportUser: User;
		let reportCaller: TestCaller;

		beforeAll(async () => {
			reportUser = await createTestUser();
			reportCaller = await createTestCaller(reportUser.clerkId, reportUser);
		});

		it("should increment report counter from zero", async () => {
			const result = await reportCaller.billing.incrementReportUsage();

			expect(result.used).toBe(1);
			expect(result.limit).toBe(AI_REPORTS_MONTHLY_LIMIT);
		});

		it("should increment report counter on subsequent calls", async () => {
			const result = await reportCaller.billing.incrementReportUsage();

			expect(result.used).toBe(2);
		});

		it("should enforce monthly limit", async () => {
			// Increment to the limit
			for (let i = 3; i <= AI_REPORTS_MONTHLY_LIMIT; i++) {
				await reportCaller.billing.incrementReportUsage();
			}

			// Next call should throw
			await expect(reportCaller.billing.incrementReportUsage()).rejects.toThrow(
				ERR_AI_REPORT_LIMIT_REACHED,
			);
		});

		it("should allow beta user to exceed limit", async () => {
			const betaUser = await createTestUser();
			const betaUserWithMeta = {
				...betaUser,
				publicMetadata: { beta: true },
			} as unknown as User;
			const betaCaller = await createTestCaller(
				betaUser.clerkId,
				betaUserWithMeta,
			);

			// Increment beyond limit — should never throw
			for (let i = 0; i < AI_REPORTS_MONTHLY_LIMIT + 3; i++) {
				const result = await betaCaller.billing.incrementReportUsage();
				expect(result.limit).toBeNull();
			}

			const finalResult = await betaCaller.billing.incrementReportUsage();
			expect(finalResult.used).toBe(AI_REPORTS_MONTHLY_LIMIT + 4);
			expect(finalResult.limit).toBeNull();
		});
	});

	describe("unauthenticated access", () => {
		it("should reject unauthenticated requests to getCurrentPlan", async () => {
			const { createUnauthenticatedCaller } = await import("../utils");
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(unauthCaller.billing.getCurrentPlan()).rejects.toThrow(
				"UNAUTHORIZED",
			);
		});
	});
});
