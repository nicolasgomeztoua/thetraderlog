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
import {
	incrementAndCheckChatUsage,
	incrementAndCheckReportUsage,
} from "@/server/api/routers/billing";
import type { User } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	getTestDb,
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
		it("should return no plan for user without clerkAuth", async () => {
			const result = await caller.billing.getCurrentPlan();

			expect(result.plan).toBe("none");
			expect(result.metadata).toEqual(PLAN_METADATA.none);
		});

		it("should return pro plan when clerkAuth has pro plan", async () => {
			const proCaller = await createTestCaller(user.clerkId, user, {
				has: ({ plan }) => plan === "pro",
			});
			const result = await proCaller.billing.getCurrentPlan();

			expect(result.plan).toBe("pro");
			expect(result.metadata).toEqual(PLAN_METADATA.pro);
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
		it("should return null limits for user without AI access", async () => {
			const result = await caller.billing.getUsage();

			expect(result.chat.used).toBe(0);
			expect(result.chat.limit).toBeNull();
			expect(result.reports.used).toBe(0);
			expect(result.reports.limit).toBeNull();
		});

		it("should return numeric limits for user with AI access", async () => {
			const aiCaller = await createTestCaller(user.clerkId, user, {
				has: ({ feature }: { feature?: string }) =>
					feature === "ai_chat" || feature === "ai_reports",
			});
			const result = await aiCaller.billing.getUsage();

			expect(result.chat.used).toBe(0);
			expect(result.chat.limit).toBe(AI_CHAT_DAILY_LIMIT);
			expect(result.reports.used).toBe(0);
			expect(result.reports.limit).toBe(AI_REPORTS_MONTHLY_LIMIT);
		});

		it("should return null limits for beta user (via publicMetadata)", async () => {
			const betaUser = await createTestUser();
			const betaCaller = await createTestCaller(betaUser.clerkId, betaUser, {
				has: () => false,
				sessionClaims: {
					metadata: { features: { beta_access: true } },
				},
			});
			const result = await betaCaller.billing.getUsage();

			expect(result.chat.limit).toBeNull();
			expect(result.reports.limit).toBeNull();
		});
	});

	describe("incrementAndCheckChatUsage", () => {
		let chatUser: User;

		beforeAll(async () => {
			chatUser = await createTestUser();
		});

		it("should increment chat counter from zero", async () => {
			const db = getTestDb();
			const result = await incrementAndCheckChatUsage(db, chatUser.id, false);

			expect(result.used).toBe(1);
			expect(result.limit).toBe(AI_CHAT_DAILY_LIMIT);
		});

		it("should increment chat counter on subsequent calls", async () => {
			const db = getTestDb();
			const result = await incrementAndCheckChatUsage(db, chatUser.id, false);

			expect(result.used).toBe(2);
		});

		it("should enforce daily limit", async () => {
			const db = getTestDb();
			// Increment to the limit
			for (let i = 3; i <= AI_CHAT_DAILY_LIMIT; i++) {
				await incrementAndCheckChatUsage(db, chatUser.id, false);
			}

			// Next call should throw
			await expect(
				incrementAndCheckChatUsage(db, chatUser.id, false),
			).rejects.toThrow(ERR_AI_CHAT_LIMIT_REACHED);
		});

		it("should reset counter on a different day", async () => {
			const db = getTestDb();
			const dayUser = await createTestUser();

			const yesterday = new Date();
			yesterday.setUTCDate(yesterday.getUTCDate() - 1);
			const yesterdayStr = yesterday.toISOString().split("T")[0]!;

			// Seed yesterday's row at the limit
			await db.insert(schema.aiUsage).values({
				userId: dayUser.id,
				chatMessagesUsed: AI_CHAT_DAILY_LIMIT,
				chatMessagesDate: yesterdayStr,
			});

			// Today should start fresh at 1
			const result = await incrementAndCheckChatUsage(db, dayUser.id, false);
			expect(result.used).toBe(1);
		});

		it("should allow beta user to exceed limit", async () => {
			const db = getTestDb();
			const betaUser = await createTestUser();

			// Increment many times — should never throw
			for (let i = 0; i < AI_CHAT_DAILY_LIMIT + 5; i++) {
				const result = await incrementAndCheckChatUsage(db, betaUser.id, true);
				expect(result.limit).toBeNull();
			}

			const finalResult = await incrementAndCheckChatUsage(
				db,
				betaUser.id,
				true,
			);
			expect(finalResult.used).toBe(AI_CHAT_DAILY_LIMIT + 6);
			expect(finalResult.limit).toBeNull();
		});
	});

	describe("incrementAndCheckReportUsage", () => {
		let reportUser: User;

		beforeAll(async () => {
			reportUser = await createTestUser();
		});

		it("should increment report counter from zero", async () => {
			const db = getTestDb();
			const result = await incrementAndCheckReportUsage(
				db,
				reportUser.id,
				false,
			);

			expect(result.used).toBe(1);
			expect(result.limit).toBe(AI_REPORTS_MONTHLY_LIMIT);
		});

		it("should increment report counter on subsequent calls", async () => {
			const db = getTestDb();
			const result = await incrementAndCheckReportUsage(
				db,
				reportUser.id,
				false,
			);

			expect(result.used).toBe(2);
		});

		it("should enforce monthly limit", async () => {
			const db = getTestDb();
			// Increment to the limit
			for (let i = 3; i <= AI_REPORTS_MONTHLY_LIMIT; i++) {
				await incrementAndCheckReportUsage(db, reportUser.id, false);
			}

			// Next call should throw
			await expect(
				incrementAndCheckReportUsage(db, reportUser.id, false),
			).rejects.toThrow(ERR_AI_REPORT_LIMIT_REACHED);
		});

		it("should allow beta user to exceed limit", async () => {
			const db = getTestDb();
			const betaUser = await createTestUser();

			// Increment beyond limit — should never throw
			for (let i = 0; i < AI_REPORTS_MONTHLY_LIMIT + 3; i++) {
				const result = await incrementAndCheckReportUsage(
					db,
					betaUser.id,
					true,
				);
				expect(result.limit).toBeNull();
			}

			const finalResult = await incrementAndCheckReportUsage(
				db,
				betaUser.id,
				true,
			);
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
