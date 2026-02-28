/**
 * Integration tests for the admin system health endpoint.
 *
 * Tests:
 * - Health endpoint returns all expected fields
 * - Database counts are accurate
 * - Non-admin rejected
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

describe("admin.system.health", () => {
	let adminCaller: TestCaller;
	let regularCaller: TestCaller;
	let adminUser: User;

	beforeAll(async () => {
		await truncateAllTables();

		adminUser = await createTestUser({
			role: "admin",
			email: "admin-system@test.local",
			name: "System Admin",
		});
		adminCaller = await createTestCaller(adminUser.clerkId, adminUser);

		const regularUser = await createTestUser({
			role: "user",
			email: "regular-system@test.local",
			name: "Regular System User",
		});
		regularCaller = await createTestCaller(regularUser.clerkId, regularUser);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("auth", () => {
		it("should reject non-admin users with FORBIDDEN", async () => {
			await expect(regularCaller.admin.system.health()).rejects.toThrow(
				ERR_ADMIN_FORBIDDEN,
			);
		});

		it("should reject unauthenticated users with UNAUTHORIZED", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(unauthCaller.admin.system.health()).rejects.toThrow(
				"UNAUTHORIZED",
			);
		});
	});

	describe("response fields", () => {
		it("should return all expected top-level fields", async () => {
			const health = await adminCaller.admin.system.health();

			expect(health).toHaveProperty("databaseStatus");
			expect(health).toHaveProperty("appVersion");
			expect(health).toHaveProperty("tableCounts");
			expect(health).toHaveProperty("lastActivity");
		});

		it("should return database status as connected", async () => {
			const health = await adminCaller.admin.system.health();
			expect(health.databaseStatus).toBe("connected");
		});

		it("should return app version as a string", async () => {
			const health = await adminCaller.admin.system.health();
			expect(typeof health.appVersion).toBe("string");
			expect(health.appVersion).not.toBe("unknown");
		});

		it("should return all table count fields", async () => {
			const health = await adminCaller.admin.system.health();

			expect(health.tableCounts).toHaveProperty("users");
			expect(health.tableCounts).toHaveProperty("trades");
			expect(health.tableCounts).toHaveProperty("accounts");
			expect(health.tableCounts).toHaveProperty("aiConversations");
			expect(health.tableCounts).toHaveProperty("aiMessages");
			expect(health.tableCounts).toHaveProperty("bugReports");
		});

		it("should return all last activity fields", async () => {
			const health = await adminCaller.admin.system.health();

			expect(health.lastActivity).toHaveProperty("lastSignup");
			expect(health.lastActivity).toHaveProperty("lastTrade");
			expect(health.lastActivity).toHaveProperty("lastAiConversation");
		});
	});

	describe("database counts", () => {
		it("should return correct user count", async () => {
			const health = await adminCaller.admin.system.health();
			// 2 users created in beforeAll (admin + regular)
			expect(health.tableCounts.users).toBe(2);
		});

		it("should return zero for tables with no data", async () => {
			const health = await adminCaller.admin.system.health();
			expect(health.tableCounts.trades).toBe(0);
			expect(health.tableCounts.accounts).toBe(0);
			expect(health.tableCounts.aiConversations).toBe(0);
			expect(health.tableCounts.aiMessages).toBe(0);
			expect(health.tableCounts.bugReports).toBe(0);
		});

		it("should return accurate counts after inserting data", async () => {
			const db = getTestDb();

			// Insert an account
			const [account] = await db
				.insert(schema.accounts)
				.values({
					userId: adminUser.id,
					name: "Health Check Account",
					platform: "tradovate",
					accountType: "demo",
					initialBalance: "10000",
					isDefault: true,
				})
				.returning();

			// Insert 2 trades
			await db.insert(schema.trades).values([
				{
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
				},
				{
					userId: adminUser.id,
					accountId: account?.id ?? "",
					symbol: "NQ",
					instrumentType: "futures",
					direction: "short",
					status: "closed",
					entryPrice: "18000.00",
					exitPrice: "17990.00",
					quantity: "1",
					entryTime: new Date(),
					exitTime: new Date(),
					realizedPnl: "200.00",
					netPnl: "195.00",
					fees: "5.00",
				},
			]);

			// Insert a bug report
			await db.insert(schema.bugReports).values({
				userId: adminUser.id,
				title: "Test Bug",
				description: "Test bug report for health check",
				severity: "medium",
				category: "ui",
				status: "open",
			});

			// Insert an AI conversation with messages
			const [conversation] = await db
				.insert(schema.aiConversations)
				.values({
					userId: adminUser.id,
					title: "Health Check AI Chat",
					status: "active",
					mode: "chat",
				})
				.returning();

			await db.insert(schema.aiMessages).values([
				{
					conversationId: conversation?.id ?? "",
					role: "user",
					content: "Hello",
					tokensUsed: 10,
				},
				{
					conversationId: conversation?.id ?? "",
					role: "assistant",
					content: "Hi there!",
					model: "test-model",
					tokensUsed: 20,
				},
			]);

			const health = await adminCaller.admin.system.health();

			expect(health.tableCounts.users).toBe(2);
			expect(health.tableCounts.accounts).toBe(1);
			expect(health.tableCounts.trades).toBe(2);
			expect(health.tableCounts.bugReports).toBe(1);
			expect(health.tableCounts.aiConversations).toBe(1);
			expect(health.tableCounts.aiMessages).toBe(2);
		});
	});

	describe("last activity", () => {
		it("should return last signup date", async () => {
			const health = await adminCaller.admin.system.health();
			expect(health.lastActivity.lastSignup).not.toBeNull();
		});

		it("should return last trade date", async () => {
			// Trades were inserted in a previous test
			const health = await adminCaller.admin.system.health();
			expect(health.lastActivity.lastTrade).not.toBeNull();
		});

		it("should return last AI conversation date", async () => {
			// AI conversation was inserted in a previous test
			const health = await adminCaller.admin.system.health();
			expect(health.lastActivity.lastAiConversation).not.toBeNull();
		});

		it("should return null for last activity when no data exists", async () => {
			await truncateAllTables();

			const freshAdmin = await createTestUser({
				role: "admin",
				email: "fresh-system-admin@test.local",
				name: "Fresh System Admin",
			});
			const freshCaller = await createTestCaller(
				freshAdmin.clerkId,
				freshAdmin,
			);

			const health = await freshCaller.admin.system.health();

			// lastSignup should have a value (we just created a user)
			expect(health.lastActivity.lastSignup).not.toBeNull();
			// But no trades or AI conversations
			expect(health.lastActivity.lastTrade).toBeNull();
			expect(health.lastActivity.lastAiConversation).toBeNull();
		});
	});
});
