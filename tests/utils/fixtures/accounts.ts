import { getTestDb, schema } from "../db";

export interface CreateTestAccountOptions {
	name?: string;
	broker?: string;
	platform?:
		| "mt4"
		| "mt5"
		| "projectx"
		| "topstepx"
		| "ninjatrader"
		| "tradovate"
		| "rithmic"
		| "apex"
		| "other";
	accountType?: "prop_challenge" | "prop_funded" | "live" | "demo";
	initialBalance?: string;
	currency?: string;
	isDefault?: boolean;
	isActive?: boolean;
	// Prop firm fields
	maxDrawdown?: string;
	drawdownType?: "trailing" | "static" | "eod";
	dailyLossLimit?: string;
	profitTarget?: string;
	consistencyRule?: string;
	minTradingDays?: number;
	challengeStartDate?: Date;
	challengeEndDate?: Date;
	challengeStatus?: "active" | "passed" | "failed";
	profitSplit?: string;
	payoutFrequency?: "weekly" | "bi_weekly" | "monthly";
	linkedAccountId?: string;
}

let accountCounter = 0;

/**
 * Creates a test trading account in the database.
 * Requires a userId (accounts must belong to a user).
 */
export async function createTestAccount(
	userId: string,
	options: CreateTestAccountOptions = {},
) {
	const db = getTestDb();
	accountCounter++;

	const name = options.name ?? `Test Account ${accountCounter}`;
	const platform = options.platform ?? "other";
	const accountType = options.accountType ?? "demo";
	const initialBalance = options.initialBalance ?? "10000";
	const currency = options.currency ?? "USD";
	const isDefault = options.isDefault ?? false;
	const isActive = options.isActive ?? true;

	const [account] = await db
		.insert(schema.accounts)
		.values({
			userId,
			name,
			broker: options.broker,
			platform,
			accountType,
			initialBalance,
			currency,
			isDefault,
			isActive,
			maxDrawdown: options.maxDrawdown,
			drawdownType: options.drawdownType,
			dailyLossLimit: options.dailyLossLimit,
			profitTarget: options.profitTarget,
			consistencyRule: options.consistencyRule,
			minTradingDays: options.minTradingDays,
			challengeStartDate: options.challengeStartDate,
			challengeEndDate: options.challengeEndDate,
			challengeStatus: options.challengeStatus,
			profitSplit: options.profitSplit,
			payoutFrequency: options.payoutFrequency,
			linkedAccountId: options.linkedAccountId,
		})
		.returning();

	if (!account) {
		throw new Error("Failed to create test account");
	}

	return account;
}

/**
 * Resets the account counter.
 */
export function resetAccountCounter() {
	accountCounter = 0;
}
