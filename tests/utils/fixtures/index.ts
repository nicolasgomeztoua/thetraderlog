// User fixtures

// Account fixtures
export {
	type CreateTestAccountOptions,
	createTestAccount,
	resetAccountCounter,
} from "./accounts";
// Pre-composed scenarios
export {
	setupPropChallenge,
	setupTrader,
	setupTraderWithAnalyticsData,
	setupTraderWithMixedTrades,
	setupTraderWithMultipleAccounts,
	setupTraderWithTrades,
} from "./scenarios";

// Trade fixtures
export {
	type CreateTestTradeOptions,
	createTestTrade,
	createTestTrades,
	resetTradeCounter,
} from "./trades";
export {
	type CreateTestUserOptions,
	createTestUser,
	resetUserCounter,
} from "./users";
