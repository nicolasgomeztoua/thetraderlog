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
