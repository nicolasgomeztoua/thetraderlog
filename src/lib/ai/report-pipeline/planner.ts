import type { LanguageModel } from "ai";
import { aiGenerateObject } from "@/lib/ai/client";
import { REPORT_REASONING_TOKENS } from "@/lib/constants/ai";
import { type StructuredPlan, structuredPlanSchema } from "./plan-schema";

// =============================================================================
// TYPES
// =============================================================================

interface PlannerOptions {
	prompt: string;
	userContext: string;
	schemaContext: string;
	model: LanguageModel;
	templateHint?: string;
	accountId?: string;
}

interface PlannerResult {
	plan: StructuredPlan;
	planText: string;
	tokensUsed: number;
}

// =============================================================================
// PLANNER SYSTEM PROMPT
// =============================================================================

const PLANNER_PERSONA = `You are an expert trading report planner for TheTraderLog. Your role is to analyze a trader's report request and produce a structured analysis plan that subsequent phases will follow.

You do NOT have access to tools. You only plan — you never execute queries, fetch data, or write report prose.`;

const AVAILABLE_ANALYTICS_ENDPOINTS = `## Available Analytics Endpoints

These endpoints provide pre-computed trading statistics. The data gatherer phase will call them.

### analytics router
- **getOverview** — Overall trading stats: win rate, P&L, profit factor, expectancy, trade count
- **getCalendarData** — Daily P&L aggregated into a calendar view
- **getPerformanceByDayOfWeek** — Win rate, P&L, trade count broken down by Mon–Sun
- **getPerformanceByHour** — Win rate, P&L, trade count broken down by hour (0–23)
- **getPerformanceBySession** — Win rate, P&L, trade count by trading session (US Open, London, etc.)
- **getPerformanceByMonth** — Monthly P&L, win rate, trade count
- **getRiskMetrics** — Max drawdown, Kelly %, risk of ruin, Sharpe ratio, Sortino
- **getEquityCurve** — Cumulative equity curve with drawdown overlay data
- **getDrawdownHistory** — List of drawdown periods with depth, duration, recovery
- **getRMultipleDistribution** — R-multiple histogram buckets and stats
- **getRiskRewardAnalysis** — Risk/reward ratios, average win vs loss sizing
- **getPositionSizeAnalysis** — Position size distribution and P&L correlation
- **getPerformanceBySymbol** — Per-symbol P&L, win rate, profit factor
- **getSymbolTrend** — Symbol performance trends over time
- **getStreakAnalysis** — Win/loss streak patterns
- **getRevengeTrading** — Revenge trading detection and frequency
- **getOvertradingAnalysis** — Overtrading patterns by volume and frequency
- **getHoldingTimeAnalysis** — Trade duration vs P&L analysis
- **getBehavioralPatterns** — Tilt score, discipline metrics, overtrading score
- **getMonteCarloSimulation** — Forward projection via Monte Carlo (percentiles, probability of profit)
- **getFilteredTradeCount** — Count of trades matching filters
- **exportFilteredTrades** — Export trades matching filters

### trades router
- **getStats** — Quick trade stats (count, P&L, win rate) with optional date range
- **getAll** — List of trades with filtering, sorting, pagination

### accounts router
- **getPropCompliance** — Prop firm challenge/funded account compliance metrics: drawdown status (current vs limit, trailing/static), daily loss tracking, profit target progress, consistency rule compliance, trading days count, timeline with days remaining, equity curve, overall status (safe/caution/danger), and trade stats. Requires { accountId }. Only works for prop_challenge or prop_funded accounts.

### Deep Analysis Tools
- **run_query** — Execute read-only SQL against user-scoped tables. Use for trade-level detail, custom aggregations, cross-referencing, and any analysis not covered by analytics endpoints. Examples: entry timing relative to session open, trade clustering patterns, P&L by holding time buckets, consecutive loss behavior.
- **get_market_data** — Fetch OHLC candle data for futures symbols (ES, NQ, MES, MNQ, CL, GC, etc.). Use proactively for any analysis involving entry/exit quality, market context, or price structure — not just when explicitly requested. Cross-reference with run_query results for insights like "where in the daily range did I enter?" or "did I trade with or against the trend?"
- **run_python** — Execute Python code for statistical analysis, regressions, distribution fitting, and custom charts that don't map to MDX components.

**Important**: Not every report section needs analytics endpoints. Custom queries and market data yield insights the dashboard cannot — plan for them when the report topic involves price context, trade quality, or cross-referenced analysis.`;

const AVAILABLE_MDX_COMPONENTS = `## Available MDX Components

The writer phase can use these components in the report. Plan which ones to include.

### Chart Components (require dataRef)
- **EquityCurve** — Cumulative equity curve with drawdown overlay
- **MonthlyChart** — Monthly P&L bar chart with win rate overlay
- **SymbolDistributionChart** — Donut chart: P&L or count by symbol
- **DayOfWeekChart** — Bar chart: performance by day of week
- **HourHeatmap** — 24-hour heatmap grid: performance by hour
- **SessionChart** — Card grid: performance by trading session
- **RMultipleChart** — R-multiple distribution histogram
- **MonteCarloChart** — Monte Carlo simulation with percentile bands

### Display Components (require dataRef)
- **CalendarHeatmap** — GitHub-style daily P&L heatmap
- **DrawdownTable** — Sortable drawdown periods table
- **SymbolTable** — Sortable performance-by-symbol table
- **DataTable** — Generic auto-formatted data table

### Inline Components (no dataRef)
- **MetricCard** — Single metric display with tooltip (title, value, tooltip)
- **MetricGrid** — Responsive grid wrapper for MetricCard components
- **Callout** — Styled callout box (types: tip, warning, note, important)
- **ChartImage** — Display a Python-generated chart image`;

