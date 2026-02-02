import { type CreateTestAccountOptions, createTestAccount } from "./accounts";
import {
	type CreateTestTradeOptions,
	createTestTrade,
	createTestTrades,
} from "./trades";
import { type CreateTestUserOptions, createTestUser } from "./users";

/**
 * Gets the base Monday date for analytics test fixtures.
 * Uses a date 3 months ago to stay within the 24-month lookback window.
 * Returns the Monday of that week.
 */
export function getAnalyticsBaseDate(): Date {
	const now = new Date();
	// Go back 3 months to stay well within the 24-month window
	now.setMonth(now.getMonth() - 3);
	// Find the Monday of that week (day 1)
	const dayOfWeek = now.getDay();
	const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	now.setDate(now.getDate() + daysToMonday);
	// Reset to midnight UTC
	now.setUTCHours(0, 0, 0, 0);
	return now;
}

/**
 * Gets the YYYY-MM format month string for the analytics fixtures.
 */
export function getAnalyticsFixtureMonth(): string {
	const base = getAnalyticsBaseDate();
	return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Creates fixture dates for analytics testing.
 * All dates are relative to a base Monday 3 months ago.
 */
export function getAnalyticsFixtureDates() {
	const baseMonday = getAnalyticsBaseDate();

	const mondayMorning = new Date(baseMonday);
	mondayMorning.setUTCHours(9, 30, 0, 0);

	const mondayAfternoon = new Date(baseMonday);
	mondayAfternoon.setUTCHours(14, 0, 0, 0);

	const tuesdayMorning = new Date(baseMonday);
	tuesdayMorning.setUTCDate(tuesdayMorning.getUTCDate() + 1);
	tuesdayMorning.setUTCHours(10, 0, 0, 0);

	const wednesdayMorning = new Date(baseMonday);
	wednesdayMorning.setUTCDate(wednesdayMorning.getUTCDate() + 2);
	wednesdayMorning.setUTCHours(9, 0, 0, 0);

	const thursdayAfternoon = new Date(baseMonday);
	thursdayAfternoon.setUTCDate(thursdayAfternoon.getUTCDate() + 3);
	thursdayAfternoon.setUTCHours(15, 30, 0, 0);

	const fridayMorning = new Date(baseMonday);
	fridayMorning.setUTCDate(fridayMorning.getUTCDate() + 4);
	fridayMorning.setUTCHours(8, 30, 0, 0);

	return {
		baseMonday,
		mondayMorning,
		mondayAfternoon,
		tuesdayMorning,
		wednesdayMorning,
		thursdayAfternoon,
		fridayMorning,
		// Helper for date range filters
		mondayStart: new Date(baseMonday.setUTCHours(0, 0, 0, 0)).toISOString(),
		mondayEnd: (() => {
			const d = new Date(baseMonday);
			d.setUTCHours(23, 59, 59, 999);
			return d.toISOString();
		})(),
		weekStart: new Date(baseMonday.setUTCHours(0, 0, 0, 0)).toISOString(),
		weekEnd: (() => {
			const d = new Date(baseMonday);
			d.setUTCDate(d.getUTCDate() + 4);
			d.setUTCHours(23, 59, 59, 999);
			return d.toISOString();
		})(),
	};
}

/**
 * Sets up a complete trader scenario with user, account, and optionally trades.
 * This is the most common setup for integration tests.
 */
export async function setupTrader(options?: {
	user?: CreateTestUserOptions;
	account?: CreateTestAccountOptions;
}) {
	const user = await createTestUser(options?.user);
	const account = await createTestAccount(user.id, {
		isDefault: true,
		...options?.account,
	});

	return { user, account };
}

/**
 * Sets up a trader with a specified number of closed trades.
 * Useful for testing statistics and analytics.
 */
export async function setupTraderWithTrades(
	tradeCount: number,
	options?: {
		user?: CreateTestUserOptions;
		account?: CreateTestAccountOptions;
		trade?: CreateTestTradeOptions;
	},
) {
	const { user, account } = await setupTrader({
		user: options?.user,
		account: options?.account,
	});

	const trades = await createTestTrades(user.id, account.id, tradeCount, {
		status: "closed",
		...options?.trade,
	});

	return { user, account, trades };
}

/**
 * Sets up a trader with multiple accounts.
 * Useful for testing account switching and multi-account features.
 */
export async function setupTraderWithMultipleAccounts(
	accountCount: number,
	options?: {
		user?: CreateTestUserOptions;
		account?: CreateTestAccountOptions;
	},
) {
	const user = await createTestUser(options?.user);

	const accounts = [];
	for (let i = 0; i < accountCount; i++) {
		const account = await createTestAccount(user.id, {
			name: `Account ${i + 1}`,
			isDefault: i === 0, // First account is default
			...options?.account,
		});
		accounts.push(account);
	}

	return { user, accounts };
}

/**
 * Sets up a prop firm challenge scenario.
 * Creates a user with a prop challenge account.
 */
export async function setupPropChallenge(options?: {
	user?: CreateTestUserOptions;
	initialBalance?: string;
	profitTarget?: string;
	maxDrawdown?: string;
}) {
	const user = await createTestUser(options?.user);
	const account = await createTestAccount(user.id, {
		name: "Prop Challenge",
		accountType: "prop_challenge",
		initialBalance: options?.initialBalance ?? "100000",
		profitTarget: options?.profitTarget ?? "10",
		maxDrawdown: options?.maxDrawdown ?? "6",
		isDefault: true,
	});

	return { user, account };
}

/**
 * Sets up a trader with mixed winning and losing trades.
 * Useful for testing win rate and P&L calculations.
 */
export async function setupTraderWithMixedTrades(options?: {
	user?: CreateTestUserOptions;
	account?: CreateTestAccountOptions;
	winCount?: number;
	lossCount?: number;
}) {
	const { user, account } = await setupTrader({
		user: options?.user,
		account: options?.account,
	});

	const winCount = options?.winCount ?? 3;
	const lossCount = options?.lossCount ?? 2;

	const winningTrades = await createTestTrades(user.id, account.id, winCount, {
		direction: "long",
		entryPrice: "5000.00",
		exitPrice: "5020.00", // +$1000 per contract for ES
		status: "closed",
	});

	const losingTrades = await createTestTrades(user.id, account.id, lossCount, {
		direction: "long",
		entryPrice: "5000.00",
		exitPrice: "4990.00", // -$500 per contract for ES
		status: "closed",
	});

	return {
		user,
		account,
		trades: [...winningTrades, ...losingTrades],
		winningTrades,
		losingTrades,
	};
}

/**
 * Creates a trader with diverse trade data optimized for analytics testing.
 * Provides predictable data for verifying analytics calculations.
 * Uses dynamic dates (3 months ago) to stay within the 24-month lookback window.
 */
export async function setupTraderWithAnalyticsData() {
	const { user, account } = await setupTrader();

	// Use dynamic dates that stay within the lookback window
	const {
		mondayMorning,
		mondayAfternoon,
		tuesdayMorning,
		wednesdayMorning,
		thursdayAfternoon,
		fridayMorning,
	} = getAnalyticsFixtureDates();

	const trades = [];

	// Monday trades (2 wins) - ES
	trades.push(
		await createTestTrade(user.id, account.id, {
			symbol: "ES",
			direction: "long",
			status: "closed",
			entryPrice: "5000",
			exitPrice: "5020",
			quantity: "1",
			entryTime: mondayMorning,
			exitTime: new Date(mondayMorning.getTime() + 30 * 60000), // 30 min later
			realizedPnl: "1000", // 20 pts * $50/pt
			netPnl: "995",
			fees: "5",
			stopLoss: "4980",
			takeProfit: "5030",
		}),
	);

	trades.push(
		await createTestTrade(user.id, account.id, {
			symbol: "ES",
			direction: "long",
			status: "closed",
			entryPrice: "5025",
			exitPrice: "5040",
			quantity: "2",
			entryTime: mondayAfternoon,
			exitTime: new Date(mondayAfternoon.getTime() + 45 * 60000),
			realizedPnl: "1500",
			netPnl: "1490",
			fees: "10",
			stopLoss: "5010",
		}),
	);

	// Tuesday trades (1 loss) - NQ
	trades.push(
		await createTestTrade(user.id, account.id, {
			symbol: "NQ",
			direction: "short",
			status: "closed",
			entryPrice: "17500",
			exitPrice: "17550",
			quantity: "1",
			entryTime: tuesdayMorning,
			exitTime: new Date(tuesdayMorning.getTime() + 60 * 60000),
			realizedPnl: "-1000", // 50 pts * $20/pt loss
			netPnl: "-1005",
			fees: "5",
			stopLoss: "17550",
		}),
	);

	// Wednesday trades (1 win, 1 loss) - ES and EURUSD
	trades.push(
		await createTestTrade(user.id, account.id, {
			symbol: "ES",
			direction: "short",
			status: "closed",
			entryPrice: "5050",
			exitPrice: "5030",
			quantity: "1",
			entryTime: wednesdayMorning,
			exitTime: new Date(wednesdayMorning.getTime() + 20 * 60000),
			realizedPnl: "1000",
			netPnl: "995",
			fees: "5",
			stopLoss: "5070",
			takeProfit: "5020",
		}),
	);

	trades.push(
		await createTestTrade(user.id, account.id, {
			symbol: "EURUSD",
			instrumentType: "forex",
			direction: "long",
			status: "closed",
			entryPrice: "1.0800",
			exitPrice: "1.0780",
			quantity: "100000",
			entryTime: new Date(wednesdayMorning.getTime() + 2 * 60 * 60000),
			exitTime: new Date(wednesdayMorning.getTime() + 4 * 60 * 60000),
			realizedPnl: "-200",
			netPnl: "-202",
			fees: "2",
			stopLoss: "1.0770",
		}),
	);

	// Thursday trade (1 win) - NQ
	trades.push(
		await createTestTrade(user.id, account.id, {
			symbol: "NQ",
			direction: "long",
			status: "closed",
			entryPrice: "17400",
			exitPrice: "17500",
			quantity: "1",
			entryTime: thursdayAfternoon,
			exitTime: new Date(thursdayAfternoon.getTime() + 90 * 60000),
			realizedPnl: "2000",
			netPnl: "1995",
			fees: "5",
			stopLoss: "17350",
			takeProfit: "17550",
		}),
	);

	// Friday trade (1 breakeven) - ES
	trades.push(
		await createTestTrade(user.id, account.id, {
			symbol: "ES",
			direction: "long",
			status: "closed",
			entryPrice: "5060",
			exitPrice: "5060",
			quantity: "1",
			entryTime: fridayMorning,
			exitTime: new Date(fridayMorning.getTime() + 15 * 60000),
			realizedPnl: "0",
			netPnl: "-5", // Just fees
			fees: "5",
			stopLoss: "5040",
		}),
	);

	// Expected metrics for validation:
	// Total trades: 7
	// Wins: 4 (Monday x2, Wednesday ES, Thursday)
	// Losses: 2 (Tuesday, Wednesday EURUSD)
	// Breakeven: 1 (Friday)
	// Win rate: 4/6 = 66.67% (excluding breakeven) or 4/7 = 57.14%
	// Total P&L: 995 + 1490 - 1005 + 995 - 202 + 1995 - 5 = 4263
	// Gross profit: 995 + 1490 + 995 + 1995 = 5475
	// Gross loss: 1005 + 202 = 1207
	// Profit factor: 5475 / 1207 = 4.53

	const expectedMetrics = {
		totalTrades: 7,
		wins: 4,
		losses: 2,
		breakevens: 1,
		totalPnl: 4263,
		grossProfit: 5475,
		grossLoss: 1207,
		profitFactor: 4.53,
		winRate: 66.67, // wins / (wins + losses)
		symbols: ["ES", "NQ", "EURUSD"],
		esTrades: 4,
		nqTrades: 2,
		eurusdTrades: 1,
	};

	return { user, account, trades, expectedMetrics };
}
