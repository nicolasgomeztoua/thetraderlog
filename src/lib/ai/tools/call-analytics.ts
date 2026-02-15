import { eq } from "drizzle-orm";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import type { db as DbInstance } from "@/server/db";
import { users } from "@/server/db/schema";

type Db = typeof DbInstance;

// =============================================================================
// ALLOWED ENDPOINTS
// =============================================================================

/**
 * Allowlisted analytics endpoints that the AI can call.
 * Only query procedures — no mutations.
 */
const ALLOWED_ANALYTICS_ENDPOINTS = [
	"getOverview",
	"getCalendarData",
	"getPerformanceByDayOfWeek",
	"getPerformanceByHour",
	"getPerformanceBySession",
	"getPerformanceByMonth",
	"getRiskMetrics",
	"getEquityCurve",
	"getDrawdownHistory",
	"getRMultipleDistribution",
	"getRiskRewardAnalysis",
	"getPositionSizeAnalysis",
	"getPerformanceBySymbol",
	"getSymbolTrend",
	"getStreakAnalysis",
	"getRevengeTrading",
	"getOvertradingAnalysis",
	"getHoldingTimeAnalysis",
	"getBehavioralPatterns",
	"getMonteCarloSimulation",
	"getFilteredTradeCount",
	"exportFilteredTrades",
] as const;

const ALLOWED_TRADES_ENDPOINTS = ["getStats", "getAll"] as const;

type AnalyticsEndpoint = (typeof ALLOWED_ANALYTICS_ENDPOINTS)[number];
type TradesEndpoint = (typeof ALLOWED_TRADES_ENDPOINTS)[number];

const ANALYTICS_SET = new Set<string>(ALLOWED_ANALYTICS_ENDPOINTS);
const TRADES_SET = new Set<string>(ALLOWED_TRADES_ENDPOINTS);

// =============================================================================
// EXECUTOR
// =============================================================================

export async function executeCallAnalytics(
	userId: string,
	router: string,
	endpoint: string,
	input?: Record<string, unknown>,
	db?: Db,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	// Validate router
	if (router !== "analytics" && router !== "trades") {
		return {
			success: false,
			error: `Invalid router "${router}". Must be "analytics" or "trades".`,
		};
	}

	// Validate endpoint against allowlist
	if (router === "analytics" && !ANALYTICS_SET.has(endpoint)) {
		return {
			success: false,
			error: `Endpoint "analytics.${endpoint}" is not allowed. Available: ${ALLOWED_ANALYTICS_ENDPOINTS.join(", ")}`,
		};
	}
	if (router === "trades" && !TRADES_SET.has(endpoint)) {
		return {
			success: false,
			error: `Endpoint "trades.${endpoint}" is not allowed. Available: ${ALLOWED_TRADES_ENDPOINTS.join(", ")}`,
		};
	}

	try {
		// Look up the user by internal ID to get their clerkId for the tRPC context.
		// The userId parameter is an internal ID (e.g. "usr_abc"), but the auth middleware
		// looks up users by clerkId. We also pass the full user object to skip the lookup.
		const { dbReadOnly } = await import("@/server/db");
		const resolvedDb = db ?? dbReadOnly;

		const user = await resolvedDb.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!user) {
			return {
				success: false,
				error: "User not found — cannot call analytics endpoint.",
			};
		}

		// Create a server-side tRPC caller with the user's context
		const ctx = await createTRPCContext(
			{ headers: new Headers() },
			{ userId: user.clerkId, user, db: resolvedDb },
		);
		const caller = createCaller(ctx);

		let result: unknown;

		if (router === "analytics") {
			const procedure = caller.analytics[endpoint as AnalyticsEndpoint];
			// biome-ignore lint/suspicious/noExplicitAny: tRPC caller procedures have dynamic input types
			result = await (procedure as any)(input);
		} else {
			const procedure = caller.trades[endpoint as TradesEndpoint];
			// biome-ignore lint/suspicious/noExplicitAny: tRPC caller procedures have dynamic input types
			result = await (procedure as any)(input);
		}

		return {
			success: true,
			data: result,
		};
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Unknown error calling endpoint";
		return {
			success: false,
			error: `Error calling ${router}.${endpoint}: ${message}`,
		};
	}
}
