import { tool } from "ai";
import { z } from "zod";
import type { db as DbInstance } from "@/server/db";
import { executeCallAnalytics } from "./call-analytics";
import { executeGetMarketData } from "./get-market-data";
import { executeRunPython } from "./run-python";
import { executeRunQuery } from "./run-query";
import { executeStoreReportData } from "./store-report-data";

type Db = typeof DbInstance;

// =============================================================================
// TOOL CONTEXT
// =============================================================================

interface ToolContext {
	userId: string;
	db?: Db;
	dataStore?: Map<string, unknown>;
}

// =============================================================================
// VERCEL AI SDK TOOL DEFINITIONS
// =============================================================================

function createRunQueryTool(context: ToolContext) {
	return tool({
		description:
			"Execute a read-only SQL SELECT query against the trading database. " +
			"All queries are automatically scoped to the current user via CTEs. " +
			"Use user_trades, user_accounts, user_tags, user_strategies, user_journals, " +
			"user_executions, user_trade_tags as table aliases (they filter to the current user). " +
			"P&L columns (realized_pnl, net_pnl, fees) are stored as decimal strings — use CAST(column AS NUMERIC) for aggregation. " +
			"Always include deleted_at IS NULL for trade queries to exclude soft-deleted trades. " +
			"Results are limited to 500 rows.",
		inputSchema: z.object({
			query: z
				.string()
				.describe(
					"A SELECT SQL query. Use the user-scoped CTE aliases (user_trades, user_accounts, etc.) instead of raw table names. " +
						"Example: SELECT symbol, COUNT(*) as trades, SUM(CAST(net_pnl AS NUMERIC)) as total_pnl FROM user_trades WHERE deleted_at IS NULL GROUP BY symbol ORDER BY total_pnl DESC LIMIT 20",
				),
		}),
		execute: async ({ query }) => {
			if (!context.db) {
				return {
					success: false,
					error: "Database instance required for run_query tool",
				};
			}
			return executeRunQuery(context.userId, query, context.db);
		},
	});
}

function createCallAnalyticsTool(context: ToolContext) {
	return tool({
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
		inputSchema: z.object({
			router: z
				.enum(["analytics", "trades"])
				.describe('The tRPC router to call: "analytics" or "trades".'),
			endpoint: z
				.string()
				.describe("The endpoint name to call (e.g., getOverview, getStats)."),
			input: z
				.record(z.string(), z.unknown())
				.optional()
				.describe(
					"Input parameters for the endpoint. Shape depends on the endpoint. Most analytics endpoints accept { accountId?, filters? }.",
				),
		}),
		execute: async ({ router, endpoint, input }) => {
			return executeCallAnalytics(
				context.userId,
				router,
				endpoint,
				input,
				context.db,
			);
		},
	});
}

function createGetMarketDataTool() {
	return tool({
		description:
			"Fetch OHLC (Open, High, Low, Close) candle data for a specific trading symbol and time range. " +
			"Supports futures symbols (ES, NQ, MNQ, MES, CL, GC, etc.) and forex pairs (EUR/USD, GBP/USD, etc.). " +
			"Data is fetched from Databento (futures) or Twelve Data (forex) with automatic caching. " +
			"Available intervals: 1min, 5min, 15min, 30min, 1h, 4h. " +
			"Use this tool to analyze price action around specific trades or time periods. " +
			"Results are limited to 1000 bars. For large date ranges, use a larger interval (e.g., 1h or 4h).",
		inputSchema: z.object({
			symbol: z
				.string()
				.describe(
					'Trading symbol (e.g., "ES", "NQ", "MNQ", "EUR/USD", "GBP/JPY"). ' +
						"Futures symbols use short codes (ES, NQ, CL, GC). " +
						"Forex pairs use slash format (EUR/USD, GBP/JPY).",
				),
			interval: z
				.enum(["1min", "5min", "15min", "30min", "1h", "4h"])
				.describe(
					"Bar interval. Use smaller intervals (1min, 5min) for intraday analysis and larger (1h, 4h) for multi-day ranges.",
				),
			startDate: z
				.string()
				.describe(
					'Start date/time in ISO 8601 format (e.g., "2026-01-15T09:30:00Z" or "2026-01-15").',
				),
			endDate: z
				.string()
				.describe(
					'End date/time in ISO 8601 format (e.g., "2026-01-15T16:00:00Z" or "2026-01-15").',
				),
		}),
		execute: async ({ symbol, interval, startDate, endDate }) => {
			return executeGetMarketData(symbol, interval, startDate, endDate);
		},
	});
}

