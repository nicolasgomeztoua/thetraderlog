import { and, eq } from "drizzle-orm";
import { getTimezoneAbbreviation } from "@/lib/shared";
import { getUserTimezone } from "@/server/api/helpers";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import type { db } from "@/server/db";
import { accounts, users } from "@/server/db/schema";

type Database = typeof db;

/**
 * Public-safe payload for a shared account analytics dashboard.
 *
 * Built by running every analytics procedure through an owner-scoped server-side
 * caller, so the public page renders a read-only mirror of exactly what the owner
 * sees. The single account's display name + the trader's profile are exposed; the
 * raw account balance and everything else stays private (risk metrics compute from
 * the balance internally but it is never returned).
 */
export type SharedAnalyticsPayload = NonNullable<
	Awaited<ReturnType<typeof getSharedAnalyticsPayload>>
>;

/**
 * Load owner-scoped analytics for a single account and project to the public
 * share shape. Returns null when the owner or account is missing.
 *
 * Note: callers are responsible for validating the share link (active, not
 * expired, resourceType "account_analytics") before calling this.
 */
export async function getSharedAnalyticsPayload(
	database: Database,
	accountId: string,
	ownerUserId: string,
) {
	// Fetch the owner (for the owner-scoped caller + trader profile) and the
	// account metadata. The account is matched against ownerUserId so a link can
	// never resolve to an account the owner no longer owns.
	const [owner, account] = await Promise.all([
		database.query.users.findFirst({ where: eq(users.id, ownerUserId) }),
		database.query.accounts.findFirst({
			where: and(eq(accounts.id, accountId), eq(accounts.userId, ownerUserId)),
			columns: { name: true, accountType: true },
		}),
	]);

	if (!owner || !account) return null;

	// Build an owner-scoped server-side caller. The share token has already been
	// validated; every analytics procedure scopes to ownerUserId + accountId, so
	// nothing outside this account is reachable. No Clerk session is involved —
	// the owner user is supplied directly via the context override.
	const ctx = await createTRPCContext(
		{ headers: new Headers() },
		{ userId: owner.clerkId, user: owner },
	);
	const caller = createCaller(ctx);

	// Static snapshot: no filters (the public view is read-only).
	const scope = { accountId, filters: undefined };

	const [
		overview,
		calendar,
		dayOfWeek,
		hour,
		session,
		monthly,
		riskMetrics,
		equityCurve,
		drawdowns,
		rMultiple,
		riskReward,
		positionSize,
		symbolPerformance,
		symbolTrend,
		streak,
		revenge,
		overtrading,
		holdingTime,
		behavioral,
		closedTrades,
		ownerTimezone,
	] = await Promise.all([
		caller.analytics.getOverview(scope),
		caller.analytics.getCalendarData(scope),
		caller.analytics.getPerformanceByDayOfWeek(scope),
		caller.analytics.getPerformanceByHour(scope),
		caller.analytics.getPerformanceBySession(scope),
		caller.analytics.getPerformanceByMonth(scope),
		// publicSafe: Risk of Ruin is computed from a standardized default risk,
		// not the account balance, so the raw balance can't be recovered.
		caller.analytics.getRiskMetrics({ ...scope, publicSafe: true }),
		caller.analytics.getEquityCurve(scope),
		caller.analytics.getDrawdownHistory(scope),
		caller.analytics.getRMultipleDistribution(scope),
		caller.analytics.getRiskRewardAnalysis(scope),
		caller.analytics.getPositionSizeAnalysis(scope),
		caller.analytics.getPerformanceBySymbol(scope),
		caller.analytics.getSymbolTrend(scope),
		caller.analytics.getStreakAnalysis(scope),
		caller.analytics.getRevengeTrading(scope),
		caller.analytics.getOvertradingAnalysis(scope),
		caller.analytics.getHoldingTimeAnalysis(scope),
		caller.analytics.getBehavioralPatterns(scope),
		caller.trades.getAll({ status: "closed", accountId, limit: 100 }),
		getUserTimezone(database, ownerUserId, ctx.userSettingsCache),
	]);

	// Derive only the minimal per-trade arrays the Overview charts need
	// (cumulative P&L + P&L-by-trade) server-side — never ship full trade rows.
	// Order matches trades.getAll (most recent entry first); the client reverses
	// for the chronological cumulative curve, mirroring the authenticated page.
	const closedPnl = closedTrades.items
		.filter((t) => t.netPnl)
		.map((t) => ({
			pnl: Number.parseFloat(t.netPnl ?? "0"),
			exitTime: t.exitTime,
		}));

	return {
		data: {
			// Hours are bucketed in the owner's timezone; label it so the public
			// viewer knows whose timezone the hourly buckets reflect.
			timezoneAbbr: getTimezoneAbbreviation(ownerTimezone),
			overview,
			calendar,
			dayOfWeek,
			hour,
			session,
			monthly,
			riskMetrics,
			// Strip internal trade primary keys — the equity-curve chart never uses
			// them, and they shouldn't appear in a public payload.
			equityCurve: equityCurve.map((point) => ({ ...point, tradeId: null })),
			drawdowns,
			rMultiple,
			riskReward,
			positionSize,
			symbolPerformance,
			symbolTrend,
			streak,
			revenge,
			overtrading,
			holdingTime,
			behavioral,
			closedPnl,
		},
		account: {
			name: account.name,
			accountType: account.accountType,
		},
		trader: {
			name: owner.name ?? null,
			imageUrl: owner.imageUrl ?? null,
		},
	};
}
