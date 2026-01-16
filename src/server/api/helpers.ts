// =============================================================================
// SHARED ROUTER HELPERS
// Common utilities for tRPC routers to reduce code duplication
// =============================================================================

import { and, eq } from "drizzle-orm";
import type { db as DbType } from "@/server/db";
import { accounts, userSettings } from "@/server/db/schema";

type Db = typeof DbType;

// =============================================================================
// USER SETTINGS HELPERS
// =============================================================================

/**
 * Get user's breakeven threshold setting
 * Default is $3.00 if not set
 */
export async function getUserBreakevenThreshold(
	db: Db,
	userId: string,
): Promise<number> {
	const result = await db.query.userSettings.findFirst({
		where: eq(userSettings.userId, userId),
		columns: { breakevenThreshold: true },
	});
	return parseFloat(result?.breakevenThreshold ?? "3.00");
}

/**
 * Get user's timezone setting
 * Default is UTC if not set
 */
export async function getUserTimezone(db: Db, userId: string): Promise<string> {
	const result = await db.query.userSettings.findFirst({
		where: eq(userSettings.userId, userId),
		columns: { timezone: true },
	});
	return result?.timezone ?? "UTC";
}

/**
 * Trading session configuration
 */
export interface TradingSession {
	name: string;
	startHour: number;
	endHour: number;
	color?: string;
}

/**
 * Default trading sessions (UTC hours)
 */
export const DEFAULT_TRADING_SESSIONS: TradingSession[] = [
	{ name: "Asia", startHour: 0, endHour: 8, color: "#00d4ff" },
	{ name: "London", startHour: 8, endHour: 16, color: "#d4ff00" },
	{ name: "New York", startHour: 13, endHour: 21, color: "#00ff88" },
];

/**
 * Get user's trading session configurations
 * Default to standard Asia/London/New York sessions if not configured
 */
export async function getUserTradingSessions(
	db: Db,
	userId: string,
): Promise<TradingSession[]> {
	const result = await db.query.userSettings.findFirst({
		where: eq(userSettings.userId, userId),
		columns: { tradingSessions: true },
	});

	if (result?.tradingSessions) {
		try {
			const parsed = JSON.parse(result.tradingSessions);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		} catch {
			// Keep defaults on parse error
		}
	}
	return DEFAULT_TRADING_SESSIONS;
}

// =============================================================================
// ACCOUNT QUERY HELPERS
// =============================================================================

/**
 * Get a subquery for active account IDs
 * Use this to filter trades to only include those from active accounts
 *
 * @example
 * const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
 * conditions.push(sql`${trades.accountId} IN (${activeAccountIds})`);
 */
export function getActiveAccountsSubquery(db: Db, userId: string) {
	return db
		.select({ id: accounts.id })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));
}
