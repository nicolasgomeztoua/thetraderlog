// =============================================================================
// WRITER CONTEXT BUILDER
//
// Builds a condensed context for the writer phase that includes ONLY what the
// writer needs: the analysis plan, data summaries from the dataStore, MDX
// component catalog, and formatting rules.
//
// Excludes: database schema, SQL syntax, tRPC endpoint docs, tool descriptions
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

interface BuildWriterContextOptions {
	dataStore: Map<string, unknown>;
	plan: string;
}

// =============================================================================
// CONSTANTS — Writer-specific context sections
// =============================================================================

const FORMATTING_RULES = `## Formatting Rules (STRICT)

- **NO LaTeX**: Never use $, $$, \\frac{}{}, \\text{}, or any LaTeX math notation
- Write currency as plain text: $1,234.56 — NOT wrapped in dollar-sign delimiters
- Write fractions as plain text: (A / B) — NOT \\frac{A}{B}
- Write multiplication as x — NOT \\times
- **Tables**: Always use pipe-delimited markdown tables, NEVER code-block ASCII art
- Do not place standalone special characters ($, \\, etc.) on their own line
- **MDX components** are written as JSX tags inline with markdown — no code fences needed
- Always reference data using the exact dataRef keys provided in the Data Summary section`;

const MDX_CATALOG = `## MDX Component Catalog

Use these components inline with markdown. Components with \`dataRef\` reference datasets from the Data Summary section.

### Chart Components (require dataRef)

#### EquityCurve
Cumulative equity curve with drawdown overlay.
\`\`\`mdx
<EquityCurve dataRef="equity-data" />
\`\`\`
Data shape: array of { date, equity, peak, drawdown, drawdownPercent, pnl, tradeIndex, tradeId, symbol }

#### MonthlyChart
Monthly P&L bar chart with win rate overlay.
\`\`\`mdx
<MonthlyChart dataRef="monthly-data" />
\`\`\`
Data shape: array of { month (YYYY-MM), pnl, trades, wins, losses, winRate (0-100), avgPnl }

#### SymbolDistributionChart
Donut chart: P&L or trade count by symbol.
\`\`\`mdx
<SymbolDistributionChart dataRef="symbol-dist-data" />
\`\`\`
Data shape: array of { symbol, pnl, trades, wins, losses, winRate, profitFactor, avgTrade }

#### DayOfWeekChart
Bar chart: performance by day of week.
\`\`\`mdx
<DayOfWeekChart dataRef="dow-data" />
\`\`\`
Data shape: array of 7 { day, pnl, trades, wins, losses, winRate, avgPnl }

#### HourHeatmap
24-hour heatmap grid: performance by hour.
\`\`\`mdx
<HourHeatmap dataRef="hour-data" />
\`\`\`
Data shape: array of 24 { hour (0-23), pnl, trades, wins, losses, winRate, avgPnl }

#### SessionChart
Card grid: performance by trading session.
\`\`\`mdx
<SessionChart dataRef="session-data" />
\`\`\`
Data shape: array of { session, pnl, trades, wins, losses, winRate, avgPnl }

#### RMultipleChart
R-multiple distribution histogram.
\`\`\`mdx
<RMultipleChart dataRef="r-multiple-data" />
\`\`\`
Data shape: { buckets: [{ label, count, totalPnl, avgR }], stats: { totalTrades, tradesWithR, avgRMultiple, avgWinR, avgLossR, maxR, minR } }

#### MonteCarloChart
Monte Carlo simulation with percentile bands.
\`\`\`mdx
<MonteCarloChart dataRef="monte-carlo-data" />
\`\`\`
Data shape: { hasEnoughData, iterations, percentiles: { p5, p25, p50, p75, p95 }, probabilityOfProfit, expectedValue, standardDeviation, actualOutcome, worstDrawdown, bestPeak }

### Display Components (require dataRef)

#### CalendarHeatmap
GitHub-style daily P&L heatmap.
\`\`\`mdx
<CalendarHeatmap dataRef="calendar-data" />
\`\`\`
Data shape: array of { date (YYYY-MM-DD), pnl, trades, wins, losses }

#### DrawdownTable
Sortable drawdown periods table.
\`\`\`mdx
<DrawdownTable dataRef="drawdown-data" />
\`\`\`
Data shape: array of { startDate, troughDate, recoveryDate, peakEquity, troughEquity, drawdownAmount, drawdownPercent, tradesInDrawdown, daysToTrough, daysToRecover, totalDays }

#### SymbolTable
Sortable performance-by-symbol table.
\`\`\`mdx
<SymbolTable dataRef="symbol-table-data" />
\`\`\`
Data shape: array of { symbol, pnl, trades, wins, losses, winRate, profitFactor, avgTrade, avgWin, avgLoss }

#### DataTable
Generic auto-formatted data table. Numeric columns right-aligned, P&L color-coded.
\`\`\`mdx
<DataTable dataRef="weekly-breakdown" />
\`\`\`
Data shape: array of objects (column headers from keys)

### Inline Components (no dataRef)

#### MetricCard
Single metric display with tooltip.
\`\`\`mdx
<MetricCard title="Win Rate" value="58.3%" tooltip={{ what: "Percentage of profitable trades", why: "Core accuracy measure", benchmark: "Above 50% is good" }} />
\`\`\`
Props: title (string), value (string|number), description (optional), tooltip ({ what, why, benchmark }), colorClass (optional: "text-profit" or "text-loss")

#### MetricGrid
Responsive grid wrapper for MetricCard components.
\`\`\`mdx
<MetricGrid>
  <MetricCard title="Win Rate" value="58.3%" tooltip={{ what: "...", why: "...", benchmark: "..." }} />
  <MetricCard title="Profit Factor" value="2.1" tooltip={{ what: "...", why: "...", benchmark: "..." }} />
</MetricGrid>
\`\`\`

#### Callout
Styled callout box. Types: tip (green), warning (yellow), note (muted), important (red).
\`\`\`mdx
<Callout type="tip">Your best day is Tuesday — consider increasing size.</Callout>
\`\`\`

#### ChartImage
Display a Python-generated chart image.
\`\`\`mdx
<ChartImage src="chart-url" alt="Description" caption="Optional caption" />
\`\`\``;

