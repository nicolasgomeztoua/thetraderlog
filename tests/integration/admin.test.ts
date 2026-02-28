/**
 * Integration tests for admin middleware and platform stats endpoint.
 *
 * Tests:
 * - Non-admin users get FORBIDDEN on admin endpoints
 * - Admin users can access platform stats
 * - Platform stats returns correct counts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERR_ADMIN_FORBIDDEN } from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	createUnauthenticatedCaller,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("admin middleware & platform stats", () => {
	let adminCaller: TestCaller;
	let regularCaller: TestCaller;
	let adminUser: User;
	let regularUser: User;

	beforeAll(async () => {
		await truncateAllTables();

		adminUser = await createTestUser({
			role: "admin",
			email: "admin@test.local",
			name: "Admin User",
		});
		adminCaller = await createTestCaller(adminUser.clerkId, adminUser);

		regularUser = await createTestUser({
			role: "user",
			email: "regular@test.local",
			name: "Regular User",
		});
		regularCaller = await createTestCaller(regularUser.clerkId, regularUser);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("admin middleware", () => {
		it("should reject non-admin users with FORBIDDEN", async () => {
			await expect(
				regularCaller.admin.analytics.platformStats(),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject unauthenticated users with UNAUTHORIZED", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(
				unauthCaller.admin.analytics.platformStats(),
			).rejects.toThrow("UNAUTHORIZED");
		});

		it("should allow admin users to access admin endpoints", async () => {
			const result = await adminCaller.admin.analytics.platformStats();
			expect(result).toBeDefined();
		});
	});

	describe("admin.analytics.platformStats", () => {
		it("should return all expected fields", async () => {
			const stats = await adminCaller.admin.analytics.platformStats();

			expect(stats).toHaveProperty("totalUsers");
			expect(stats).toHaveProperty("activeUsersLast7d");
			expect(stats).toHaveProperty("totalTrades");
			expect(stats).toHaveProperty("openBugReports");
			expect(stats).toHaveProperty("aiConversationsLast7d");
			expect(stats).toHaveProperty("totalTokensUsed");
		});

		it("should return correct user count", async () => {
			const stats = await adminCaller.admin.analytics.platformStats();
			// 2 users created in beforeAll (admin + regular)
			expect(stats.totalUsers).toBe(2);
		});

		it("should return correct trade count and active users from trades", async () => {
			const db = getTestDb();

			const [account] = await db
				.insert(schema.accounts)
				.values({
					userId: adminUser.id,
					name: "Test Account",
					platform: "tradovate",
					accountType: "demo",
					initialBalance: "10000",
					isDefault: true,
				})
				.returning();

			await db.insert(schema.trades).values({
				userId: adminUser.id,
				accountId: account?.id ?? "",
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				entryPrice: "5000.00",
				exitPrice: "5010.00",
				quantity: "1",
				entryTime: new Date(),
				exitTime: new Date(),
				realizedPnl: "500.00",
				netPnl: "495.00",
				fees: "5.00",
			});

			const stats = await adminCaller.admin.analytics.platformStats();
			expect(stats.totalTrades).toBe(1);
			// Admin user has a recent trade, so they should be active
			expect(stats.activeUsersLast7d).toBeGreaterThanOrEqual(1);
		});

		it("should return correct open bug report count", async () => {
			const db = getTestDb();

			await db.insert(schema.bugReports).values([
				{
					userId: adminUser.id,
					title: "Open Bug 1",
					description: "This is an open bug",
					severity: "high",
					category: "ui",
					status: "open",
				},
				{
					userId: adminUser.id,
					title: "Open Bug 2",
					description: "Another open bug",
					severity: "medium",
					category: "data",
					status: "open",
				},
				{
					userId: adminUser.id,
					title: "Closed Bug",
					description: "This bug is resolved",
					severity: "low",
					category: "other",
					status: "resolved",
				},
			]);

			const stats = await adminCaller.admin.analytics.platformStats();
			// Only 2 open bug reports (the resolved one doesn't count)
			expect(stats.openBugReports).toBe(2);
		});

		it("should return correct AI conversation and token counts", async () => {
			const db = getTestDb();

			const [conversation] = await db
				.insert(schema.aiConversations)
				.values({
					userId: adminUser.id,
					title: "Test AI Chat",
					status: "active",
					mode: "chat",
				})
				.returning();

			await db.insert(schema.aiMessages).values([
				{
					conversationId: conversation?.id ?? "",
					role: "user",
					content: "Hello AI",
					tokensUsed: 10,
				},
				{
					conversationId: conversation?.id ?? "",
					role: "assistant",
					content: "Hello! How can I help?",
					model: "test-model",
					tokensUsed: 50,
				},
			]);

			const stats = await adminCaller.admin.analytics.platformStats();
			expect(stats.aiConversationsLast7d).toBeGreaterThanOrEqual(1);
			expect(stats.totalTokensUsed).toBeGreaterThanOrEqual(60);
		});

		it("should deduplicate active users across trades and AI conversations", async () => {
			const stats = await adminCaller.admin.analytics.platformStats();
			// Admin user has both a trade and an AI conversation in last 7 days
			// but should be counted only once in activeUsersLast7d
			expect(stats.activeUsersLast7d).toBe(1);
		});

		it("should return zero counts on empty database", async () => {
			await truncateAllTables();

			const freshAdmin = await createTestUser({
				role: "admin",
				email: "fresh-admin@test.local",
				name: "Fresh Admin",
			});
			const freshCaller = await createTestCaller(
				freshAdmin.clerkId,
				freshAdmin,
			);

			const stats = await freshCaller.admin.analytics.platformStats();
			expect(stats.totalUsers).toBe(1);
			expect(stats.activeUsersLast7d).toBe(0);
			expect(stats.totalTrades).toBe(0);
			expect(stats.openBugReports).toBe(0);
			expect(stats.aiConversationsLast7d).toBe(0);
			expect(stats.totalTokensUsed).toBe(0);
		});
	});
});
