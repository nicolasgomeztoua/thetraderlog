// =============================================================================
// REPORT TEMPLATES
//
// Pre-defined report structures that guide the planner phase. Templates are
// data-only — they never make LLM calls. They augment the planner prompt with
// a structured plannerHint so reports follow a consistent format.
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

interface TemplateSection {
	title: string;
	description: string;
	suggestedDataSources: string[];
	suggestedComponents: string[];
}

export interface ReportTemplate {
	id: string;
	name: string;
	description: string;
	sections: TemplateSection[];
	plannerHint: string;
}

// =============================================================================
// TEMPLATES
// =============================================================================

const MONTHLY_REVIEW: ReportTemplate = {
	id: "monthly-review",
	name: "Monthly Review",
	description:
		"Comprehensive monthly performance review with equity analysis, win rate trends, symbol breakdown, and behavioral insights.",
	sections: [
		{
			title: "Performance Overview",
			description:
				"Key metrics summary: total P&L, win rate, profit factor, expectancy, trade count for the month.",
			suggestedDataSources: ["getOverview", "getEquityCurve"],
			suggestedComponents: ["MetricGrid", "MetricCard", "EquityCurve"],
		},
		{
			title: "Monthly P&L Trend",
			description:
				"Monthly P&L bar chart showing the current month in context of recent months.",
			suggestedDataSources: ["getPerformanceByMonth"],
			suggestedComponents: ["MonthlyChart"],
		},
		{
			title: "Win Rate & Expectancy Trends",
			description:
				"How win rate and expectancy have evolved over the month compared to prior months.",
			suggestedDataSources: ["getPerformanceByMonth", "getOverview"],
			suggestedComponents: ["MetricGrid", "MetricCard", "Callout"],
		},
		{
			title: "Symbol Breakdown",
			description:
				"Per-symbol performance: which instruments contributed most to P&L and which underperformed.",
			suggestedDataSources: ["getPerformanceBySymbol"],
			suggestedComponents: [
				"SymbolDistributionChart",
				"SymbolTable",
				"Callout",
			],
		},
		{
			title: "Behavioral Patterns",
			description:
				"Overtrading, revenge trading, and discipline metrics for the month.",
			suggestedDataSources: [
				"getBehavioralPatterns",
				"getRevengeTrading",
				"getOvertradingAnalysis",
			],
			suggestedComponents: ["MetricGrid", "MetricCard", "Callout"],
		},
		{
			title: "Recommendations",
			description:
				"Actionable takeaways based on the month's data: what to keep doing, what to improve, what to stop.",
			suggestedDataSources: [],
			suggestedComponents: ["Callout"],
		},
	],
	plannerHint: `This is a Monthly Review report. Follow this structure:

1. **Performance Overview** — Start with key metrics (P&L, win rate, profit factor, expectancy, trade count) in a MetricGrid, followed by an EquityCurve chart. Lead with a narrative summary of the month.
2. **Monthly P&L Trend** — Show MonthlyChart to contextualize this month vs prior months. Highlight if the month is above/below average.
3. **Win Rate & Expectancy Trends** — Compare this month's win rate and expectancy to the trailing 3-month average. Use MetricCards for comparison and Callouts for notable changes.
4. **Symbol Breakdown** — SymbolDistributionChart and SymbolTable showing per-symbol performance. Identify the best and worst performers with specific numbers.
5. **Behavioral Patterns** — Analyze overtrading, revenge trading, and tilt scores. Use MetricCards for scores and Callouts for actionable warnings.
6. **Recommendations** — 3-5 specific, actionable recommendations based on the data. Use Callouts (tip for positive, warning for areas to improve).

Data sources to call: getOverview, getEquityCurve, getPerformanceByMonth, getPerformanceBySymbol, getBehavioralPatterns, getRevengeTrading, getOvertradingAnalysis.`,
};

