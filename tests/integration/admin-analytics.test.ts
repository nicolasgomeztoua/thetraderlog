/**
 * Integration tests for admin platform analytics endpoints.
 *
 * Tests:
 * - growth: returns daily new user counts with cumulative totals
 * - tradingActivity: returns daily trade data (count, P&L, avg size)
 * - topTraders: returns ranked users by total P&L
 * - accountBreakdown: returns correct counts per account type
 * - Non-admin users are rejected
 */

import { eq } from "drizzle-orm";
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

describe("admin analytics endpoints", () => {
	let adminCaller: TestCaller;
	let regularCaller: TestCaller;
	let adminUser: User;
	let regularUser: User;
	let secondUser: User;

	beforeAll(async () => {
		await truncateAllTables();

		adminUser = await createTestUser({
			role: "admin",
			email: "admin-analytics@test.local",
			name: "Admin Analytics",
		});
		adminCaller = await createTestCaller(adminUser.clerkId, adminUser);

		regularUser = await createTestUser({
			role: "user",
			email: "regular-analytics@test.local",
			name: "Regular Analytics",
		});
		regularCaller = await createTestCaller(regularUser.clerkId, regularUser);

		secondUser = await createTestUser({
			role: "user",
			email: "second-analytics@test.local",
			name: "Second User",
		});
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("admin.analytics.growth", () => {
		it("should return daily new user counts", async () => {
			const result = await adminCaller.admin.analytics.growth();

			expect(result).toHaveProperty("daily");
			expect(Array.isArray(result.daily)).toBe(true);
			// We created 3 users today, so there should be at least one day
			expect(result.daily.length).toBeGreaterThanOrEqual(1);
		});

		it("should include newUsers and cumulativeTotal for each day", async () => {
			const result = await adminCaller.admin.analytics.growth();

			for (const day of result.daily) {
				expect(day).toHaveProperty("date");
				expect(day).toHaveProperty("newUsers");
				expect(day).toHaveProperty("cumulativeTotal");
				expect(typeof day.date).toBe("string");
				expect(typeof day.newUsers).toBe("number");
				expect(typeof day.cumulativeTotal).toBe("number");
			}
		});

		it("should show correct cumulative total for today", async () => {
			const result = await adminCaller.admin.analytics.growth();

			// Last entry should have cumulative = 3 (all users created today)
			const lastDay = result.daily[result.daily.length - 1];
			expect(lastDay?.cumulativeTotal).toBe(3);
			expect(lastDay?.newUsers).toBe(3);
		});
	});

	describe("admin.analytics.tradingActivity", () => {
		beforeAll(async () => {
			const db = getTestDb();

			// Create accounts for users
			const [adminAccount] = await db
				.insert(schema.accounts)
				.values({
					userId: adminUser.id,
					name: "Admin Trading Account",
					platform: "tradovate",
					accountType: "live",
					initialBalance: "50000",
					isDefault: true,
				})
				.returning();

			const [regularAccount] = await db
				.insert(schema.accounts)
				.values({
					userId: regularUser.id,
					name: "Regular Trading Account",
					platform: "tradovate",
					accountType: "demo",
					initialBalance: "10000",
					isDefault: true,
				})
				.returning();

			// Create trades for today
			await db.insert(schema.trades).values([
				{
					userId: adminUser.id,
					accountId: adminAccount?.id ?? "",
					symbol: "ES",
					instrumentType: "futures",
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
					userId: adminUser.id,
					accountId: adminAccount?.id ?? "",
					symbol: "NQ",
					instrumentType: "futures",
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
					userId: regularUser.id,
					accountId: regularAccount?.id ?? "",
					symbol: "ES",
					instrumentType: "futures",
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
		});

		it("should return daily trade activity", async () => {
			const result = await adminCaller.admin.analytics.tradingActivity();

			expect(result).toHaveProperty("daily");
			expect(Array.isArray(result.daily)).toBe(true);
			expect(result.daily.length).toBeGreaterThanOrEqual(1);
		});

		it("should include tradeCount, totalPnl, and avgTradeSize per day", async () => {
			const result = await adminCaller.admin.analytics.tradingActivity();

			for (const day of result.daily) {
				expect(day).toHaveProperty("date");
				expect(day).toHaveProperty("tradeCount");
				expect(day).toHaveProperty("totalPnl");
				expect(day).toHaveProperty("avgTradeSize");
				expect(typeof day.tradeCount).toBe("number");
				expect(typeof day.totalPnl).toBe("number");
				expect(typeof day.avgTradeSize).toBe("number");
			}
		});

		it("should return correct trade count for today", async () => {
			const result = await adminCaller.admin.analytics.tradingActivity();

			const today = result.daily[result.daily.length - 1];
			expect(today?.tradeCount).toBe(3);
		});

		it("should return correct total P&L for today", async () => {
			const result = await adminCaller.admin.analytics.tradingActivity();

			const today = result.daily[result.daily.length - 1];
			// 995 + 395 + (-505) = 885
			expect(today?.totalPnl).toBeCloseTo(885, 0);
		});

		it("should exclude soft-deleted trades", async () => {
			const db = getTestDb();

			// Create and then soft-delete a trade
			const [adminAccount] = await db
				.select()
				.from(schema.accounts)
				.where(eq(schema.accounts.userId, adminUser.id))
				.limit(1);

			await db.insert(schema.trades).values({
				userId: adminUser.id,
				accountId: adminAccount?.id ?? "",
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				entryPrice: "5000.00",
				exitPrice: "5050.00",
				quantity: "1",
				entryTime: new Date(),
				exitTime: new Date(),
				realizedPnl: "2500.00",
				netPnl: "2495.00",
				fees: "5.00",
				deletedAt: new Date(), // soft-deleted
			});

			const result = await adminCaller.admin.analytics.tradingActivity();
			const today = result.daily[result.daily.length - 1];
			// Still 3 trades (soft-deleted trade excluded)
			expect(today?.tradeCount).toBe(3);
		});
	});

	describe("admin.analytics.topTraders", () => {
		it("should return ranked traders by P&L", async () => {
			const result = await adminCaller.admin.analytics.topTraders();

			expect(result).toHaveProperty("traders");
			expect(Array.isArray(result.traders)).toBe(true);
			expect(result.traders.length).toBeGreaterThanOrEqual(1);
		});

		it("should include userId, name, email, tradeCount, and totalPnl", async () => {
			const result = await adminCaller.admin.analytics.topTraders();

			for (const trader of result.traders) {
				expect(trader).toHaveProperty("userId");
				expect(trader).toHaveProperty("name");
				expect(trader).toHaveProperty("email");
				expect(trader).toHaveProperty("tradeCount");
				expect(trader).toHaveProperty("totalPnl");
			}
		});

		it("should rank admin user first (highest P&L)", async () => {
			const result = await adminCaller.admin.analytics.topTraders();

			// Admin: 995 + 395 = 1390, Regular: -505
			const firstTrader = result.traders[0];
			expect(firstTrader?.userId).toBe(adminUser.id);
			expect(firstTrader?.tradeCount).toBe(2);
			expect(firstTrader?.totalPnl).toBeCloseTo(1390, 0);
		});

		it("should rank regular user second (negative P&L)", async () => {
			const result = await adminCaller.admin.analytics.topTraders();

			const secondTrader = result.traders[1];
			expect(secondTrader?.userId).toBe(regularUser.id);
			expect(secondTrader?.tradeCount).toBe(1);
			expect(secondTrader?.totalPnl).toBeCloseTo(-505, 0);
		});

		it("should limit to 10 traders", async () => {
			const result = await adminCaller.admin.analytics.topTraders();
			expect(result.traders.length).toBeLessThanOrEqual(10);
		});
	});

	describe("admin.analytics.accountBreakdown", () => {
		it("should return account counts by type", async () => {
			const result = await adminCaller.admin.analytics.accountBreakdown();

			expect(result).toHaveProperty("breakdown");
			expect(Array.isArray(result.breakdown)).toBe(true);
			expect(result.breakdown.length).toBeGreaterThanOrEqual(1);
		});

		it("should include accountType and count for each entry", async () => {
			const result = await adminCaller.admin.analytics.accountBreakdown();

			for (const entry of result.breakdown) {
				expect(entry).toHaveProperty("accountType");
				expect(entry).toHaveProperty("count");
				expect(typeof entry.count).toBe("number");
			}
		});

		it("should return correct counts per account type", async () => {
			const result = await adminCaller.admin.analytics.accountBreakdown();

			// We created 1 live account (admin) and 1 demo account (regular)
			const liveEntry = result.breakdown.find((b) => b.accountType === "live");
			const demoEntry = result.breakdown.find((b) => b.accountType === "demo");

			expect(liveEntry?.count).toBe(1);
			expect(demoEntry?.count).toBe(1);
		});

		it("should reflect newly added accounts", async () => {
			const db = getTestDb();

			// Add a prop_challenge account for the second user
			await db.insert(schema.accounts).values({
				userId: secondUser.id,
				name: "Prop Challenge",
				platform: "tradovate",
				accountType: "prop_challenge",
				initialBalance: "50000",
				isDefault: true,
			});

			const result = await adminCaller.admin.analytics.accountBreakdown();

			const propEntry = result.breakdown.find(
				(b) => b.accountType === "prop_challenge",
			);
			expect(propEntry?.count).toBe(1);
		});
	});

	describe("auth", () => {
		it("should reject non-admin on growth", async () => {
			await expect(regularCaller.admin.analytics.growth()).rejects.toThrow(
				ERR_ADMIN_FORBIDDEN,
			);
		});

		it("should reject non-admin on tradingActivity", async () => {
			await expect(
				regularCaller.admin.analytics.tradingActivity(),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject non-admin on topTraders", async () => {
			await expect(regularCaller.admin.analytics.topTraders()).rejects.toThrow(
				ERR_ADMIN_FORBIDDEN,
			);
		});

		it("should reject non-admin on accountBreakdown", async () => {
			await expect(
				regularCaller.admin.analytics.accountBreakdown(),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject unauthenticated users", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(unauthCaller.admin.analytics.growth()).rejects.toThrow(
				"UNAUTHORIZED",
			);
		});
	});
});