// =============================================================================
// DATA SUMMARY BUILDER
// =============================================================================

const MAX_PREVIEW_ROWS = 3;

function summarizeDataEntry(refId: string, value: unknown): string {
	if (value === null || value === undefined) {
		return `- **${refId}**: (empty)`;
	}

	if (Array.isArray(value)) {
		const count = value.length;
		const preview = value.slice(0, MAX_PREVIEW_ROWS);
		const previewStr = preview
			.map((row) => {
				if (typeof row === "object" && row !== null) {
					return `  ${JSON.stringify(row)}`;
				}
				return `  ${String(row)}`;
			})
			.join("\n");
		const suffix =
			count > MAX_PREVIEW_ROWS
				? `\n  ... (${count - MAX_PREVIEW_ROWS} more rows)`
				: "";
		return `- **${refId}**: array of ${count} items\n${previewStr}${suffix}`;
	}

	if (typeof value === "object" && value !== null) {
		const keys = Object.keys(value);
		const keyFields = keys.slice(0, 8).join(", ");
		const suffix = keys.length > 8 ? `, ... (${keys.length - 8} more)` : "";
		return `- **${refId}**: object with keys: ${keyFields}${suffix}`;
	}

	return `- **${refId}**: ${String(value)}`;
}

function buildDataSummary(dataStore: Map<string, unknown>): string {
	if (dataStore.size === 0) {
		return "## Data Summary\n\nNo datasets were gathered. Write the report using only the analysis plan context.";
	}

	const entries = [...dataStore.entries()]
		.map(([refId, value]) => summarizeDataEntry(refId, value))
		.join("\n\n");

	return `## Data Summary

The following datasets are available via dataRef. Use the exact refId as the dataRef prop in MDX components.

${entries}`;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export function buildWriterContext(options: BuildWriterContextOptions): string {
	const { dataStore, plan } = options;

	const sections = [
		`## Analysis Plan\n\n${plan}`,
		buildDataSummary(dataStore),
		MDX_CATALOG,
		FORMATTING_RULES,
	];

	return sections.join("\n\n");
}
