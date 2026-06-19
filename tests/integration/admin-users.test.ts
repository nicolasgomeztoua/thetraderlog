/**
 * Integration tests for admin user management endpoints.
 *
 * Tests:
 * - list returns users with counts
 * - search by email works
 * - getById returns full user details
 * - updateRole toggles role correctly
 * - non-admin rejected
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	ERR_ADMIN_FORBIDDEN,
	ERR_ADMIN_USER_NOT_FOUND,
} from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("admin users endpoints", () => {
	let adminCaller: TestCaller;
	let regularCaller: TestCaller;
	let adminUser: User;
	let regularUser: User;
	let userWithData: User;

	beforeAll(async () => {
		await truncateAllTables();

		adminUser = await createTestUser({
			role: "admin",
			email: "admin-users@test.local",
			name: "Admin User Manager",
		});
		adminCaller = await createTestCaller(adminUser.clerkId, adminUser);

		regularUser = await createTestUser({
			role: "user",
			email: "regular-users@test.local",
			name: "Regular User",
		});
		regularCaller = await createTestCaller(regularUser.clerkId, regularUser);

		// Create a user with accounts, trades, AI conversations, and bug reports
		userWithData = await createTestUser({
			role: "user",
			email: "data-user@test.local",
			name: "Data Rich User",
		});

		const db = getTestDb();

		// Create accounts for userWithData
		const [account1] = await db
			.insert(schema.accounts)
			.values([
				{
					userId: userWithData.id,
					name: "Live Account",
					platform: "tradovate",
					accountType: "live",
					initialBalance: "50000",
					isDefault: true,
				},
				{
					userId: userWithData.id,
					name: "Demo Account",
					platform: "tradovate",
					accountType: "demo",
					initialBalance: "10000",
					isDefault: false,
				},
			])
			.returning();

		// Create trades for userWithData
		await db.insert(schema.trades).values([
			{
				userId: userWithData.id,
				accountId: account1?.id ?? "",
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000.00",
				exitPrice: "5020.00",
				quantity: "1",
				entryTime: new Date(),
				exitTime: new Date(),
				realizedPnl: "1000.00",
				netPnl: "995.00",
				fees: "5.00",
			},
			{
				userId: userWithData.id,
				accountId: account1?.id ?? "",
				symbol: "NQ",
				direction: "short",
				status: "closed",
				entryPrice: "18000.00",
				exitPrice: "17980.00",
				quantity: "1",
				entryTime: new Date(),
				exitTime: new Date(),
				realizedPnl: "400.00",
				netPnl: "395.00",
				fees: "5.00",
			},
			{
				userId: userWithData.id,
				accountId: account1?.id ?? "",
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000.00",
				exitPrice: "4990.00",
				quantity: "1",
				entryTime: new Date(),
				exitTime: new Date(),
				realizedPnl: "-500.00",
				netPnl: "-505.00",
				fees: "5.00",
			},
		]);

		// Create AI conversation for userWithData
		const [convo] = await db
			.insert(schema.aiConversations)
			.values({
				userId: userWithData.id,
				title: "Test Chat",
				status: "active",
				mode: "chat",
			})
			.returning();

		await db.insert(schema.aiMessages).values({
			conversationId: convo?.id ?? "",
			role: "user",
			content: "Hello",
			tokensUsed: 10,
		});

		// Create bug report for userWithData
		await db.insert(schema.bugReports).values({
			userId: userWithData.id,
			title: "Test Bug",
			description: "A test bug report",
			severity: "medium",
			category: "ui",
			status: "open",
		});
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("admin.users.list", () => {
		it("should return users with account and trade counts", async () => {
			const result = await adminCaller.admin.users.list({
				page: 1,
				pageSize: 10,
			});

			expect(result.items.length).toBe(3);
			expect(result.total).toBe(3);
			expect(result.page).toBe(1);
			expect(result.totalPages).toBe(1);

			// Each user should have expected fields
			for (const item of result.items) {
				expect(item.id).toBeDefined();
				expect(item.name).toBeDefined();
				expect(item.email).toBeDefined();
				expect(item.role).toBeDefined();
				expect(item.createdAt).toBeDefined();
				expect(typeof item.accountCount).toBe("number");
				expect(typeof item.tradeCount).toBe("number");
			}
		});

		it("should return correct counts for user with data", async () => {
			const result = await adminCaller.admin.users.list({
				page: 1,
				pageSize: 10,
			});

			const dataUser = result.items.find(
				(u) => u.email === "data-user@test.local",
			);
			expect(dataUser).toBeDefined();
			expect(dataUser?.accountCount).toBe(2);
			expect(dataUser?.tradeCount).toBe(3);
			expect(dataUser?.lastActive).toBeDefined();
		});

		it("should search by email", async () => {
			const result = await adminCaller.admin.users.list({
				search: "data-user",
				page: 1,
				pageSize: 10,
			});

			expect(result.items.length).toBe(1);
			expect(result.items[0]?.email).toBe("data-user@test.local");
			expect(result.total).toBe(1);
		});

		it("should search by name (case insensitive)", async () => {
			const result = await adminCaller.admin.users.list({
				search: "data rich",
				page: 1,
				pageSize: 10,
			});

			expect(result.items.length).toBe(1);
			expect(result.items[0]?.name).toBe("Data Rich User");
		});

		it("should return empty results for non-matching search", async () => {
			const result = await adminCaller.admin.users.list({
				search: "nonexistent-user-xyz",
				page: 1,
				pageSize: 10,
			});

			expect(result.items.length).toBe(0);
			expect(result.total).toBe(0);
		});

		it("should support pagination", async () => {
			const page1 = await adminCaller.admin.users.list({
				page: 1,
				pageSize: 2,
			});

			expect(page1.items.length).toBe(2);
			expect(page1.total).toBe(3);
			expect(page1.totalPages).toBe(2);

			const page2 = await adminCaller.admin.users.list({
				page: 2,
				pageSize: 2,
			});

			expect(page2.items.length).toBe(1);
			expect(page2.page).toBe(2);

			// Items on different pages should be different
			const page1Ids = page1.items.map((i) => i.id);
			const page2Ids = page2.items.map((i) => i.id);
			for (const id of page2Ids) {
				expect(page1Ids).not.toContain(id);
			}
		});

		it("should sort by newest first", async () => {
			const result = await adminCaller.admin.users.list({
				page: 1,
				pageSize: 10,
			});

			for (let i = 0; i < result.items.length - 1; i++) {
				const current = new Date(result.items[i]?.createdAt ?? 0).getTime();
				const next = new Date(result.items[i + 1]?.createdAt ?? 0).getTime();
				expect(current).toBeGreaterThanOrEqual(next);
			}
		});
	});

	describe("admin.users.getById", () => {
		it("should return full user details with accounts", async () => {
			const user = await adminCaller.admin.users.getById({
				id: userWithData.id,
			});

			expect(user.id).toBe(userWithData.id);
			expect(user.name).toBe("Data Rich User");
			expect(user.email).toBe("data-user@test.local");
			expect(user.role).toBe("user");
			expect(user.createdAt).toBeDefined();

			// Accounts
			expect(user.accounts.length).toBe(2);
			const liveAccount = user.accounts.find((a) => a.accountType === "live");
			expect(liveAccount).toBeDefined();
			expect(liveAccount?.name).toBe("Live Account");
		});

		it("should return recent trades", async () => {
			const user = await adminCaller.admin.users.getById({
				id: userWithData.id,
			});

			expect(user.recentTrades.length).toBe(3);
			for (const trade of user.recentTrades) {
				expect(trade.id).toBeDefined();
				expect(trade.symbol).toBeDefined();
				expect(trade.direction).toBeDefined();
				expect(trade.status).toBeDefined();
			}
		});

		it("should return AI conversation count", async () => {
			const user = await adminCaller.admin.users.getById({
				id: userWithData.id,
			});

			expect(user.aiConversationCount).toBe(1);
		});

		it("should return bug report count", async () => {
			const user = await adminCaller.admin.users.getById({
				id: userWithData.id,
			});

			expect(user.bugReportCount).toBe(1);
		});

		it("should return zero counts for user without data", async () => {
			const user = await adminCaller.admin.users.getById({
				id: regularUser.id,
			});

			expect(user.id).toBe(regularUser.id);
			expect(user.accounts.length).toBe(0);
			expect(user.recentTrades.length).toBe(0);
			expect(user.aiConversationCount).toBe(0);
			expect(user.bugReportCount).toBe(0);
		});

		it("should throw NOT_FOUND for non-existent user", async () => {
			await expect(
				adminCaller.admin.users.getById({ id: "nonexistent-user-id" }),
			).rejects.toThrow(ERR_ADMIN_USER_NOT_FOUND);
		});
	});

	describe("admin.users.updateRole", () => {
		it("should promote user to admin", async () => {
			const updated = await adminCaller.admin.users.updateRole({
				id: regularUser.id,
				role: "admin",
			});

			expect(updated.id).toBe(regularUser.id);
			expect(updated.role).toBe("admin");
		});

		it("should demote admin to user", async () => {
			const updated = await adminCaller.admin.users.updateRole({
				id: regularUser.id,
				role: "user",
			});

			expect(updated.id).toBe(regularUser.id);
			expect(updated.role).toBe("user");
		});

		it("should throw NOT_FOUND for non-existent user", async () => {
			await expect(
				adminCaller.admin.users.updateRole({
					id: "nonexistent-user-id",
					role: "admin",
				}),
			).rejects.toThrow(ERR_ADMIN_USER_NOT_FOUND);
		});
	});

	describe("admin authorization", () => {
		it("should reject non-admin on users.list", async () => {
			await expect(
				regularCaller.admin.users.list({ page: 1, pageSize: 10 }),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject non-admin on users.getById", async () => {
			await expect(
				regularCaller.admin.users.getById({ id: adminUser.id }),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject non-admin on users.updateRole", async () => {
			await expect(
				regularCaller.admin.users.updateRole({
					id: adminUser.id,
					role: "user",
				}),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});
	});
});
