import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	getTestDb,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";
import { trades } from "../utils/db";

describe("strategies.getPerformanceByStrategy", () => {
	let caller: TestCaller;
	let userId: string;
	let accountId: string;

	beforeAll(async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	it("should return empty array when no strategies exist", async () => {
		// Create a new user with no strategies
		await truncateAllTables();
		const setup = await setupTrader();
		const newCaller = await createTestCaller(setup.user.clerkId, setup.user);

		const result = await newCaller.strategies.getPerformanceByStrategy();

		expect(result).toEqual([]);
	});

	it("should return strategy with zero metrics when no trades", async () => {
		// Re-setup after truncate
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);

		// Create strategy but no trades
		const strategy = await caller.strategies.create({
			name: "No Trades Strategy",
			color: "#ff00ff",
		});

		const result = await caller.strategies.getPerformanceByStrategy();

		expect(result).toHaveLength(1);
		expect(result[0]?.strategyId).toBe(strategy.id);
		expect(result[0]?.strategyName).toBe("No Trades Strategy");
		expect(result[0]?.strategyColor).toBe("#ff00ff");
		expect(result[0]?.tradesCount).toBe(0);
		expect(result[0]?.winRate).toBe(0);
		expect(result[0]?.totalPnl).toBe(0);
		expect(result[0]?.profitFactor).toBe(0);
		expect(result[0]?.recentPnlSeries).toEqual([]);
	});

	it("should calculate correct metrics for winning trades", async () => {
		// Re-setup
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);

		// Create strategy
		const strategy = await caller.strategies.create({
			name: "Winner Strategy",
			color: "#00ff88",
		});

		// Create 3 winning ES trades (10 pts each at $50/pt = $500 per trade)
		const db = getTestDb();
		const baseTime = new Date("2024-01-15T10:00:00Z");
		for (let i = 0; i < 3; i++) {
			const entryTime = new Date(baseTime.getTime() + i * 3600000); // 1 hour apart
			const exitTime = new Date(entryTime.getTime() + 1800000); // 30 min later
			await db.insert(trades).values({
				userId,
				accountId,
				strategyId: strategy.id,
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				entryPrice: "5000.00",
				exitPrice: "5010.00",
				quantity: "1",
				entryTime,
				exitTime,
				realizedPnl: "500.00",
				netPnl: "500.00",
			});
		}

		const result = await caller.strategies.getPerformanceByStrategy();

		expect(result).toHaveLength(1);
		const perf = result[0];
		expect(perf?.strategyId).toBe(strategy.id);
		expect(perf?.tradesCount).toBe(3);
		expect(perf?.winRate).toBe(100);
		expect(perf?.totalPnl).toBe(1500);
		expect(perf?.profitFactor).toBe(0); // No losses = infinity, capped to 0 in calculateAggregateStats
		expect(perf?.avgPnl).toBe(500);
		// recentPnlSeries should be cumulative: [500, 1000, 1500]
		expect(perf?.recentPnlSeries).toEqual([500, 1000, 1500]);
	});

	it("should calculate correct metrics for mixed win/loss trades", async () => {
		// Re-setup
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);

		// Create strategy
		const strategy = await caller.strategies.create({
			name: "Mixed Strategy",
			color: "#d4ff00",
		});

		// Create trades: 2 wins (+$500 each), 1 loss (-$500)
		const db = getTestDb();
		const baseTime = new Date("2024-01-15T10:00:00Z");

		// Win 1
		await db.insert(trades).values({
			userId,
			accountId,
			strategyId: strategy.id,
			symbol: "ES",
			instrumentType: "futures",
			direction: "long",
			status: "closed",
			entryPrice: "5000.00",
			exitPrice: "5010.00",
			quantity: "1",
			entryTime: new Date(baseTime.getTime()),
			exitTime: new Date(baseTime.getTime() + 1800000),
			realizedPnl: "500.00",
			netPnl: "500.00",
		});

		// Loss
		await db.insert(trades).values({
			userId,
			accountId,
			strategyId: strategy.id,
			symbol: "ES",
			instrumentType: "futures",
			direction: "long",
			status: "closed",
			entryPrice: "5000.00",
			exitPrice: "4990.00",
			quantity: "1",
			entryTime: new Date(baseTime.getTime() + 3600000),
			exitTime: new Date(baseTime.getTime() + 5400000),
			realizedPnl: "-500.00",
			netPnl: "-500.00",
		});

		// Win 2
		await db.insert(trades).values({
			userId,
			accountId,
			strategyId: strategy.id,
			symbol: "ES",
			instrumentType: "futures",
			direction: "long",
			status: "closed",
			entryPrice: "5000.00",
			exitPrice: "5010.00",
			quantity: "1",
			entryTime: new Date(baseTime.getTime() + 7200000),
			exitTime: new Date(baseTime.getTime() + 9000000),
			realizedPnl: "500.00",
			netPnl: "500.00",
		});

		const result = await caller.strategies.getPerformanceByStrategy();

		expect(result).toHaveLength(1);
		const perf = result[0];
		expect(perf?.tradesCount).toBe(3);
		// 2 wins out of 3 trades = 66.67%
		expect(perf?.winRate).toBeCloseTo(66.67, 1);
		// Total P&L: 500 + (-500) + 500 = 500
		expect(perf?.totalPnl).toBe(500);
		// Profit factor: grossProfit / grossLoss = 1000 / 500 = 2.0
		expect(perf?.profitFactor).toBe(2);
		// Avg P&L: 500 / 3 = 166.67
		expect(perf?.avgPnl).toBeCloseTo(166.67, 1);
		// Cumulative series sorted by exit time: [500, 0, 500]
		expect(perf?.recentPnlSeries).toEqual([500, 0, 500]);
	});

	it("should only include active strategies", async () => {
		// Re-setup
		await truncateAllTables();
		const setup = await setupTrader();
		caller = await createTestCaller(setup.user.clerkId, setup.user);

		// Create active strategy
		const activeStrategy = await caller.strategies.create({
			name: "Active Strategy",
			isActive: true,
		});

		// Create inactive strategy
		await caller.strategies.create({
			name: "Inactive Strategy",
			isActive: false,
		});

		const result = await caller.strategies.getPerformanceByStrategy();

		// Should only include active strategy
		expect(result).toHaveLength(1);
		expect(result[0]?.strategyId).toBe(activeStrategy.id);
		expect(result[0]?.strategyName).toBe("Active Strategy");
	});

	it("should build recentPnlSeries with last 20 trades only", async () => {
		// Re-setup
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);

		// Create strategy
		const strategy = await caller.strategies.create({
			name: "Many Trades Strategy",
		});

		// Create 25 trades (should only use last 20 for series)
		const db = getTestDb();
		const baseTime = new Date("2024-01-15T10:00:00Z");
		for (let i = 0; i < 25; i++) {
			await db.insert(trades).values({
				userId,
				accountId,
				strategyId: strategy.id,
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				status: "closed",
				entryPrice: "5000.00",
				exitPrice: "5010.00",
				quantity: "1",
				entryTime: new Date(baseTime.getTime() + i * 3600000),
				exitTime: new Date(baseTime.getTime() + i * 3600000 + 1800000),
				realizedPnl: "500.00",
				netPnl: "500.00",
			});
		}

		const result = await caller.strategies.getPerformanceByStrategy();

		expect(result).toHaveLength(1);
		const perf = result[0];
		expect(perf?.tradesCount).toBe(25);
		// recentPnlSeries should have exactly 20 entries (last 20 trades)
		expect(perf?.recentPnlSeries).toHaveLength(20);
		// First entry: $500 (first of last 20, cumulative starts fresh)
		// Last entry: 20 * 500 = $10,000
		expect(perf?.recentPnlSeries[0]).toBe(500);
		expect(perf?.recentPnlSeries[19]).toBe(10000);
	});
});
