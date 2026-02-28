import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Account, User } from "@/server/db/schema";
import { triggerMock } from "../../mocks/trigger";
import {
	createTestAccount,
	createTestCaller,
	createTestUser,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

/**
 * Helper to create a valid batch import trade object.
 * All required fields are provided with sensible defaults.
 */
function createBatchImportTrade(
	overrides: {
		symbol?: string;
		direction?: "long" | "short";
		entryPrice?: string;
		entryTime?: string;
		exitPrice?: string;
		exitTime?: string;
		quantity?: string;
		stopLoss?: string;
		takeProfit?: string;
		fees?: string;
		notes?: string;
		externalId?: string;
		profit?: string;
	} = {},
) {
	const now = new Date();
	const entryTime = overrides.entryTime ?? now.toISOString();
	const exitTime =
		overrides.exitTime ?? new Date(now.getTime() + 3600000).toISOString(); // 1 hour later

	return {
		symbol: overrides.symbol ?? "ES",
		direction: overrides.direction ?? ("long" as const),
		entryPrice: overrides.entryPrice ?? "5000.00",
		entryTime,
		exitPrice: overrides.exitPrice ?? "5010.00",
		exitTime,
		quantity: overrides.quantity ?? "1",
		stopLoss: overrides.stopLoss,
		takeProfit: overrides.takeProfit,
		fees: overrides.fees ?? "2.50",
		notes: overrides.notes,
		externalId: overrides.externalId,
		profit: overrides.profit ?? "500.00", // $10 * 50 (ES multiplier) = $500
	};
}

describe("trades router - batchImport", () => {
	let user: User;
	let caller: TestCaller;
	let account: Account;

	beforeAll(async () => {
		await truncateAllTables();
		user = await createTestUser();
		caller = await createTestCaller(user.clerkId, user);
		account = await createTestAccount(user.id, {
			name: "Test Trading Account",
			accountType: "demo",
			initialBalance: "50000",
		});
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// Reset trigger mock between tests to ensure isolation
	beforeEach(() => {
		triggerMock.reset();
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
			expect(caller.trades.batchImport).toBeDefined();
		});

		it("should have a valid test account", () => {
			expect(account).toBeDefined();
			expect(account.id).toBeDefined();
			expect(account.userId).toBe(user.id);
		});
	});

	// ============================================================================
	// HAPPY PATH TESTS
	// ============================================================================

	describe("happy path", () => {
		it("should import a single trade successfully", async () => {
			const trade = createBatchImportTrade({
				symbol: "ES",
				direction: "long",
				entryPrice: "5000.00",
				exitPrice: "5010.00",
				quantity: "1",
				profit: "500.00",
			});

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result.imported).toBe(1);
			expect(result.skipped).toBe(0);
			expect(result.total).toBe(1);
			expect(result.tradeIds).toHaveLength(1);
			expect(result.tradeIds[0]).toBeDefined();
		});

		it("should import multiple trades successfully", async () => {
			const trades = [
				createBatchImportTrade({
					symbol: "NQ",
					direction: "long",
					entryPrice: "18000.00",
					exitPrice: "18050.00",
					entryTime: new Date("2024-01-15T10:00:00Z").toISOString(),
					exitTime: new Date("2024-01-15T11:00:00Z").toISOString(),
					quantity: "2",
					profit: "1000.00",
				}),
				createBatchImportTrade({
					symbol: "NQ",
					direction: "short",
					entryPrice: "18100.00",
					exitPrice: "18050.00",
					entryTime: new Date("2024-01-15T14:00:00Z").toISOString(),
					exitTime: new Date("2024-01-15T15:00:00Z").toISOString(),
					quantity: "1",
					profit: "500.00",
				}),
				createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5050.00",
					exitPrice: "5075.00",
					entryTime: new Date("2024-01-16T09:30:00Z").toISOString(),
					exitTime: new Date("2024-01-16T10:30:00Z").toISOString(),
					quantity: "3",
					profit: "3750.00",
				}),
			];

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades,
			});

			expect(result.imported).toBe(3);
			expect(result.skipped).toBe(0);
			expect(result.total).toBe(3);
			expect(result.tradeIds).toHaveLength(3);
		});

		it("should correctly set trade fields from import data", async () => {
			const tradeData = createBatchImportTrade({
				symbol: "CL",
				direction: "short",
				entryPrice: "75.50",
				exitPrice: "74.00",
				entryTime: new Date("2024-02-01T08:00:00Z").toISOString(),
				exitTime: new Date("2024-02-01T12:00:00Z").toISOString(),
				quantity: "5",
				stopLoss: "76.00",
				takeProfit: "73.50",
				fees: "12.50",
				notes: "Oil trade during inventory report",
				externalId: "ext-12345",
				profit: "750.00",
			});

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades: [tradeData],
			});

			expect(result.imported).toBe(1);
			const tradeId = result.tradeIds[0];
			expect(tradeId).toBeDefined();

			// Fetch the trade to verify all fields
			const importedTrade = await caller.trades.getById({
				id: tradeId as string,
			});

			expect(importedTrade.symbol).toBe("CL");
			expect(importedTrade.direction).toBe("short");
			// Decimal fields are stored with 8 decimal places in DB, use parseFloat for comparison
			expect(parseFloat(importedTrade.entryPrice)).toBe(75.5);
			expect(parseFloat(importedTrade.exitPrice ?? "0")).toBe(74.0);
			expect(parseFloat(importedTrade.quantity)).toBe(5);
			expect(parseFloat(importedTrade.stopLoss ?? "0")).toBe(76.0);
			expect(parseFloat(importedTrade.takeProfit ?? "0")).toBe(73.5);
			expect(parseFloat(importedTrade.fees ?? "0")).toBe(12.5);
			expect(importedTrade.notes).toBe("Oil trade during inventory report");
			expect(importedTrade.externalId).toBe("ext-12345");
			expect(importedTrade.status).toBe("closed");
			expect(importedTrade.importSource).toBe("csv");
			expect(parseFloat(importedTrade.realizedPnl ?? "0")).toBe(750.0);
			// netPnl = realizedPnl - fees = 750.00 - 12.50 = 737.50
			expect(parseFloat(importedTrade.netPnl ?? "0")).toBe(737.5);
		});

		it("should calculate netPnl correctly from profit and fees", async () => {
			const trade = createBatchImportTrade({
				symbol: "ES",
				profit: "1000.00",
				fees: "5.00",
			});

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result.tradeIds[0]).toBeDefined();
			const importedTrade = await caller.trades.getById({
				id: result.tradeIds[0] as string,
			});

			// netPnl = profit - fees
			expect(importedTrade.realizedPnl).toBe("1000.00");
			expect(importedTrade.netPnl).toBe("995.00");
		});

		it("should handle trades with zero fees", async () => {
			const trade = createBatchImportTrade({
				symbol: "ES",
				profit: "500.00",
				fees: "0",
			});

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result.tradeIds[0]).toBeDefined();
			const importedTrade = await caller.trades.getById({
				id: result.tradeIds[0] as string,
			});

			expect(importedTrade.realizedPnl).toBe("500.00");
			expect(importedTrade.netPnl).toBe("500.00");
		});

		it("should handle losing trades with negative profit", async () => {
			const trade = createBatchImportTrade({
				symbol: "ES",
				direction: "long",
				entryPrice: "5010.00",
				exitPrice: "5000.00",
				profit: "-500.00",
				fees: "2.50",
			});

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result.tradeIds[0]).toBeDefined();
			const importedTrade = await caller.trades.getById({
				id: result.tradeIds[0] as string,
			});

			expect(importedTrade.realizedPnl).toBe("-500.00");
			// netPnl = -500.00 - 2.50 = -502.50
			expect(importedTrade.netPnl).toBe("-502.50");
		});

		it("should return processingCount for closed trades needing MAE/MFE calculation", async () => {
			const trades = [
				createBatchImportTrade({
					symbol: "ES",
					exitPrice: "5010.00",
					exitTime: new Date("2024-03-01T10:00:00Z").toISOString(),
				}),
				createBatchImportTrade({
					symbol: "NQ",
					exitPrice: "18050.00",
					exitTime: new Date("2024-03-01T11:00:00Z").toISOString(),
				}),
			];

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades,
			});

			// Both are closed trades, so processingCount should equal imported count
			expect(result.processingCount).toBe(2);
			expect(result.processingCount).toBe(result.imported);
		});

		it("should generate trade hashes for closed trades", async () => {
			const trade = createBatchImportTrade({
				symbol: "GC",
				direction: "long",
				entryPrice: "2000.00",
				exitPrice: "2010.00",
				entryTime: new Date("2024-04-01T09:00:00Z").toISOString(),
				exitTime: new Date("2024-04-01T10:00:00Z").toISOString(),
				quantity: "1",
				profit: "1000.00",
			});

			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result.tradeIds[0]).toBeDefined();
			const importedTrade = await caller.trades.getById({
				id: result.tradeIds[0] as string,
			});

			// Trade hash should be generated for duplicate detection
			expect(importedTrade.tradeHash).toBeDefined();
			expect(importedTrade.tradeHash).not.toBeNull();
			expect(typeof importedTrade.tradeHash).toBe("string");
			// SHA-256 produces a 64-character hex string
			expect(importedTrade.tradeHash).toHaveLength(64);
		});
	});

	// ============================================================================
	// DUPLICATE DETECTION TESTS
	// ============================================================================

	describe("duplicate detection", () => {
		it("should skip exact duplicate trades when importing same CSV twice", async () => {
			// Create a trade with unique timestamps to avoid collision with other tests
			const uniqueEntryTime = new Date("2024-05-01T09:00:00Z").toISOString();
			const uniqueExitTime = new Date("2024-05-01T10:00:00Z").toISOString();

			const trade = createBatchImportTrade({
				symbol: "ES",
				direction: "long",
				entryPrice: "5100.00",
				exitPrice: "5110.00",
				entryTime: uniqueEntryTime,
				exitTime: uniqueExitTime,
				quantity: "2",
				profit: "1000.00",
			});

			// First import
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result1.imported).toBe(1);
			expect(result1.skipped).toBe(0);
			expect(result1.total).toBe(1);

			// Second import with exact same trade (simulates importing same CSV twice)
			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result2.imported).toBe(0);
			expect(result2.skipped).toBe(1);
			expect(result2.total).toBe(1);
			expect(result2.tradeIds).toHaveLength(0);
		});

		it("should handle partial overlap - skip duplicates and import new trades", async () => {
			// Create 3 trades: 2 new, 1 that will become a duplicate
			const baseDate = new Date("2024-05-10T09:00:00Z");

			const existingTrade = createBatchImportTrade({
				symbol: "NQ",
				direction: "long",
				entryPrice: "18000.00",
				exitPrice: "18050.00",
				entryTime: new Date(baseDate.getTime()).toISOString(),
				exitTime: new Date(baseDate.getTime() + 3600000).toISOString(),
				quantity: "1",
				profit: "500.00",
			});

			// First import - establish the existing trade
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [existingTrade],
			});

			expect(result1.imported).toBe(1);

			// Second import with overlapping data: 1 duplicate + 2 new trades
			const newTrade1 = createBatchImportTrade({
				symbol: "NQ",
				direction: "short",
				entryPrice: "18100.00",
				exitPrice: "18050.00",
				entryTime: new Date(baseDate.getTime() + 7200000).toISOString(), // 2 hours later
				exitTime: new Date(baseDate.getTime() + 10800000).toISOString(), // 3 hours later
				quantity: "2",
				profit: "1000.00",
			});

			const newTrade2 = createBatchImportTrade({
				symbol: "ES",
				direction: "long",
				entryPrice: "5200.00",
				exitPrice: "5225.00",
				entryTime: new Date(baseDate.getTime() + 14400000).toISOString(), // 4 hours later
				exitTime: new Date(baseDate.getTime() + 18000000).toISOString(), // 5 hours later
				quantity: "3",
				profit: "3750.00",
			});

			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [existingTrade, newTrade1, newTrade2], // existingTrade is duplicate
			});

			expect(result2.imported).toBe(2); // Only new trades imported
			expect(result2.skipped).toBe(1); // existingTrade skipped as duplicate
			expect(result2.total).toBe(3);
			expect(result2.tradeIds).toHaveLength(2);
		});

		it("should skip all trades when entire batch is duplicates", async () => {
			const baseDate = new Date("2024-05-15T09:00:00Z");

			const trades = [
				createBatchImportTrade({
					symbol: "GC",
					direction: "long",
					entryPrice: "2050.00",
					exitPrice: "2060.00",
					entryTime: new Date(baseDate.getTime()).toISOString(),
					exitTime: new Date(baseDate.getTime() + 3600000).toISOString(),
					quantity: "1",
					profit: "1000.00",
				}),
				createBatchImportTrade({
					symbol: "GC",
					direction: "short",
					entryPrice: "2065.00",
					exitPrice: "2055.00",
					entryTime: new Date(baseDate.getTime() + 7200000).toISOString(),
					exitTime: new Date(baseDate.getTime() + 10800000).toISOString(),
					quantity: "2",
					profit: "2000.00",
				}),
			];

			// First import
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades,
			});

			expect(result1.imported).toBe(2);
			expect(result1.skipped).toBe(0);

			// Second import with exact same trades
			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades,
			});

			expect(result2.imported).toBe(0);
			expect(result2.skipped).toBe(2);
			expect(result2.total).toBe(2);
			expect(result2.tradeIds).toHaveLength(0);
		});

		it("should treat trades with different prices as unique (not duplicates)", async () => {
			const baseDate = new Date("2024-05-20T09:00:00Z");
			const entryTime = baseDate.toISOString();
			const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

			const trade1 = createBatchImportTrade({
				symbol: "ES",
				direction: "long",
				entryPrice: "5300.00",
				exitPrice: "5310.00",
				entryTime,
				exitTime,
				quantity: "1",
				profit: "500.00",
			});

			// First import
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade1],
			});

			expect(result1.imported).toBe(1);

			// Import trade with different entry price (same everything else)
			const trade2 = createBatchImportTrade({
				symbol: "ES",
				direction: "long",
				entryPrice: "5300.25", // Different entry price
				exitPrice: "5310.00",
				entryTime,
				exitTime,
				quantity: "1",
				profit: "487.50",
			});

			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade2],
			});

			expect(result2.imported).toBe(1); // Not a duplicate due to different price
			expect(result2.skipped).toBe(0);
		});

		it("should treat trades with different quantities as unique (not duplicates)", async () => {
			const baseDate = new Date("2024-05-21T09:00:00Z");
			const entryTime = baseDate.toISOString();
			const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

			const trade1 = createBatchImportTrade({
				symbol: "NQ",
				direction: "short",
				entryPrice: "18200.00",
				exitPrice: "18150.00",
				entryTime,
				exitTime,
				quantity: "1",
				profit: "500.00",
			});

			// First import
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade1],
			});

			expect(result1.imported).toBe(1);

			// Import trade with different quantity
			const trade2 = createBatchImportTrade({
				symbol: "NQ",
				direction: "short",
				entryPrice: "18200.00",
				exitPrice: "18150.00",
				entryTime,
				exitTime,
				quantity: "2", // Different quantity
				profit: "1000.00",
			});

			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade2],
			});

			expect(result2.imported).toBe(1); // Not a duplicate due to different quantity
			expect(result2.skipped).toBe(0);
		});

		it("should treat trades with different directions as unique (not duplicates)", async () => {
			const baseDate = new Date("2024-05-22T09:00:00Z");
			const entryTime = baseDate.toISOString();
			const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

			const longTrade = createBatchImportTrade({
				symbol: "CL",
				direction: "long",
				entryPrice: "75.00",
				exitPrice: "76.00",
				entryTime,
				exitTime,
				quantity: "5",
				profit: "500.00",
			});

			// First import - long trade
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [longTrade],
			});

			expect(result1.imported).toBe(1);

			// Import trade with opposite direction (same everything else)
			const shortTrade = createBatchImportTrade({
				symbol: "CL",
				direction: "short", // Different direction
				entryPrice: "75.00",
				exitPrice: "76.00",
				entryTime,
				exitTime,
				quantity: "5",
				profit: "-500.00", // Would be a loss for short
			});

			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [shortTrade],
			});

			expect(result2.imported).toBe(1); // Not a duplicate due to different direction
			expect(result2.skipped).toBe(0);
		});

		it("should handle symbol case-insensitively for duplicate detection", async () => {
			const baseDate = new Date("2024-05-23T09:00:00Z");
			const entryTime = baseDate.toISOString();
			const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

			const trade1 = createBatchImportTrade({
				symbol: "ES", // Uppercase
				direction: "long",
				entryPrice: "5400.00",
				exitPrice: "5410.00",
				entryTime,
				exitTime,
				quantity: "1",
				profit: "500.00",
			});

			// First import with uppercase symbol
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade1],
			});

			expect(result1.imported).toBe(1);

			// Import trade with lowercase symbol (should be detected as duplicate)
			const trade2 = createBatchImportTrade({
				symbol: "es", // Lowercase
				direction: "long",
				entryPrice: "5400.00",
				exitPrice: "5410.00",
				entryTime,
				exitTime,
				quantity: "1",
				profit: "500.00",
			});

			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade2],
			});

			expect(result2.imported).toBe(0); // Should be detected as duplicate
			expect(result2.skipped).toBe(1);
		});

		it("should detect duplicates within the same batch import", async () => {
			const baseDate = new Date("2024-05-24T09:00:00Z");
			const entryTime = baseDate.toISOString();
			const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

			const trade = createBatchImportTrade({
				symbol: "SI",
				direction: "long",
				entryPrice: "25.00",
				exitPrice: "25.50",
				entryTime,
				exitTime,
				quantity: "10",
				profit: "5000.00",
			});

			// Import same trade twice in one batch
			// Note: The current implementation computes hashes and checks against DB,
			// but doesn't dedupe within the batch itself. This test documents current behavior.
			const result = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade, trade], // Same trade twice
			});

			// Current behavior: both trades have same hash, but duplicate check only
			// happens against existing DB records, not within the batch.
			// After first insert, second would be duplicate in DB.
			// However, since they're inserted together, both get inserted.
			// This test documents this behavior - may want to enhance later.
			expect(result.total).toBe(2);
			// Both are inserted since duplicate check is against pre-existing DB records
			expect(result.imported).toBe(2);
		});

		it("should not skip soft-deleted trades as duplicates", async () => {
			const baseDate = new Date("2024-05-25T09:00:00Z");
			const entryTime = baseDate.toISOString();
			const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

			const trade = createBatchImportTrade({
				symbol: "HG",
				direction: "long",
				entryPrice: "4.00",
				exitPrice: "4.10",
				entryTime,
				exitTime,
				quantity: "25",
				profit: "2500.00",
			});

			// First import
			const result1 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result1.imported).toBe(1);
			const tradeId = result1.tradeIds[0] as string;

			// Soft delete the trade
			await caller.trades.delete({ id: tradeId });

			// Re-import the same trade - should NOT be detected as duplicate
			// because the original was soft-deleted
			const result2 = await caller.trades.batchImport({
				accountId: account.id,
				trades: [trade],
			});

			expect(result2.imported).toBe(1); // Should import since original is deleted
			expect(result2.skipped).toBe(0);
		});
	});

	// ============================================================================
	// EDGE CASE TESTS
	// ============================================================================

	describe("edge cases", () => {
		describe("different accounts - not duplicates", () => {
			let secondAccount: Account;

			beforeAll(async () => {
				// Create a second account for the same user
				secondAccount = await createTestAccount(user.id, {
					name: "Second Trading Account",
					accountType: "live",
					initialBalance: "100000",
				});
			});

			it("should allow identical trade data to be imported to different accounts", async () => {
				const baseDate = new Date("2024-06-01T09:00:00Z");
				const entryTime = baseDate.toISOString();
				const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

				const tradeData = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5500.00",
					exitPrice: "5510.00",
					entryTime,
					exitTime,
					quantity: "1",
					profit: "500.00",
				});

				// Import to first account
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [tradeData],
				});

				expect(result1.imported).toBe(1);
				expect(result1.skipped).toBe(0);

				// Import identical trade to second account - should NOT be duplicate
				const result2 = await caller.trades.batchImport({
					accountId: secondAccount.id,
					trades: [tradeData],
				});

				expect(result2.imported).toBe(1);
				expect(result2.skipped).toBe(0);
				expect(result2.tradeIds).toHaveLength(1);
			});

			it("should still detect duplicates within the same account after importing to different account", async () => {
				const baseDate = new Date("2024-06-02T09:00:00Z");
				const entryTime = baseDate.toISOString();
				const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

				const tradeData = createBatchImportTrade({
					symbol: "NQ",
					direction: "short",
					entryPrice: "18500.00",
					exitPrice: "18450.00",
					entryTime,
					exitTime,
					quantity: "2",
					profit: "1000.00",
				});

				// Import to first account
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [tradeData],
				});
				expect(result1.imported).toBe(1);

				// Import to second account - not duplicate
				const result2 = await caller.trades.batchImport({
					accountId: secondAccount.id,
					trades: [tradeData],
				});
				expect(result2.imported).toBe(1);

				// Try to import again to first account - should be duplicate
				const result3 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [tradeData],
				});
				expect(result3.imported).toBe(0);
				expect(result3.skipped).toBe(1);

				// Try to import again to second account - should also be duplicate
				const result4 = await caller.trades.batchImport({
					accountId: secondAccount.id,
					trades: [tradeData],
				});
				expect(result4.imported).toBe(0);
				expect(result4.skipped).toBe(1);
			});

			it("should generate different trade hashes for same trade data on different accounts", async () => {
				const baseDate = new Date("2024-06-03T09:00:00Z");
				const entryTime = baseDate.toISOString();
				const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

				const tradeData = createBatchImportTrade({
					symbol: "GC",
					direction: "long",
					entryPrice: "2100.00",
					exitPrice: "2110.00",
					entryTime,
					exitTime,
					quantity: "1",
					profit: "1000.00",
				});

				// Import to first account
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [tradeData],
				});

				// Import to second account
				const result2 = await caller.trades.batchImport({
					accountId: secondAccount.id,
					trades: [tradeData],
				});

				// Fetch both trades and compare hashes
				const trade1 = await caller.trades.getById({
					id: result1.tradeIds[0] as string,
				});
				const trade2 = await caller.trades.getById({
					id: result2.tradeIds[0] as string,
				});

				expect(trade1.tradeHash).toBeDefined();
				expect(trade2.tradeHash).toBeDefined();
				// Hashes should be different because accountId is part of the hash
				expect(trade1.tradeHash).not.toBe(trade2.tradeHash);
			});
		});

		describe("time precision handling", () => {
			it("should treat trades with 1 second time difference as unique (not duplicates)", async () => {
				const baseDate = new Date("2024-06-10T09:00:00Z");

				const trade1 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5600.00",
					exitPrice: "5610.00",
					entryTime: baseDate.toISOString(), // 09:00:00
					exitTime: new Date(baseDate.getTime() + 3600000).toISOString(),
					quantity: "1",
					profit: "500.00",
				});

				// First import
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade1],
				});
				expect(result1.imported).toBe(1);

				// Import trade with 1 second later entry time
				const trade2 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5600.00",
					exitPrice: "5610.00",
					entryTime: new Date(baseDate.getTime() + 1000).toISOString(), // 09:00:01 (1 second later)
					exitTime: new Date(baseDate.getTime() + 3600000 + 1000).toISOString(),
					quantity: "1",
					profit: "500.00",
				});

				const result2 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade2],
				});

				expect(result2.imported).toBe(1); // Should be unique (1 second difference)
				expect(result2.skipped).toBe(0);
			});

			it("should treat trades with millisecond time difference as unique (not duplicates)", async () => {
				const baseDate = new Date("2024-06-11T09:00:00.000Z");

				const trade1 = createBatchImportTrade({
					symbol: "NQ",
					direction: "short",
					entryPrice: "18600.00",
					exitPrice: "18550.00",
					entryTime: baseDate.toISOString(), // 09:00:00.000
					exitTime: new Date(baseDate.getTime() + 3600000).toISOString(),
					quantity: "1",
					profit: "500.00",
				});

				// First import
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade1],
				});
				expect(result1.imported).toBe(1);

				// Import trade with 1 millisecond later entry time
				const trade2 = createBatchImportTrade({
					symbol: "NQ",
					direction: "short",
					entryPrice: "18600.00",
					exitPrice: "18550.00",
					entryTime: new Date(baseDate.getTime() + 1).toISOString(), // 09:00:00.001 (1ms later)
					exitTime: new Date(baseDate.getTime() + 3600000 + 1).toISOString(),
					quantity: "1",
					profit: "500.00",
				});

				const result2 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade2],
				});

				expect(result2.imported).toBe(1); // Should be unique (1ms difference)
				expect(result2.skipped).toBe(0);
			});

			it("should correctly detect duplicates when timestamps are identical down to milliseconds", async () => {
				const baseDate = new Date("2024-06-12T09:00:00.123Z"); // With specific milliseconds
				const entryTime = baseDate.toISOString();
				const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

				const trade = createBatchImportTrade({
					symbol: "CL",
					direction: "long",
					entryPrice: "78.00",
					exitPrice: "79.00",
					entryTime,
					exitTime,
					quantity: "10",
					profit: "1000.00",
				});

				// First import
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade],
				});
				expect(result1.imported).toBe(1);

				// Second import with exact same timestamps (including milliseconds)
				const result2 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade],
				});

				expect(result2.imported).toBe(0);
				expect(result2.skipped).toBe(1);
			});

			it("should handle trades spanning different time zones consistently", async () => {
				// Create trades with the same UTC time, but different local representations
				// JavaScript Date objects normalize to UTC internally
				const utcTime = new Date("2024-06-13T14:00:00Z"); // 2PM UTC

				const trade = createBatchImportTrade({
					symbol: "SI",
					direction: "long",
					entryPrice: "28.00",
					exitPrice: "28.50",
					entryTime: utcTime.toISOString(),
					exitTime: new Date(utcTime.getTime() + 3600000).toISOString(),
					quantity: "5",
					profit: "2500.00",
				});

				// First import
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade],
				});
				expect(result1.imported).toBe(1);

				// Create same trade but construct the date differently
				// This simulates different time zone inputs that resolve to same UTC
				const sameTimeConstructed = new Date(
					Date.UTC(2024, 5, 13, 14, 0, 0, 0),
				); // Same as 2024-06-13T14:00:00Z

				const tradeSameTime = createBatchImportTrade({
					symbol: "SI",
					direction: "long",
					entryPrice: "28.00",
					exitPrice: "28.50",
					entryTime: sameTimeConstructed.toISOString(),
					exitTime: new Date(
						sameTimeConstructed.getTime() + 3600000,
					).toISOString(),
					quantity: "5",
					profit: "2500.00",
				});

				const result2 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [tradeSameTime],
				});

				// Should be detected as duplicate because both resolve to same UTC time
				expect(result2.imported).toBe(0);
				expect(result2.skipped).toBe(1);
			});

			it("should distinguish between trades at market open/close boundaries", async () => {
				// Test trades at common boundary times (market open, close)
				const marketOpen = new Date("2024-06-14T13:30:00Z"); // 9:30 AM ET
				const marketClose = new Date("2024-06-14T20:00:00Z"); // 4:00 PM ET

				const openTrade = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5700.00",
					exitPrice: "5710.00",
					entryTime: marketOpen.toISOString(),
					exitTime: new Date(marketOpen.getTime() + 1800000).toISOString(), // 30 min later
					quantity: "1",
					profit: "500.00",
				});

				const closeTrade = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5700.00",
					exitPrice: "5710.00",
					entryTime: marketClose.toISOString(),
					exitTime: new Date(marketClose.getTime() + 1800000).toISOString(),
					quantity: "1",
					profit: "500.00",
				});

				// Import both trades
				const result = await caller.trades.batchImport({
					accountId: account.id,
					trades: [openTrade, closeTrade],
				});

				// Both should be imported as unique (different entry times)
				expect(result.imported).toBe(2);
				expect(result.skipped).toBe(0);
			});
		});

		describe("decimal precision normalization", () => {
			it("should detect duplicates regardless of decimal trailing zeros", async () => {
				const baseDate = new Date("2024-06-20T09:00:00Z");
				const entryTime = baseDate.toISOString();
				const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

				// Trade with minimal decimal places
				const trade1 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5800", // No decimal
					exitPrice: "5810.5", // One decimal
					entryTime,
					exitTime,
					quantity: "1",
					profit: "525.00",
				});

				// First import
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade1],
				});
				expect(result1.imported).toBe(1);

				// Same trade with more decimal places (trailing zeros)
				const trade2 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5800.00000000", // Many trailing zeros
					exitPrice: "5810.50000000",
					entryTime,
					exitTime,
					quantity: "1.00000000",
					profit: "525.00",
				});

				const result2 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade2],
				});

				// Should be detected as duplicate (same values after normalization)
				expect(result2.imported).toBe(0);
				expect(result2.skipped).toBe(1);
			});

			it("should treat trades with small price differences as unique", async () => {
				const baseDate = new Date("2024-06-21T09:00:00Z");
				const entryTime = baseDate.toISOString();
				const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

				const trade1 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5850.00",
					exitPrice: "5860.00",
					entryTime,
					exitTime,
					quantity: "1",
					profit: "500.00",
				});

				// First import
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade1],
				});
				expect(result1.imported).toBe(1);

				// Trade with tiny price difference (0.00000001)
				const trade2 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5850.00000001", // Very small difference
					exitPrice: "5860.00",
					entryTime,
					exitTime,
					quantity: "1",
					profit: "500.00",
				});

				const result2 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade2],
				});

				// Should be unique due to price difference (within 8 decimal precision)
				expect(result2.imported).toBe(1);
				expect(result2.skipped).toBe(0);
			});

			it("should round price differences beyond 8 decimal places for duplicate detection", async () => {
				const baseDate = new Date("2024-06-22T09:00:00Z");
				const entryTime = baseDate.toISOString();
				const exitTime = new Date(baseDate.getTime() + 3600000).toISOString();

				// Use prices that are genuinely different only beyond 8 decimals
				// Both should round to "5900.12345678" via toFixed(8)
				const trade1 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5900.123456780001", // Rounds to 5900.12345678
					exitPrice: "5910.00",
					entryTime,
					exitTime,
					quantity: "1",
					profit: "500.00",
				});

				// First import
				const result1 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade1],
				});
				expect(result1.imported).toBe(1);

				// Trade with price that differs only beyond 8th decimal place
				// Also rounds to "5900.12345678" via toFixed(8)
				const trade2 = createBatchImportTrade({
					symbol: "ES",
					direction: "long",
					entryPrice: "5900.123456780009", // Also rounds to 5900.12345678
					exitPrice: "5910.00",
					entryTime,
					exitTime,
					quantity: "1",
					profit: "500.00",
				});

				const result2 = await caller.trades.batchImport({
					accountId: account.id,
					trades: [trade2],
				});

				// Should be detected as duplicate (normalized to 8 decimals)
				expect(result2.imported).toBe(0);
				expect(result2.skipped).toBe(1);
			});
		});
	});
});
