/**
 * Integration tests for accounts.getPropCompliance endpoint.
 *
 * Tests the prop compliance metrics endpoint with real database,
 * covering happy path, edge cases, auth validation, and compliance states.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Account, User } from "@/server/db/schema";
import {
	createTestAccount,
	createTestCaller,
	createTestTrade,
	createTestUser,
	createUnauthenticatedCaller,
	setupPropChallenge,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("accounts.getPropCompliance", () => {
	let user: User;
	let account: Account;
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const setup = await setupPropChallenge();
		user = setup.user;
		account = setup.account;
		caller = await createTestCaller(user.clerkId, user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// HAPPY PATH
	// ============================================================================

	describe("happy path with trades", () => {
		beforeAll(async () => {
			// Create some trades on the prop account across different days
			const baseDate = new Date("2026-01-15T10:00:00Z");

			// Day 1: Two winning trades
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: baseDate,
				exitTime: new Date(baseDate.getTime() + 30 * 60000),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5025",
				exitPrice: "5035",
				quantity: "1",
				entryTime: new Date(baseDate.getTime() + 60 * 60000),
				exitTime: new Date(baseDate.getTime() + 90 * 60000),
				realizedPnl: "500",
				netPnl: "495",
				fees: "5",
			});

			// Day 2: One losing trade
			const day2 = new Date("2026-01-16T10:00:00Z");
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5040",
				exitPrice: "5030",
				quantity: "1",
				entryTime: day2,
				exitTime: new Date(day2.getTime() + 45 * 60000),
				realizedPnl: "-500",
				netPnl: "-505",
				fees: "5",
			});

			// Day 3: Small win
			const day3 = new Date("2026-01-17T10:00:00Z");
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5030",
				exitPrice: "5035",
				quantity: "1",
				entryTime: day3,
				exitTime: new Date(day3.getTime() + 20 * 60000),
				realizedPnl: "250",
				netPnl: "245",
				fees: "5",
			});
		});

		it("should return all compliance metrics for account with trades", async () => {
			const result = await caller.accounts.getPropCompliance({
				accountId: account.id,
			});

			// Account info
			expect(result.account.id).toBe(account.id);
			expect(result.account.name).toBe("Prop Challenge");
			expect(result.account.accountType).toBe("prop_challenge");
			expect(result.account.initialBalance).toBe(100000);
			expect(result.account.challengeStatus).toBe("active");

			// Total P&L: 995 + 495 - 505 + 245 = 1230
			expect(result.account.currentBalance).toBeCloseTo(101230, 0);

			// Drawdown (static, account started at 100000)
			expect(result.drawdown.type).toBe("static");
			expect(result.drawdown.limit).toBe(6);
			expect(result.drawdown.status).toBe("safe");

			// Daily loss
			expect(result.dailyLoss).toBeDefined();
			expect(result.dailyLoss.status).toBeDefined();

			// Profit target: 10% of 100000 = $10000 target, current ~$1230
			expect(result.profitTarget.target).toBe(10000);
			expect(result.profitTarget.current).toBeCloseTo(1230, 0);
			expect(result.profitTarget.progress).toBeCloseTo(0.123, 2);
			// Progress < 50% = danger
			expect(result.profitTarget.status).toBe("danger");

			// Consistency: 30% rule
			expect(result.consistency).toBeDefined();
			expect(result.consistency.limit).toBe(30);

			// Trading days: 3 days traded, 5 minimum required
			expect(result.tradingDays.daysTraded).toBe(3);
			expect(result.tradingDays.minRequired).toBe(5);
			expect(result.tradingDays.remaining).toBe(2);
			expect(result.tradingDays.dates).toHaveLength(3);

			// Timeline
			expect(result.timeline.startDate).toBeDefined();
			expect(result.timeline.endDate).toBeDefined();
			expect(result.timeline.daysElapsed).toBeGreaterThan(0);
			expect(result.timeline.daysRemaining).toBeGreaterThanOrEqual(0);

			// Overall status
			expect(["safe", "caution", "danger"]).toContain(result.overallStatus);

			// Equity curve
			expect(result.drawdown.equityCurve.length).toBeGreaterThan(0);
		});
	});

	// ============================================================================
	// EMPTY TRADES
	// ============================================================================

	describe("empty trades", () => {
		let emptyUser: User;
		let emptyAccount: Account;
		let emptyCaller: TestCaller;

		beforeAll(async () => {
			const setup = await setupPropChallenge();
			emptyUser = setup.user;
			emptyAccount = setup.account;
			emptyCaller = await createTestCaller(emptyUser.clerkId, emptyUser);
		});

		it("should return safe status with 0% progress for empty account", async () => {
			const result = await emptyCaller.accounts.getPropCompliance({
				accountId: emptyAccount.id,
			});

			expect(result.account.initialBalance).toBe(100000);
			expect(result.account.currentBalance).toBe(100000);

			// Drawdown: no trades = no drawdown
			expect(result.drawdown.current).toBe(0);
			expect(result.drawdown.status).toBe("safe");

			// Daily loss: no trades today = 0
			expect(result.dailyLoss.todayPnl).toBe(0);
			expect(result.dailyLoss.status).toBe("safe");

			// Profit target: 0% progress
			expect(result.profitTarget.current).toBe(0);
			expect(result.profitTarget.progress).toBe(0);

			// Trading days: 0 traded
			expect(result.tradingDays.daysTraded).toBe(0);
			expect(result.tradingDays.dates).toHaveLength(0);

			// Equity curve: empty
			expect(result.drawdown.equityCurve).toHaveLength(0);

			// Overall should be safe or danger depending on profit target
			// Profit progress is 0 which is < 50% → danger for profit, but drawdown/daily are safe
			// Overall = worst = danger
			expect(result.overallStatus).toBe("danger");
		});
	});

	// ============================================================================
	// DANGER STATE: NEAR MAX DRAWDOWN
	// ============================================================================

	describe("danger state: near max drawdown", () => {
		let dangerUser: User;
		let dangerAccount: Account;
		let dangerCaller: TestCaller;

		beforeAll(async () => {
			// 6% max drawdown of 100000 = $6000 limit
			const setup = await setupPropChallenge({
				account: { maxDrawdown: "6", drawdownType: "static" },
			});
			dangerUser = setup.user;
			dangerAccount = setup.account;
			dangerCaller = await createTestCaller(dangerUser.clerkId, dangerUser);

			// Create a big losing trade: -$5500 (5.5% of 100k)
			// This puts us at 5.5% of 6% max drawdown = 91.7% used
			// Remaining buffer: 0.5% which is < 10% of limit → danger
			await createTestTrade(dangerUser.id, dangerAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "4890",
				quantity: "1",
				entryTime: new Date("2026-01-15T10:00:00Z"),
				exitTime: new Date("2026-01-15T11:00:00Z"),
				realizedPnl: "-5500",
				netPnl: "-5500",
				fees: "0",
			});
		});

		it("should return danger status when near max drawdown", async () => {
			const result = await dangerCaller.accounts.getPropCompliance({
				accountId: dangerAccount.id,
			});

			// Static drawdown: (100000 - 94500) / 100000 = 5.5%
			expect(result.drawdown.current).toBeCloseTo(5.5, 1);
			expect(result.drawdown.limit).toBe(6);
			expect(result.drawdown.status).toBe("danger");

			// Overall should be danger
			expect(result.overallStatus).toBe("danger");
		});
	});

	// ============================================================================
	// DAILY LOSS LIMIT
	// ============================================================================

	describe("daily loss limit", () => {
		let dlUser: User;
		let dlAccount: Account;
		let dlCaller: TestCaller;

		beforeAll(async () => {
			// 3% daily loss limit of 100000 = $3000 daily limit
			const setup = await setupPropChallenge({
				account: { dailyLossLimit: "3" },
			});
			dlUser = setup.user;
			dlAccount = setup.account;
			dlCaller = await createTestCaller(dlUser.clerkId, dlUser);

			// Create losing trades today
			const now = new Date();
			await createTestTrade(dlUser.id, dlAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "4944",
				quantity: "1",
				entryTime: new Date(now.getTime() - 60 * 60000),
				exitTime: new Date(now.getTime() - 30 * 60000),
				realizedPnl: "-2800",
				netPnl: "-2800",
				fees: "0",
			});
		});

		it("should track daily loss against limit", async () => {
			const result = await dlCaller.accounts.getPropCompliance({
				accountId: dlAccount.id,
			});

			// Daily limit: 3% of $100000 = $3000
			expect(result.dailyLoss.limit).toBe(3000);
			// Today's P&L: -$2800
			expect(result.dailyLoss.todayPnl).toBeCloseTo(-2800, 0);
			// Used: 2800/3000 = 0.933
			expect(result.dailyLoss.used).toBeCloseTo(0.933, 1);
			// Remaining: 0.067 → danger (< 10% buffer)
			expect(result.dailyLoss.status).toBe("danger");
		});
	});

	// ============================================================================
	// PROFIT TARGET PROGRESS
	// ============================================================================

	describe("profit target reached", () => {
		let ptUser: User;
		let ptAccount: Account;
		let ptCaller: TestCaller;

		beforeAll(async () => {
			// 10% profit target of 100000 = $10000 target
			const setup = await setupPropChallenge({
				account: { profitTarget: "10" },
			});
			ptUser = setup.user;
			ptAccount = setup.account;
			ptCaller = await createTestCaller(ptUser.clerkId, ptUser);

			// Create winning trades totaling > $10000
			await createTestTrade(ptUser.id, ptAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5100",
				quantity: "2",
				entryTime: new Date("2026-01-15T10:00:00Z"),
				exitTime: new Date("2026-01-15T11:00:00Z"),
				realizedPnl: "10000",
				netPnl: "10000",
				fees: "0",
			});

			await createTestTrade(ptUser.id, ptAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5100",
				exitPrice: "5110",
				quantity: "1",
				entryTime: new Date("2026-01-16T10:00:00Z"),
				exitTime: new Date("2026-01-16T11:00:00Z"),
				realizedPnl: "500",
				netPnl: "500",
				fees: "0",
			});
		});

		it("should show profit target as reached", async () => {
			const result = await ptCaller.accounts.getPropCompliance({
				accountId: ptAccount.id,
			});

			// Target: $10000, current: $10500
			expect(result.profitTarget.target).toBe(10000);
			expect(result.profitTarget.current).toBeCloseTo(10500, 0);
			expect(result.profitTarget.progress).toBeGreaterThanOrEqual(1);
			expect(result.profitTarget.status).toBe("safe");
		});
	});

	// ============================================================================
	// AUTH VALIDATION
	// ============================================================================

	describe("auth validation", () => {
		it("should reject unauthenticated requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(
				unauthCaller.accounts.getPropCompliance({
					accountId: account.id,
				}),
			).rejects.toThrow("UNAUTHORIZED");
		});

		it("should reject request for account not owned by user", async () => {
			// Create another user
			const otherUser = await createTestUser();
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			await expect(
				otherCaller.accounts.getPropCompliance({
					accountId: account.id,
				}),
			).rejects.toThrow("Account not found");
		});
	});

	// ============================================================================
	// NON-PROP ACCOUNT REJECTION
	// ============================================================================

	describe("non-prop account rejection", () => {
		it("should reject request for live account", async () => {
			const liveAccount = await createTestAccount(user.id, {
				name: "Live Account",
				accountType: "live",
				initialBalance: "50000",
			});

			await expect(
				caller.accounts.getPropCompliance({
					accountId: liveAccount.id,
				}),
			).rejects.toThrow("Account is not a prop account");
		});

		it("should reject request for demo account", async () => {
			const demoAccount = await createTestAccount(user.id, {
				name: "Demo Account",
				accountType: "demo",
				initialBalance: "50000",
			});

			await expect(
				caller.accounts.getPropCompliance({
					accountId: demoAccount.id,
				}),
			).rejects.toThrow("Account is not a prop account");
		});
	});

	// ============================================================================
	// TRAILING DRAWDOWN
	// ============================================================================

	describe("trailing drawdown calculation", () => {
		let trailingUser: User;
		let trailingAccount: Account;
		let trailingCaller: TestCaller;

		beforeAll(async () => {
			const setup = await setupPropChallenge({
				account: {
					maxDrawdown: "6",
					drawdownType: "trailing",
				},
			});
			trailingUser = setup.user;
			trailingAccount = setup.account;
			trailingCaller = await createTestCaller(
				trailingUser.clerkId,
				trailingUser,
			);

			// Win first, then lose — trailing tracks from peak
			// Trade 1: +$2000 (peak at $102000)
			await createTestTrade(trailingUser.id, trailingAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5040",
				quantity: "1",
				entryTime: new Date("2026-01-15T10:00:00Z"),
				exitTime: new Date("2026-01-15T11:00:00Z"),
				realizedPnl: "2000",
				netPnl: "2000",
				fees: "0",
			});

			// Trade 2: -$3000 (now at $99000, peak was $102000)
			// Trailing drawdown: dd from peak = 3000, percent = 3000/100000 = 3%
			// Static drawdown would be: (100000-99000)/100000 = 1%
			await createTestTrade(trailingUser.id, trailingAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5040",
				exitPrice: "4980",
				quantity: "1",
				entryTime: new Date("2026-01-16T10:00:00Z"),
				exitTime: new Date("2026-01-16T11:00:00Z"),
				realizedPnl: "-3000",
				netPnl: "-3000",
				fees: "0",
			});
		});

		it("should compute trailing drawdown from high-water mark", async () => {
			const result = await trailingCaller.accounts.getPropCompliance({
				accountId: trailingAccount.id,
			});

			expect(result.drawdown.type).toBe("trailing");
			// Trailing drawdown from peak: 3000/100000 = 3%
			// used = 3/6 = 0.5, remaining = 0.5 → safe (>30% buffer)
			expect(result.drawdown.current).toBeCloseTo(3, 0);
			expect(result.drawdown.limit).toBe(6);
			expect(result.drawdown.status).toBe("safe");

			// Key: trailing drawdown (3%) is higher than static drawdown (1%)
			// because trailing tracks from the peak ($102000), not initial ($100000)
			// Current balance = $99000 → net loss is only $1000 from initial
			expect(result.account.currentBalance).toBeCloseTo(99000, 0);
		});
	});

	// ============================================================================
	// PROP_FUNDED ACCOUNT
	// ============================================================================

	describe("prop_funded account", () => {
		let fundedUser: User;
		let fundedAccount: Account;
		let fundedCaller: TestCaller;

		beforeAll(async () => {
			fundedUser = await createTestUser();
			fundedAccount = await createTestAccount(fundedUser.id, {
				name: "Funded Account",
				accountType: "prop_funded",
				initialBalance: "200000",
				maxDrawdown: "5",
				drawdownType: "static",
				dailyLossLimit: "2",
				isDefault: true,
			});
			fundedCaller = await createTestCaller(fundedUser.clerkId, fundedUser);
		});

		it("should accept prop_funded accounts", async () => {
			const result = await fundedCaller.accounts.getPropCompliance({
				accountId: fundedAccount.id,
			});

			expect(result.account.accountType).toBe("prop_funded");
			expect(result.account.initialBalance).toBe(200000);
			expect(result.drawdown.limit).toBe(5);
			expect(result.drawdown.status).toBe("safe");
		});
	});

	// ============================================================================
	// CONSISTENCY METRIC
	// ============================================================================

	describe("consistency metric", () => {
		let consUser: User;
		let consAccount: Account;
		let consCaller: TestCaller;

		beforeAll(async () => {
			// 30% consistency rule: no single day > 30% of total profit
			const setup = await setupPropChallenge({
				account: { consistencyRule: "30" },
			});
			consUser = setup.user;
			consAccount = setup.account;
			consCaller = await createTestCaller(consUser.clerkId, consUser);

			// Day 1: Big win - $8000
			await createTestTrade(consUser.id, consAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5160",
				quantity: "1",
				entryTime: new Date("2026-01-15T10:00:00Z"),
				exitTime: new Date("2026-01-15T11:00:00Z"),
				realizedPnl: "8000",
				netPnl: "8000",
				fees: "0",
			});

			// Day 2: Small win - $1000
			await createTestTrade(consUser.id, consAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5160",
				exitPrice: "5180",
				quantity: "1",
				entryTime: new Date("2026-01-16T10:00:00Z"),
				exitTime: new Date("2026-01-16T11:00:00Z"),
				realizedPnl: "1000",
				netPnl: "1000",
				fees: "0",
			});

			// Day 3: Small win - $1000
			await createTestTrade(consUser.id, consAccount.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5180",
				exitPrice: "5200",
				quantity: "1",
				entryTime: new Date("2026-01-17T10:00:00Z"),
				exitTime: new Date("2026-01-17T11:00:00Z"),
				realizedPnl: "1000",
				netPnl: "1000",
				fees: "0",
			});
		});

		it("should detect non-compliant consistency when one day dominates", async () => {
			const result = await consCaller.accounts.getPropCompliance({
				accountId: consAccount.id,
			});

			// Total profit: $10000
			// Day 1: $8000 = 80% of total → exceeds 30% rule
			expect(result.consistency.limit).toBe(30);
			expect(result.consistency.maxDayPercent).toBe(80);
			expect(result.consistency.isCompliant).toBe(false);
		});
	});
});
