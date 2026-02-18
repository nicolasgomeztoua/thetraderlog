import type { LanguageModel } from "ai";
import { aiGenerateText } from "@/lib/ai/client";

// =============================================================================
// TYPES
// =============================================================================

interface PlannerOptions {
	prompt: string;
	userContext: string;
	model: LanguageModel;
	templateHint?: string;
}

interface PlannerResult {
	plan: string;
	tokensUsed: number;
}

// =============================================================================
// PLANNER SYSTEM PROMPT
// =============================================================================

const PLANNER_PERSONA = `You are an expert trading report planner for EdgeJournal. Your role is to analyze a trader's report request and produce a structured analysis plan that subsequent phases will follow.

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
- **get_market_data** — Fetch OHLC candle data for symbols (ES, NQ, EUR/USD, etc.). Use proactively for any analysis involving entry/exit quality, market context, or price structure — not just when explicitly requested. Cross-reference with run_query results for insights like "where in the daily range did I enter?" or "did I trade with or against the trend?"
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

Given the trader's report request and their context, produce a structured analysis plan in markdown format.

Your plan MUST include these sections:

### 1. Request Analysis
- What is the trader asking for?
- What time period is relevant?
- What depth of analysis is expected?

### 2. Data Sources Needed
- List each analytics endpoint or SQL query to call, with a brief reason why
- Order them by priority (most important first)
- Estimate total tool calls needed (aim for efficiency — batch related calls)

### 3. Report Sections
For each section of the final report, specify:
- **Section title** (e.g., "## Performance Overview")
- **Data sources** — which endpoints/queries feed this section
- **MDX components** — which components to use and what data they need
- **Narrative focus** — what insights to highlight in the prose

### 4. MDX Component Plan
- List each MDX component to include with its planned dataRef key
- Note any MetricGrid groups and their MetricCards
- Note any Callout types to include (tip, warning, etc.)

### 5. Estimated Complexity
- Total tool calls estimate (aim for 8–15 for standard reports, 15–20 for comprehensive)
- Number of report sections
- Number of MDX components

Be specific and actionable. The data gatherer will execute your plan step by step.`;

function buildPlannerSystemPrompt(
	userContext: string,
	templateHint?: string,
): string {
	const sections = [
		PLANNER_PERSONA,
		userContext,
		AVAILABLE_ANALYTICS_ENDPOINTS,
		AVAILABLE_MDX_COMPONENTS,
		PLANNER_INSTRUCTIONS,
	];

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
		options.templateHint,
	);

	const result = await aiGenerateText({
		model: options.model,
		system: systemPrompt,
		messages: [{ role: "user", content: options.prompt }],
	});

	return {
		plan: result.text,
		tokensUsed: result.totalTokens,
	};
}
