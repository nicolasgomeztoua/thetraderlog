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

/** The user_settings columns shared by all three settings helpers. */
type UserSettingsRow = Pick<
	typeof userSettings.$inferSelect,
	"breakevenThreshold" | "timezone" | "tradingSessions"
>;

/**
 * Per-request cache for the user_settings row, keyed by userId.
 *
 * Lives on the tRPC context (one per HTTP request, shared across all batched
 * procedures). Passing it to the settings helpers collapses what used to be one
 * `findFirst` per helper per procedure (the analytics page issued ~60) into a
 * single DB round-trip per request.
 */
export type UserSettingsCache = Map<
	string,
	Promise<UserSettingsRow | undefined>
>;

/**
 * Fetch the user_settings row (the three columns the helpers need), deduplicated
 * via an optional per-request cache.
 */
function fetchUserSettingsRow(
	db: Db,
	userId: string,
	cache?: UserSettingsCache,
): Promise<UserSettingsRow | undefined> {
	const hit = cache?.get(userId);
	if (hit) {
		return hit;
	}
	// Wrap in Promise.resolve: Drizzle query builders are lazy thenables, so
	// caching the raw builder would re-execute the query on every await.
	const promise = Promise.resolve(
		db.query.userSettings.findFirst({
			where: eq(userSettings.userId, userId),
			columns: {
				breakevenThreshold: true,
				timezone: true,
				tradingSessions: true,
			},
		}),
	);
	// Set synchronously (before any await) so concurrently-awaited helpers in the
	// same Promise.all share one query instead of racing into three.
	cache?.set(userId, promise);
	return promise;
}

/**
 * Get user's breakeven threshold setting
 * Default is $3.00 if not set
 */
export async function getUserBreakevenThreshold(
	db: Db,
	userId: string,
	cache?: UserSettingsCache,
): Promise<number> {
	const result = await fetchUserSettingsRow(db, userId, cache);
	return parseFloat(result?.breakevenThreshold ?? "3.00");
}

/**
 * Get user's timezone setting
 * Default is UTC if not set
 */
export async function getUserTimezone(
	db: Db,
	userId: string,
	cache?: UserSettingsCache,
): Promise<string> {
	const result = await fetchUserSettingsRow(db, userId, cache);
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
	cache?: UserSettingsCache,
): Promise<TradingSession[]> {
	const result = await fetchUserSettingsRow(db, userId, cache);

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
