import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	getTestDb,
	schema,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("strategies.getRuleCompliance", () => {
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

	it("should throw error for non-existent strategy", async () => {
		await expect(
			caller.strategies.getRuleCompliance({ id: "non-existent-id" }),
		).rejects.toThrow("Strategy not found");
	});

	it("should return zero compliance with no trades", async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);

		// Create strategy with rules
		const strategy = await caller.strategies.create({
			name: "Test Strategy",
			rules: [
				{ text: "Wait for confirmation", category: "entry" },
				{ text: "Set stop loss", category: "risk" },
			],
		});

		const result = await caller.strategies.getRuleCompliance({
			id: strategy.id,
		});

		expect(result.totalTrades).toBe(0);
		expect(result.avgCompliance).toBe(0);
		expect(result.tradeCompliance).toEqual([]);
		expect(result.ruleCompliance).toHaveLength(2);
		// With no trades, per-rule compliance is 0
		expect(result.ruleCompliance[0]?.compliance).toBe(0);
		expect(result.ruleCompliance[1]?.compliance).toBe(0);
		// Category compliance should also be 0
		expect(result.categoryCompliance).toHaveLength(4);
	});

	it("should return 100% compliance when all rules checked", async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);
		const db = getTestDb();

		// Create strategy with rules
		const strategy = await caller.strategies.create({
			name: "Full Compliance Strategy",
			rules: [
				{ text: "Wait for confirmation", category: "entry" },
				{ text: "Set stop loss", category: "risk" },
			],
		});

		// Get the created rules
		const rules = await db.query.strategyRules.findMany({
			where: (r, { eq }) => eq(r.strategyId, strategy.id),
		});

		// Create a trade with the strategy
		const [trade] = await db
			.insert(schema.trades)
			.values({
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
				entryTime: new Date("2024-01-15T10:00:00Z"),
				exitTime: new Date("2024-01-15T10:30:00Z"),
				realizedPnl: "500.00",
				netPnl: "500.00",
			})
			.returning();

		// Check all rules for this trade
		for (const rule of rules) {
			await db.insert(schema.tradeRuleChecks).values({
				tradeId: trade.id,
				ruleId: rule.id,
				checked: true,
				checkedAt: new Date(),
			});
		}

		const result = await caller.strategies.getRuleCompliance({
			id: strategy.id,
		});

		expect(result.totalTrades).toBe(1);
		expect(result.avgCompliance).toBe(100);
		expect(result.tradeCompliance).toHaveLength(1);
		expect(result.tradeCompliance[0]?.compliance).toBe(100);
		expect(result.ruleCompliance[0]?.compliance).toBe(100);
		expect(result.ruleCompliance[1]?.compliance).toBe(100);
	});

	it("should calculate partial compliance correctly", async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);
		const db = getTestDb();

		// Create strategy with 2 rules
		const strategy = await caller.strategies.create({
			name: "Partial Compliance Strategy",
			rules: [
				{ text: "Entry rule 1", category: "entry" },
				{ text: "Exit rule 1", category: "exit" },
			],
		});

		const rules = await db.query.strategyRules.findMany({
			where: (r, { eq }) => eq(r.strategyId, strategy.id),
		});

		// Create 2 trades
		const baseTime = new Date("2024-01-15T10:00:00Z");
		const [trade1] = await db
			.insert(schema.trades)
			.values({
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
				entryTime: baseTime,
				exitTime: new Date(baseTime.getTime() + 1800000),
				realizedPnl: "500.00",
				netPnl: "500.00",
			})
			.returning();

		const [trade2] = await db
			.insert(schema.trades)
			.values({
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
				entryTime: new Date(baseTime.getTime() + 3600000),
				exitTime: new Date(baseTime.getTime() + 5400000),
				realizedPnl: "500.00",
				netPnl: "500.00",
			})
			.returning();

		// Trade 1: check both rules (100%)
		for (const rule of rules) {
			await db.insert(schema.tradeRuleChecks).values({
				tradeId: trade1.id,
				ruleId: rule.id,
				checked: true,
				checkedAt: new Date(),
			});
		}

		// Trade 2: check only first rule (50%)
		const firstRule = rules[0];
		const secondRule = rules[1];
		if (!firstRule || !secondRule) {
			throw new Error("Expected 2 rules");
		}
		await db.insert(schema.tradeRuleChecks).values({
			tradeId: trade2.id,
			ruleId: firstRule.id,
			checked: true,
			checkedAt: new Date(),
		});
		await db.insert(schema.tradeRuleChecks).values({
			tradeId: trade2.id,
			ruleId: secondRule.id,
			checked: false,
		});

		const result = await caller.strategies.getRuleCompliance({
			id: strategy.id,
		});

		expect(result.totalTrades).toBe(2);
		// Average compliance: (100 + 50) / 2 = 75
		expect(result.avgCompliance).toBe(75);
		expect(result.tradeCompliance).toHaveLength(2);

		// Entry rule: checked 2/2 = 100%
		const entryRule = result.ruleCompliance.find((r) => r.category === "entry");
		expect(entryRule?.compliance).toBe(100);

		// Exit rule: checked 1/2 = 50%
		const exitRule = result.ruleCompliance.find((r) => r.category === "exit");
		expect(exitRule?.compliance).toBe(50);
	});

	it("should calculate category compliance correctly", async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);
		const db = getTestDb();

		// Create strategy with rules in different categories
		const strategy = await caller.strategies.create({
			name: "Multi-Category Strategy",
			rules: [
				{ text: "Entry rule 1", category: "entry" },
				{ text: "Entry rule 2", category: "entry" },
				{ text: "Risk rule 1", category: "risk" },
				{ text: "Exit rule 1", category: "exit" },
			],
		});

		const rules = await db.query.strategyRules.findMany({
			where: (r, { eq }) => eq(r.strategyId, strategy.id),
		});

		// Create a trade
		const [trade] = await db
			.insert(schema.trades)
			.values({
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
				entryTime: new Date("2024-01-15T10:00:00Z"),
				exitTime: new Date("2024-01-15T10:30:00Z"),
				realizedPnl: "500.00",
				netPnl: "500.00",
			})
			.returning();

		// Check rules: all entry rules, no risk rules, exit rule
		const entryRules = rules.filter((r) => r.category === "entry");
		const riskRules = rules.filter((r) => r.category === "risk");
		const exitRules = rules.filter((r) => r.category === "exit");

		// Entry: 100% (both checked)
		for (const rule of entryRules) {
			await db.insert(schema.tradeRuleChecks).values({
				tradeId: trade.id,
				ruleId: rule.id,
				checked: true,
				checkedAt: new Date(),
			});
		}

		// Risk: 0% (not checked)
		for (const rule of riskRules) {
			await db.insert(schema.tradeRuleChecks).values({
				tradeId: trade.id,
				ruleId: rule.id,
				checked: false,
			});
		}

		// Exit: 100% (checked)
		for (const rule of exitRules) {
			await db.insert(schema.tradeRuleChecks).values({
				tradeId: trade.id,
				ruleId: rule.id,
				checked: true,
				checkedAt: new Date(),
			});
		}

		const result = await caller.strategies.getRuleCompliance({
			id: strategy.id,
		});

		// Category compliance
		const entryCategory = result.categoryCompliance.find(
			(c) => c.category === "entry",
		);
		const riskCategory = result.categoryCompliance.find(
			(c) => c.category === "risk",
		);
		const exitCategory = result.categoryCompliance.find(
			(c) => c.category === "exit",
		);
		const managementCategory = result.categoryCompliance.find(
			(c) => c.category === "management",
		);

		expect(entryCategory?.compliance).toBe(100);
		expect(entryCategory?.rulesCount).toBe(2);
		expect(riskCategory?.compliance).toBe(0);
		expect(riskCategory?.rulesCount).toBe(1);
		expect(exitCategory?.compliance).toBe(100);
		expect(exitCategory?.rulesCount).toBe(1);
		expect(managementCategory?.rulesCount).toBe(0);
		expect(managementCategory?.compliance).toBe(0);
	});

	it("should return 100% compliance for strategy with no rules", async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		userId = setup.user.id;
		accountId = setup.account.id;
		caller = await createTestCaller(setup.user.clerkId, setup.user);
		const db = getTestDb();

		// Create strategy without rules
		const strategy = await caller.strategies.create({
			name: "No Rules Strategy",
		});

		// Create a trade
		await db.insert(schema.trades).values({
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
			entryTime: new Date("2024-01-15T10:00:00Z"),
			exitTime: new Date("2024-01-15T10:30:00Z"),
			realizedPnl: "500.00",
			netPnl: "500.00",
		});

		const result = await caller.strategies.getRuleCompliance({
			id: strategy.id,
		});

		// With no rules to check, compliance is 100% by default
		expect(result.totalTrades).toBe(1);
		expect(result.avgCompliance).toBe(100);
		expect(result.tradeCompliance[0]?.compliance).toBe(100);
		expect(result.ruleCompliance).toEqual([]);
	});
});
