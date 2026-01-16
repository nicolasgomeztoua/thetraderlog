import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Account, User } from "@/server/db/schema";
import {
	createTestAccount,
	createTestCaller,
	createTestTrade,
	createTestUser,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("trades router - getRecent", () => {
	let user: User;
	let caller: TestCaller;
	let account: Account;
	let inactiveAccount: Account;

	beforeAll(async () => {
		await truncateAllTables();
		user = await createTestUser();
		caller = await createTestCaller(user.clerkId, user);
		account = await createTestAccount(user.id, {
			name: "Active Trading Account",
			accountType: "demo",
			initialBalance: "50000",
			isActive: true,
		});
		inactiveAccount = await createTestAccount(user.id, {
			name: "Inactive Trading Account",
			accountType: "demo",
			initialBalance: "25000",
			isActive: false,
		});
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// TEST SETUP VERIFICATION
	// ============================================================================

	describe("test setup", () => {
		it("should have a valid test user", () => {
			expect(user).toBeDefined();
			expect(user.id).toBeDefined();
			expect(user.clerkId).toBeDefined();
		});

		it("should have a valid test caller", () => {
			expect(caller).toBeDefined();
			expect(caller.trades).toBeDefined();
			expect(caller.trades.getRecent).toBeDefined();
		});

		it("should have a valid active test account", () => {
			expect(account).toBeDefined();
			expect(account.id).toBeDefined();
			expect(account.userId).toBe(user.id);
			expect(account.isActive).toBe(true);
		});

		it("should have a valid inactive test account", () => {
			expect(inactiveAccount).toBeDefined();
			expect(inactiveAccount.id).toBeDefined();
			expect(inactiveAccount.userId).toBe(user.id);
			expect(inactiveAccount.isActive).toBe(false);
		});
	});

	// ============================================================================
	// HAPPY PATH TESTS
	// ============================================================================

	describe("happy path", () => {
		beforeAll(async () => {
			// Create trades with different entry times to test ordering
			// Trade 1: Oldest trade
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				entryPrice: "5000.00",
				exitPrice: "5010.00",
				entryTime: new Date("2024-01-15T09:00:00Z"),
				exitTime: new Date("2024-01-15T10:00:00Z"),
			});
			// Trade 2: Second oldest
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "short",
				entryPrice: "18000.00",
				exitPrice: "17950.00",
				entryTime: new Date("2024-01-15T14:00:00Z"),
				exitTime: new Date("2024-01-15T15:00:00Z"),
			});
			// Trade 3: Middle trade
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				entryPrice: "5020.00",
				exitPrice: "5040.00",
				entryTime: new Date("2024-01-16T09:30:00Z"),
				exitTime: new Date("2024-01-16T10:30:00Z"),
			});
			// Trade 4: Second most recent
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "long",
				entryPrice: "18100.00",
				exitPrice: "18150.00",
				entryTime: new Date("2024-01-16T14:00:00Z"),
				exitTime: new Date("2024-01-16T15:00:00Z"),
			});
			// Trade 5: Most recent trade
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "short",
				entryPrice: "5050.00",
				exitPrice: "5030.00",
				entryTime: new Date("2024-01-17T09:00:00Z"),
				exitTime: new Date("2024-01-17T10:00:00Z"),
			});
		});

		it("should return trades ordered by entryTime descending", async () => {
			const result = await caller.trades.getRecent();

			expect(result).toHaveLength(5);
			// Most recent trade first
			expect(result[0]?.symbol).toBe("ES");
			expect(result[0]?.direction).toBe("short");
			// Check ordering - entry times should be descending
			for (let i = 1; i < result.length; i++) {
				const currentEntry = new Date(result[i]?.entryTime ?? 0).getTime();
				const previousEntry = new Date(result[i - 1]?.entryTime ?? 0).getTime();
				expect(currentEntry).toBeLessThanOrEqual(previousEntry);
			}
		});

		it("should respect the default limit of 5", async () => {
			// Add more trades to exceed default limit
			await createTestTrade(user.id, account.id, {
				symbol: "CL",
				direction: "long",
				entryPrice: "75.00",
				exitPrice: "76.00",
				entryTime: new Date("2024-01-18T09:00:00Z"),
				exitTime: new Date("2024-01-18T10:00:00Z"),
			});
			await createTestTrade(user.id, account.id, {
				symbol: "GC",
				direction: "short",
				entryPrice: "2000.00",
				exitPrice: "1990.00",
				entryTime: new Date("2024-01-18T14:00:00Z"),
				exitTime: new Date("2024-01-18T15:00:00Z"),
			});

			const result = await caller.trades.getRecent();

			// Default limit is 5
			expect(result).toHaveLength(5);
			// Most recent should be GC trade
			expect(result[0]?.symbol).toBe("GC");
		});

		it("should respect custom limit parameter", async () => {
			const result = await caller.trades.getRecent({ limit: 3 });

			expect(result).toHaveLength(3);
			// Should still be ordered by entryTime descending
			expect(result[0]?.symbol).toBe("GC");
		});

		it("should respect limit of 1", async () => {
			const result = await caller.trades.getRecent({ limit: 1 });

			expect(result).toHaveLength(1);
			expect(result[0]?.symbol).toBe("GC");
		});

		it("should respect maximum limit of 10", async () => {
			const result = await caller.trades.getRecent({ limit: 10 });

			// Should return up to 10 trades (we have 7 total)
			expect(result).toHaveLength(7);
		});

		it("should include account relation in response", async () => {
			const result = await caller.trades.getRecent({ limit: 1 });

			expect(result).toHaveLength(1);
			expect(result[0]?.account).toBeDefined();
			expect(result[0]?.account?.id).toBe(account.id);
			expect(result[0]?.account?.name).toBe("Active Trading Account");
		});
	});

	// ============================================================================
	// ACCOUNT FILTERING TESTS
	// ============================================================================

	describe("account filtering", () => {
		let secondActiveAccount: Account;

		beforeAll(async () => {
			// Create a second active account with its own trades
			secondActiveAccount = await createTestAccount(user.id, {
				name: "Second Active Account",
				accountType: "live",
				initialBalance: "100000",
				isActive: true,
			});

			// Add trades to the second account
			await createTestTrade(user.id, secondActiveAccount.id, {
				symbol: "SI",
				direction: "long",
				entryPrice: "25.00",
				exitPrice: "26.00",
				entryTime: new Date("2024-01-19T09:00:00Z"),
				exitTime: new Date("2024-01-19T10:00:00Z"),
			});
			await createTestTrade(user.id, secondActiveAccount.id, {
				symbol: "HG",
				direction: "short",
				entryPrice: "4.00",
				exitPrice: "3.90",
				entryTime: new Date("2024-01-19T14:00:00Z"),
				exitTime: new Date("2024-01-19T15:00:00Z"),
			});

			// Add trades to inactive account
			await createTestTrade(user.id, inactiveAccount.id, {
				symbol: "ZB",
				direction: "long",
				entryPrice: "120.00",
				exitPrice: "121.00",
				entryTime: new Date("2024-01-20T09:00:00Z"),
				exitTime: new Date("2024-01-20T10:00:00Z"),
			});
		});

		it("should filter by accountId when provided", async () => {
			const result = await caller.trades.getRecent({
				accountId: secondActiveAccount.id,
				limit: 10,
			});

			// Should only return trades from the specified account
			expect(result.length).toBe(2);
			for (const trade of result) {
				expect(trade.accountId).toBe(secondActiveAccount.id);
			}
			// Verify symbols are from second account
			const symbols = result.map((t) => t.symbol);
			expect(symbols).toContain("SI");
			expect(symbols).toContain("HG");
		});

		it("should respect active accounts filter when no accountId specified", async () => {
			const result = await caller.trades.getRecent({ limit: 10 });

			// Should NOT include trades from inactive account
			const accountIds = result.map((t) => t.accountId);
			expect(accountIds).not.toContain(inactiveAccount.id);

			// Should include trades from active accounts
			expect(accountIds).toContain(account.id);
			expect(accountIds).toContain(secondActiveAccount.id);

			// The inactive account's ZB trade should not appear
			const symbols = result.map((t) => t.symbol);
			expect(symbols).not.toContain("ZB");
		});

		it("should include trades from inactive account when filtering by accountId explicitly", async () => {
			const result = await caller.trades.getRecent({
				accountId: inactiveAccount.id,
				limit: 10,
			});

			// When accountId is explicitly provided, it should return trades even from inactive accounts
			expect(result.length).toBe(1);
			expect(result[0]?.accountId).toBe(inactiveAccount.id);
			expect(result[0]?.symbol).toBe("ZB");
		});
	});

	// ============================================================================
	// EMPTY RESULTS TESTS
	// ============================================================================

	describe("empty results", () => {
		let emptyAccountUser: User;
		let emptyAccountCaller: TestCaller;
		let emptyAccount: Account;

		beforeAll(async () => {
			// Create a separate user with no trades
			emptyAccountUser = await createTestUser();
			emptyAccountCaller = await createTestCaller(
				emptyAccountUser.clerkId,
				emptyAccountUser,
			);
			emptyAccount = await createTestAccount(emptyAccountUser.id, {
				name: "Empty Account",
				accountType: "demo",
				initialBalance: "10000",
				isActive: true,
			});
		});

		it("should return empty array when no trades exist", async () => {
			const result = await emptyAccountCaller.trades.getRecent();

			expect(result).toHaveLength(0);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should return empty array when filtering by account with no trades", async () => {
			const result = await emptyAccountCaller.trades.getRecent({
				accountId: emptyAccount.id,
			});

			expect(result).toHaveLength(0);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	// ============================================================================
	// SOFT-DELETED TRADES TESTS
	// ============================================================================

	describe("soft-deleted trades", () => {
		let softDeleteUser: User;
		let softDeleteCaller: TestCaller;
		let softDeleteAccount: Account;

		beforeAll(async () => {
			// Create a separate user for soft delete tests
			softDeleteUser = await createTestUser();
			softDeleteCaller = await createTestCaller(
				softDeleteUser.clerkId,
				softDeleteUser,
			);
			softDeleteAccount = await createTestAccount(softDeleteUser.id, {
				name: "Soft Delete Test Account",
				accountType: "demo",
				initialBalance: "10000",
				isActive: true,
			});

			// Create some trades
			await createTestTrade(softDeleteUser.id, softDeleteAccount.id, {
				symbol: "ES",
				direction: "long",
				entryPrice: "5000.00",
				exitPrice: "5010.00",
				entryTime: new Date("2024-02-01T09:00:00Z"),
				exitTime: new Date("2024-02-01T10:00:00Z"),
			});
			await createTestTrade(softDeleteUser.id, softDeleteAccount.id, {
				symbol: "NQ",
				direction: "short",
				entryPrice: "18000.00",
				exitPrice: "17950.00",
				entryTime: new Date("2024-02-01T14:00:00Z"),
				exitTime: new Date("2024-02-01T15:00:00Z"),
			});
		});

		it("should not include soft-deleted trades in results", async () => {
			// Get all trades first
			const beforeDelete = await softDeleteCaller.trades.getRecent();
			expect(beforeDelete).toHaveLength(2);

			// Soft delete the NQ trade (most recent)
			const nqTrade = beforeDelete.find((t) => t.symbol === "NQ");
			expect(nqTrade).toBeDefined();
			await softDeleteCaller.trades.delete({ id: nqTrade?.id ?? "" });

			// Get recent trades again
			const afterDelete = await softDeleteCaller.trades.getRecent();

			// Should only return the ES trade
			expect(afterDelete).toHaveLength(1);
			expect(afterDelete[0]?.symbol).toBe("ES");
			expect(afterDelete.find((t) => t.symbol === "NQ")).toBeUndefined();
		});
	});
});
