import { getTestDb, schema } from "../db";

export interface CreateTestTradeOptions {
	symbol?: string;
	direction?: "long" | "short";
	status?: "open" | "closed";
	entryPrice?: string;
	entryTime?: Date;
	exitPrice?: string;
	exitTime?: Date;
	quantity?: string;
	stopLoss?: string;
	takeProfit?: string;
	realizedPnl?: string;
	netPnl?: string;
	fees?: string;
	setupType?: string;
	notes?: string;
}

let _tradeCounter = 0;

/**
 * Creates a test trade in the database.
 * Requires userId and accountId (trades belong to a user and account).
 */
export async function createTestTrade(
	userId: string,
	accountId: string,
	options: CreateTestTradeOptions = {},
) {
	const db = getTestDb();
	_tradeCounter++;

	const symbol = options.symbol ?? "ES";
	const direction = options.direction ?? "long";
	const status = options.status ?? "closed";
	const entryPrice = options.entryPrice ?? "5000.00";
	const entryTime = options.entryTime ?? new Date();
	const quantity = options.quantity ?? "1";

	// Default exit values for closed trades
	const isClosed = status === "closed";
	const exitPrice = isClosed ? (options.exitPrice ?? "5010.00") : null;
	const exitTime = isClosed ? (options.exitTime ?? new Date()) : null;

	// Calculate P&L for closed trades if not provided
	let realizedPnl = options.realizedPnl;
	let netPnl = options.netPnl;
	const fees = options.fees ?? "2.50";

	if (isClosed && exitPrice && !realizedPnl) {
		// Simplified P&L calculation for ES futures ($50 per point)
		const priceDiff = parseFloat(exitPrice) - parseFloat(entryPrice);
		const multiplier = direction === "long" ? 1 : -1;
		const contractMultiplier = symbol === "ES" ? 50 : symbol === "NQ" ? 20 : 1;
		realizedPnl = (
			priceDiff *
			multiplier *
			parseFloat(quantity) *
			contractMultiplier
		).toFixed(2);
		netPnl = (parseFloat(realizedPnl) - parseFloat(fees)).toFixed(2);
	}

	const [trade] = await db
		.insert(schema.trades)
		.values({
			userId,
			accountId,
			symbol,
			direction,
			status,
			entryPrice,
			entryTime,
			exitPrice,
			exitTime,
			quantity,
			stopLoss: options.stopLoss,
			takeProfit: options.takeProfit,
			realizedPnl,
			netPnl,
			fees,
			setupType: options.setupType,
			notes: options.notes,
			importSource: "manual",
		})
		.returning();

	if (!trade) {
		throw new Error("Failed to create test trade");
	}

	return trade;
}

/**
 * Creates multiple test trades at once.
 */
export async function createTestTrades(
	userId: string,
	accountId: string,
	count: number,
	options: CreateTestTradeOptions = {},
) {
	const trades = [];
	for (let i = 0; i < count; i++) {
		const trade = await createTestTrade(userId, accountId, {
			...options,
			// Vary the entry/exit prices slightly for each trade
			entryPrice: options.entryPrice ?? (5000 + i * 10).toFixed(2),
			exitPrice: options.exitPrice ?? (5010 + i * 10).toFixed(2),
		});
		trades.push(trade);
	}
	return trades;
}

/**
 * Resets the trade counter.
 */
export function resetTradeCounter() {
	_tradeCounter = 0;
}