const RISK_AUDIT: ReportTemplate = {
	id: "risk-audit",
	name: "Risk Audit",
	description:
		"Deep dive into risk management: drawdowns, position sizing, R-multiples, Monte Carlo projections, and risk-adjusted returns.",
	sections: [
		{
			title: "Risk Overview",
			description:
				"Key risk metrics: max drawdown, Sharpe ratio, Sortino ratio, Kelly %, risk of ruin.",
			suggestedDataSources: ["getRiskMetrics"],
			suggestedComponents: ["MetricGrid", "MetricCard"],
		},
		{
			title: "Drawdown Analysis",
			description:
				"Historical drawdown periods: depth, duration, and recovery patterns.",
			suggestedDataSources: ["getDrawdownHistory", "getEquityCurve"],
			suggestedComponents: ["DrawdownTable", "EquityCurve", "Callout"],
		},
		{
			title: "Position Sizing",
			description:
				"Position size distribution and correlation with P&L outcomes.",
			suggestedDataSources: [
				"getPositionSizeAnalysis",
				"getRiskRewardAnalysis",
			],
			suggestedComponents: ["MetricGrid", "MetricCard", "DataTable"],
		},
		{
			title: "R-Multiple Distribution",
			description:
				"Distribution of trade outcomes in R-multiples: avg win R, avg loss R, expectancy in R.",
			suggestedDataSources: ["getRMultipleDistribution"],
			suggestedComponents: ["RMultipleChart", "MetricGrid", "MetricCard"],
		},
		{
			title: "Monte Carlo Projection",
			description:
				"Forward-looking simulation: probability of profit, expected drawdowns, confidence intervals.",
			suggestedDataSources: ["getMonteCarloSimulation"],
			suggestedComponents: ["MonteCarloChart", "MetricGrid", "MetricCard"],
		},
		{
			title: "Risk Recommendations",
			description:
				"Actionable risk management improvements based on the analysis.",
			suggestedDataSources: [],
			suggestedComponents: ["Callout"],
		},
	],
	plannerHint: `This is a Risk Audit report. Follow this structure:

1. **Risk Overview** — MetricGrid with key risk metrics: max drawdown, current drawdown, Sharpe ratio, Sortino ratio, Kelly %, risk of ruin. Narrative should contextualize whether risk levels are healthy.
2. **Drawdown Analysis** — DrawdownTable showing all significant drawdown periods. EquityCurve with drawdown overlay. Highlight the worst drawdown with specific dates and recovery time. Use Callouts to flag concerning patterns.
3. **Position Sizing** — Analyze position size consistency. Are larger positions winning or losing? DataTable for size vs outcome breakdown. MetricCards for avg position size, max position size, size-adjusted win rate.
4. **R-Multiple Distribution** — RMultipleChart histogram. MetricCards for avg win R, avg loss R, expectancy in R. Callout if expectancy is negative or if large outlier losses exist.
5. **Monte Carlo Projection** — MonteCarloChart showing percentile bands. MetricCards for probability of profit, expected P&L at p50, worst-case drawdown at p5. Callout for risk of ruin assessment.
6. **Risk Recommendations** — 3-5 specific recommendations for risk management improvement. Use Callouts (tip for strengths, warning for weaknesses, important for critical issues).

Data sources to call: getRiskMetrics, getDrawdownHistory, getEquityCurve, getPositionSizeAnalysis, getRiskRewardAnalysis, getRMultipleDistribution, getMonteCarloSimulation.`,
};

const STRATEGY_COMPARISON: ReportTemplate = {
	id: "strategy-comparison",
	name: "Strategy Comparison",
	description:
		"Side-by-side comparison of trading strategies: win rate, expectancy, profit factor, and per-strategy recommendations.",
	sections: [
		{
			title: "Strategy Overview",
			description:
				"Summary of all strategies with trade count, win rate, and total P&L per strategy.",
			suggestedDataSources: ["run_query", "getOverview"],
			suggestedComponents: ["MetricGrid", "MetricCard", "DataTable"],
		},
		{
			title: "Win Rate & Expectancy Comparison",
			description:
				"Side-by-side comparison of win rate and expectancy across strategies.",
			suggestedDataSources: ["run_query"],
			suggestedComponents: ["DataTable", "Callout"],
		},
		{
			title: "Profit Factor & Risk-Adjusted Returns",
			description:
				"Profit factor, Sharpe ratio equivalents, and risk-adjusted metrics per strategy.",
			suggestedDataSources: ["run_query"],
			suggestedComponents: ["DataTable", "MetricGrid", "MetricCard"],
		},
		{
			title: "Per-Strategy Deep Dive",
			description:
				"Detailed breakdown of each strategy: best/worst trades, holding time patterns, time-of-day performance.",
			suggestedDataSources: ["run_query", "getHoldingTimeAnalysis"],
			suggestedComponents: ["DataTable", "Callout"],
		},
		{
			title: "Strategy Recommendations",
			description:
				"Which strategies to continue, scale up, reduce, or stop trading based on the data.",
			suggestedDataSources: [],
			suggestedComponents: ["Callout"],
		},
	],
	plannerHint: `This is a Strategy Comparison report. Follow this structure:

1. **Strategy Overview** — DataTable with all strategies side by side: name, trade count, win rate, total P&L, avg P&L per trade. MetricCards for total strategies, most traded strategy, most profitable strategy.
2. **Win Rate & Expectancy Comparison** — DataTable comparing win rate and expectancy per strategy. Highlight the strategy with highest expectancy. Use Callouts for strategies with high win rate but low expectancy (or vice versa).
3. **Profit Factor & Risk-Adjusted Returns** — DataTable with profit factor, avg win, avg loss per strategy. MetricCards for best and worst profit factors. Callout if any strategy has profit factor below 1.0.
4. **Per-Strategy Deep Dive** — For each strategy: best trade, worst trade, avg holding time, best time of day. Use DataTables for per-strategy detail. Callouts for notable patterns.
5. **Strategy Recommendations** — Categorize strategies into: scale up (strong edge), maintain (consistent), review (marginal), stop (negative expectancy). Use Callouts: tip for scale up, note for maintain, warning for review, important for stop.

Data sources: Use run_query with SQL to aggregate strategy-level statistics from user_trades joined with strategies table. Also call getHoldingTimeAnalysis for duration data. Strategy data requires SQL because the analytics router doesn't have per-strategy endpoints.`,
};

// =============================================================================
// TEMPLATE REGISTRY
// =============================================================================

const TEMPLATES: ReportTemplate[] = [
	MONTHLY_REVIEW,
	RISK_AUDIT,
	STRATEGY_COMPARISON,
];

const TEMPLATE_MAP = new Map<string, ReportTemplate>(
	TEMPLATES.map((t) => [t.id, t]),
);

// =============================================================================
// PUBLIC API
// =============================================================================

export function getTemplate(id: string): ReportTemplate | undefined {
	return TEMPLATE_MAP.get(id);
}

export function getAllTemplates(): ReportTemplate[] {
	return TEMPLATES;
}