const PLANNER_INSTRUCTIONS = `## Your Task

Given the trader's report request and their context, produce a structured analysis plan.

Your plan consists of **gathering steps** (tool calls) and **report sections** (presentation structure).

### Gathering Steps

Each step is a single tool call that will be executed automatically. You specify:
- **refId** — A unique key (e.g., "equity-data", "monthly-pnl") that the writer will use as a dataRef in MDX components
- **tool** — Which tool to call
- **Parameters** — Tool-specific parameters

Available tools:
1. **call_analytics** — Call a pre-computed analytics endpoint. Specify router, endpoint, and optional input parameters.
2. **run_query** — Execute a read-only SQL query. You MUST provide the complete, valid SQL using user-scoped CTE aliases (user_trades, user_accounts, user_tags, user_strategies, user_journals, user_executions, user_trade_tags). P&L columns are decimal strings — use CAST(column AS NUMERIC) for aggregation. Soft-deleted trades and inactive accounts are auto-excluded.
3. **get_market_data** — Fetch OHLC candle data. Specify symbol, interval, startDate, endDate in ISO 8601.
4. **run_python** — Execute Python code for statistical analysis. Use sparingly — only when SQL and analytics endpoints cannot achieve the analysis.

### Report Sections

For each planned section of the report, specify:
- **title** — Section heading
- **dataRefs** — Which refIds from the steps this section will use
- **components** — MDX component names to include
- **narrativeFocus** — What insight the writer should highlight

### Guidelines
- Aim for 8-15 steps for standard reports, 15-20 for comprehensive ones
- Order steps by priority (most important first)
- Use call_analytics for standard metrics; use run_query for custom analysis
- Every refId must be unique across all steps
- Match refIds to their intended MDX component (e.g., "equity-data" for EquityCurve, "monthly-data" for MonthlyChart)
- Consider data sufficiency: MonteCarloChart needs 20+ trades, RMultipleChart needs stop-loss data, charts need 5+ data points`;

function buildPlannerSystemPrompt(
	userContext: string,
	schemaContext: string,
	templateHint?: string,
	accountId?: string,
): string {
	const sections = [
		PLANNER_PERSONA,
		userContext,
		schemaContext,
		AVAILABLE_ANALYTICS_ENDPOINTS,
		AVAILABLE_MDX_COMPONENTS,
		PLANNER_INSTRUCTIONS,
	];

	if (accountId) {
		sections.push(
			`## Account Scope\n\nAnalysis is scoped to account: ${accountId}. Include accountId in call_analytics input parameters and use it in SQL WHERE clauses.`,
		);
	}

	if (templateHint) {
		sections.push(`## Template Guidance\n\n${templateHint}`);
	}

	return sections.join("\n\n");
}

// =============================================================================
// PLANNER PHASE
// =============================================================================

export async function runPlannerPhase(
	options: PlannerOptions,
): Promise<PlannerResult> {
	const systemPrompt = buildPlannerSystemPrompt(
		options.userContext,
		options.schemaContext,
		options.templateHint,
		options.accountId,
	);

	const result = await aiGenerateObject({
		model: options.model,
		system: systemPrompt,
		messages: [{ role: "user", content: options.prompt }],
		schema: structuredPlanSchema,
		schemaName: "ReportPlan",
		schemaDescription:
			"A structured plan for gathering data and writing a trading performance report",
		reasoning: { maxTokens: REPORT_REASONING_TOKENS },
	});

	return {
		plan: result.object,
		planText: JSON.stringify(result.object, null, 2),
		tokensUsed: result.totalTokens,
	};
}

/**
 * Creates a safe minimum plan when the planner fails.
 * Guarantees at least basic overview data for the report.
 */
export function createFallbackPlan(accountId?: string): StructuredPlan {
	const input = accountId ? { accountId } : undefined;

	return {
		title: "Trading Performance Overview",
		summary:
			"A general overview of trading performance including key metrics, equity curve, and monthly breakdown.",
		steps: [
			{
				tool: "call_analytics" as const,
				refId: "overview-metrics",
				description: "Overall trading statistics",
				router: "analytics" as const,
				endpoint: "getOverview",
				input,
			},
			{
				tool: "call_analytics" as const,
				refId: "equity-data",
				description: "Cumulative equity curve with drawdown",
				router: "analytics" as const,
				endpoint: "getEquityCurve",
				input,
			},
			{
				tool: "call_analytics" as const,
				refId: "monthly-data",
				description: "Monthly P&L breakdown",
				router: "analytics" as const,
				endpoint: "getPerformanceByMonth",
				input,
			},
			{
				tool: "call_analytics" as const,
				refId: "risk-metrics",
				description: "Risk metrics and drawdown analysis",
				router: "analytics" as const,
				endpoint: "getRiskMetrics",
				input,
			},
		],
		sections: [
			{
				title: "Performance Overview",
				dataRefs: ["overview-metrics", "equity-data"],
				components: ["MetricGrid", "EquityCurve"],
				narrativeFocus: "Key performance metrics and equity trajectory",
			},
			{
				title: "Monthly Breakdown",
				dataRefs: ["monthly-data"],
				components: ["MonthlyChart"],
				narrativeFocus: "Monthly performance trends and consistency",
			},
			{
				title: "Risk Analysis",
				dataRefs: ["risk-metrics"],
				components: ["MetricGrid"],
				narrativeFocus: "Risk metrics and capital preservation",
			},
		],
	};
}
