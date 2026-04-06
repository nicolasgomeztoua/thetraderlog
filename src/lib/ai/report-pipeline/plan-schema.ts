import { z } from "zod";

// =============================================================================
// GATHERING STEP SCHEMAS — discriminated union on "tool"
// =============================================================================

const callAnalyticsStepSchema = z.object({
	tool: z.literal("call_analytics"),
	refId: z
		.string()
		.describe(
			"Unique dataRef key for this dataset (e.g. 'equity-data', 'monthly-pnl')",
		),
	description: z
		.string()
		.describe("Brief description of what this data is for"),
	router: z.enum(["analytics", "trades", "accounts"]),
	endpoint: z.string().describe("The endpoint name, e.g. 'getOverview'"),
	input: z
		.record(z.string(), z.unknown())
		.optional()
		.describe("Input parameters for the endpoint"),
});

const runQueryStepSchema = z.object({
	tool: z.literal("run_query"),
	refId: z.string().describe("Unique dataRef key for this dataset"),
	description: z
		.string()
		.describe("Brief description of what this data is for"),
	query: z
		.string()
		.describe(
			"A valid SELECT SQL query using user-scoped CTE aliases (user_trades, user_accounts, etc.)",
		),
});

const getMarketDataStepSchema = z.object({
	tool: z.literal("get_market_data"),
	refId: z.string().describe("Unique dataRef key for this dataset"),
	description: z
		.string()
		.describe("Brief description of what this data is for"),
	symbol: z.string().describe("Futures symbol (e.g., ES, NQ, MNQ, MES)"),
	interval: z.enum(["1min", "5min", "15min", "30min", "1h", "4h"]),
	startDate: z
		.string()
		.describe("ISO 8601 start date (e.g., 2026-01-15T09:30:00Z)"),
	endDate: z
		.string()
		.describe("ISO 8601 end date (e.g., 2026-01-15T16:00:00Z)"),
});

const runPythonStepSchema = z.object({
	tool: z.literal("run_python"),
	refId: z.string().describe("Unique dataRef key for this dataset"),
	description: z
		.string()
		.describe("Brief description of what this data is for"),
	code: z.string().describe("Python code to execute"),
	dataContext: z
		.string()
		.optional()
		.describe("Optional JSON string available as /tmp/data.json"),
});

// =============================================================================
// GATHERING STEP — discriminated union
// =============================================================================

export const gatheringStepSchema = z.discriminatedUnion("tool", [
	callAnalyticsStepSchema,
	runQueryStepSchema,
	getMarketDataStepSchema,
	runPythonStepSchema,
]);

export type GatheringStep = z.infer<typeof gatheringStepSchema>;

// =============================================================================
// REPORT SECTION — maps data to presentation
// =============================================================================

const reportSectionSchema = z.object({
	title: z.string().describe("Section heading, e.g. 'Performance Overview'"),
	dataRefs: z
		.array(z.string())
		.describe("Which refIds from the steps this section will use"),
	components: z
		.array(z.string())
		.describe("MDX component names to use, e.g. 'EquityCurve', 'MetricGrid'"),
	narrativeFocus: z.string().describe("What insight to highlight in prose"),
});

// =============================================================================
// STRUCTURED PLAN — top-level schema
// =============================================================================

export const structuredPlanSchema = z.object({
	title: z.string().describe("Suggested report title (2-6 words)"),
	summary: z
		.string()
		.describe("1-2 sentence summary of what this report will cover"),
	steps: z
		.array(gatheringStepSchema)
		.min(1)
		.max(30)
		.describe(
			"Ordered list of data-gathering steps. Each step specifies one tool call and a refId for storing the result.",
		),
	sections: z
		.array(reportSectionSchema)
		.describe("Planned report sections, mapping data to presentation"),
});

export type StructuredPlan = z.infer<typeof structuredPlanSchema>;
