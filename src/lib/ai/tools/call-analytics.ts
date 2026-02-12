import type { ToolDefinition } from "@/lib/ai/client";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

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
// TOOL DEFINITION
// =============================================================================

export const callAnalyticsToolDefinition: ToolDefinition = {
	type: "function",
	function: {
		name: "call_analytics",
		description:
			"Call an existing analytics or trades tRPC endpoint to get pre-computed trading statistics. " +
			"Prefer this over raw SQL queries when an endpoint already provides the data you need. " +
			"Available analytics endpoints: getOverview, getCalendarData, getPerformanceByDayOfWeek, " +
			"getPerformanceByHour, getPerformanceBySession, getPerformanceByMonth, getRiskMetrics, " +
			"getEquityCurve, getDrawdownHistory, getRMultipleDistribution, getRiskRewardAnalysis, " +
			"getPositionSizeAnalysis, getPerformanceBySymbol, getSymbolTrend, getStreakAnalysis, " +
			"getRevengeTrading, getOvertradingAnalysis, getHoldingTimeAnalysis, getBehavioralPatterns, " +
			"getMonteCarloSimulation, getFilteredTradeCount, exportFilteredTrades. " +
			"Available trades endpoints: getStats, getAll. " +
			"Most analytics endpoints accept optional input: { accountId?: string, filters?: { symbols?, dateRange?: { start?, end? }, " +
			"daysOfWeek?, hours?, sessions?, strategies?, tags?, rMultipleRange?, positionSizeRange?, outcome?, reviewed? } }. " +
			"trades.getStats accepts: { startDate?, endDate?, accountId? }. " +
			"trades.getAll accepts: { limit?, status?, symbol?, startDate?, endDate?, accountId?, sortField?, sortDirection? }.",
		parameters: {
			type: "object",
			properties: {
				router: {
					type: "string",
					enum: ["analytics", "trades"],
					description: 'The tRPC router to call: "analytics" or "trades".',
				},
				endpoint: {
					type: "string",
					description:
						"The endpoint name to call (e.g., getOverview, getStats).",
				},
				input: {
					type: "object",
					description:
						"Input parameters for the endpoint. Shape depends on the endpoint. Most analytics endpoints accept { accountId?, filters? }.",
				},
			},
			required: ["router", "endpoint"],
		},
	},
};

// =============================================================================
// EXECUTOR
// =============================================================================

export async function executeCallAnalytics(
	userId: string,
	router: string,
	endpoint: string,
	input?: Record<string, unknown>,
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
		// Create a server-side tRPC caller with the user's context
		const ctx = await createTRPCContext({ headers: new Headers() }, { userId });
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