function createRunPythonTool() {
	return tool({
		description:
			"Execute Python code in a secure sandboxed environment (Daytona). " +
			"Pre-installed packages: pandas, numpy, scipy, matplotlib, plotly, seaborn, statsmodels. " +
			"Use for statistical analysis, custom calculations, and chart generation. " +
			"For charts, use matplotlib with plt.show() — chart data and PNG images are automatically captured. " +
			"For plotly, use fig.write_image() to save to /tmp/ and the image will be uploaded. " +
			"Print results to stdout for the AI to read. " +
			"Execution timeout: 60 seconds. " +
			"You can pass data as a JSON string in the dataContext parameter — " +
			"it will be available in the sandbox as a file at /tmp/data.json. " +
			"CHART STYLING: Use dark theme — figure/axes facecolor '#0a0a0a', text '#e0e0e0', grid '#1a1a1a', " +
			"profit '#00ff88', loss '#ff3b3b', accent '#d4ff00', ai accent '#00d4ff'. " +
			"Always call plt.tight_layout() before plt.show().",
		inputSchema: z.object({
			code: z
				.string()
				.describe(
					"Python code to execute. Use print() for output. " +
						"Use matplotlib plt.show() for charts. " +
						"If dataContext was provided, read it with: " +
						'import json; data = json.load(open("/tmp/data.json"))',
				),
			dataContext: z
				.string()
				.optional()
				.describe(
					"Optional JSON string of data to make available in the sandbox as /tmp/data.json. " +
						"Use this to pass trading data, query results, or other data for analysis.",
				),
		}),
		execute: async ({ code, dataContext }) => {
			return executeRunPython(code, dataContext);
		},
	});
}

function createStoreReportDataTool(context: ToolContext) {
	return tool({
		description:
			"Register a dataset with a unique reference ID so that MDX components in the report can access it at render time via their dataRef prop. " +
			"Call this BEFORE referencing a dataRef in any MDX component. " +
			"Each refId must be unique within the report. " +
			"The data can be any shape — arrays for charts/tables, objects for single values.",
		inputSchema: z.object({
			refId: z
				.string()
				.describe(
					"A unique reference ID for this dataset (e.g. 'equity-data', 'monthly-pnl', 'symbol-breakdown'). " +
						"Used as the dataRef prop on MDX components.",
				),
			description: z
				.string()
				.describe(
					"A short description of what this data contains (for debugging and documentation).",
				),
			data: z
				.unknown()
				.describe(
					"The actual data to store. Can be an array of objects (for charts/tables) or a single object (for display components).",
				),
		}),
		execute: async ({ refId, description, data }) => {
			if (!context.dataStore) {
				return {
					success: false,
					error:
						"Data store not available. store_report_data is only available in report mode.",
				};
			}
			return executeStoreReportData(
				refId,
				description,
				data,
				context.dataStore,
			);
		},
	});
}

// =============================================================================
// TOOL SET FACTORIES
// =============================================================================

/**
 * Get Vercel AI SDK tools for chat mode (no store_report_data).
 */
export function getChatTools(context: ToolContext) {
	return {
		run_query: createRunQueryTool(context),
		call_analytics: createCallAnalyticsTool(context),
		get_market_data: createGetMarketDataTool(),
		run_python: createRunPythonTool(),
	};
}

/**
 * Get Vercel AI SDK tools for report mode (includes store_report_data).
 */
export function getReportTools(context: ToolContext) {
	return {
		...getChatTools(context),
		store_report_data: createStoreReportDataTool(context),
	};
}
