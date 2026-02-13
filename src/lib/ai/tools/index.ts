import type { ToolDefinition } from "@/lib/ai/client";
import type { db as DbInstance } from "@/server/db";
import {
	callAnalyticsToolDefinition,
	executeCallAnalytics,
} from "./call-analytics";
import {
	executeGetMarketData,
	getMarketDataToolDefinition,
} from "./get-market-data";
import { executeRunPython, runPythonToolDefinition } from "./run-python";
import { executeRunQuery, runQueryToolDefinition } from "./run-query";
import {
	executeStoreReportData,
	storeReportDataToolDefinition,
} from "./store-report-data";

type Db = typeof DbInstance;

// =============================================================================
// TOOL REGISTRY
// =============================================================================

/**
 * Base AI tool definitions available in all modes (chat + report).
 */
export const AI_TOOLS: ToolDefinition[] = [
	runQueryToolDefinition,
	callAnalyticsToolDefinition,
	getMarketDataToolDefinition,
	runPythonToolDefinition,
];

/**
 * Report-only tools (store_report_data for MDX component data).
 */
export const AI_REPORT_TOOLS: ToolDefinition[] = [
	...AI_TOOLS,
	storeReportDataToolDefinition,
];

/**
 * Get the appropriate tools array based on mode.
 */
export function getToolsForMode(mode: "chat" | "report"): ToolDefinition[] {
	return mode === "report" ? AI_REPORT_TOOLS : AI_TOOLS;
}

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

interface ToolContext {
	userId: string;
	db?: Db;
	dataStore?: Map<string, unknown>;
}

/**
 * Dispatches a tool call to the correct executor.
 * Returns a standardized result object.
 */
export async function executeTool(
	toolName: string,
	args: Record<string, unknown>,
	context: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	switch (toolName) {
		case "run_query": {
			if (!context.db) {
				return {
					success: false,
					error: "Database instance required for run_query tool",
				};
			}
			const query = args.query as string;
			if (!query) {
				return { success: false, error: "Missing required parameter: query" };
			}
			return executeRunQuery(context.userId, query, context.db);
		}

		case "call_analytics": {
			const router = args.router as string;
			const endpoint = args.endpoint as string;
			if (!router || !endpoint) {
				return {
					success: false,
					error: "Missing required parameters: router, endpoint",
				};
			}
			const input = (args.input as Record<string, unknown>) ?? undefined;
			return executeCallAnalytics(
				context.userId,
				router,
				endpoint,
				input,
				context.db,
			);
		}

		case "get_market_data": {
			const symbol = args.symbol as string;
			const interval = args.interval as string;
			const startDate = args.startDate as string;
			const endDate = args.endDate as string;
			if (!symbol || !interval || !startDate || !endDate) {
				return {
					success: false,
					error:
						"Missing required parameters: symbol, interval, startDate, endDate",
				};
			}
			return executeGetMarketData(symbol, interval, startDate, endDate);
		}

		case "run_python": {
			const code = args.code as string;
			if (!code) {
				return { success: false, error: "Missing required parameter: code" };
			}
			const dataContext = args.dataContext as string | undefined;
			return executeRunPython(code, dataContext);
		}

		case "store_report_data": {
			if (!context.dataStore) {
				return {
					success: false,
					error:
						"Data store not available. store_report_data is only available in report mode.",
				};
			}
			const refId = args.refId as string;
			const description = args.description as string;
			const data = args.data;
			if (!refId || !description || data === undefined) {
				return {
					success: false,
					error: "Missing required parameters: refId, description, data",
				};
			}
			return executeStoreReportData(
				refId,
				description,
				data,
				context.dataStore,
			);
		}

		default:
			return {
				success: false,
				error: `Unknown tool "${toolName}". Available tools: run_query, call_analytics, get_market_data, run_python, store_report_data`,
			};
	}
}
