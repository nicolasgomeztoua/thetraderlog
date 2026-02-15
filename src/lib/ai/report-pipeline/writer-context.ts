// =============================================================================
// WRITER CONTEXT BUILDER
//
// Builds a condensed context for the writer phase that includes ONLY what the
// writer needs: the analysis plan, data summaries from the dataStore, MDX
// component catalog, and formatting rules.
//
// Excludes: database schema, SQL syntax, tRPC endpoint docs, tool descriptions
// =============================================================================

import type { DataStoreMap } from "@/lib/ai/report-pipeline/report-schema";

// =============================================================================
// TYPES
// =============================================================================

interface BuildWriterContextOptions {
	dataStore: DataStoreMap;
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

const FULL_DATA_THRESHOLD = 15;
const FULL_OBJECT_THRESHOLD = 12;

/** Minimum data points needed for each chart component to be useful */
const COMPONENT_MINIMUMS: Record<string, number> = {
	"r-multiple": 10,
	"monte-carlo": 20,
	equity: 5,
	monthly: 2,
	"dow-": 3,
	hour: 5,
	session: 2,
	calendar: 7,
	drawdown: 1,
	symbol: 2,
};

function getDataSufficiencyWarning(
	refId: string,
	count: number,
): string | null {
	for (const [pattern, minimum] of Object.entries(COMPONENT_MINIMUMS)) {
		if (refId.includes(pattern) && count < minimum) {
			return `  ⚠ WARNING: Only ${count} data point${count === 1 ? "" : "s"} — too few for a meaningful chart (need ${minimum}+). Use MetricCards or prose instead.`;
		}
	}
	if (count <= 2) {
		return `  ⚠ WARNING: Only ${count} data point${count === 1 ? "" : "s"} — consider using MetricCards or prose instead of a chart component.`;
	}
	return null;
}

function computeNumericAggregates(
	rows: Record<string, unknown>[],
): string | null {
	if (rows.length === 0) return null;

	const numericFields: Record<
		string,
		{ count: number; sum: number; min: number; max: number }
	> = {};

	for (const row of rows) {
		for (const [key, val] of Object.entries(row)) {
			const num =
				typeof val === "number"
					? val
					: typeof val === "string"
						? Number.parseFloat(val)
						: Number.NaN;
			if (Number.isNaN(num)) continue;

			if (!numericFields[key]) {
				numericFields[key] = {
					count: 0,
					sum: 0,
					min: Number.POSITIVE_INFINITY,
					max: Number.NEGATIVE_INFINITY,
				};
			}
			const agg = numericFields[key];
			agg.count++;
			agg.sum += num;
			agg.min = Math.min(agg.min, num);
			agg.max = Math.max(agg.max, num);
		}
	}

	const fieldNames = Object.keys(numericFields);
	if (fieldNames.length === 0) return null;

	const lines = fieldNames.flatMap((field) => {
		const a = numericFields[field];
		if (!a) return [];
		const mean = a.count > 0 ? a.sum / a.count : 0;
		return `    ${field}: count=${a.count}, sum=${a.sum.toFixed(2)}, min=${a.min.toFixed(2)}, max=${a.max.toFixed(2)}, mean=${mean.toFixed(2)}`;
	});

	return `  Aggregates:\n${lines.join("\n")}`;
}

function summarizeDataEntry(refId: string, value: unknown): string {
	if (value === null || value === undefined) {
		return `- **${refId}**: (empty)`;
	}

	if (Array.isArray(value)) {
		const count = value.length;
		const warning = getDataSufficiencyWarning(refId, count);

		// Full data for small arrays (≤15 rows)
		if (count <= FULL_DATA_THRESHOLD) {
			const allRows = value
				.map((row) => {
					if (typeof row === "object" && row !== null) {
						return `  ${JSON.stringify(row)}`;
					}
					return `  ${String(row)}`;
				})
				.join("\n");
			const parts = [`- **${refId}**: array of ${count} items (FULL DATA)`];
			if (warning) parts.push(warning);
			parts.push(allRows);
			return parts.join("\n");
		}

		// For larger arrays: preview + aggregates
		const preview = value
			.slice(0, 3)
			.map((row) => {
				if (typeof row === "object" && row !== null) {
					return `  ${JSON.stringify(row)}`;
				}
				return `  ${String(row)}`;
			})
			.join("\n");

		const parts = [`- **${refId}**: array of ${count} items`];
		if (warning) parts.push(warning);
		parts.push(`  First 3 rows:\n${preview}\n  ... (${count - 3} more rows)`);

		// Compute aggregates for numeric fields
		const hasObjectRows = value.some(
			(r) => typeof r === "object" && r !== null,
		);
		if (hasObjectRows) {
			const agg = computeNumericAggregates(value as Record<string, unknown>[]);
			if (agg) parts.push(agg);
		}

		return parts.join("\n");
	}

	if (typeof value === "object" && value !== null) {
		const keys = Object.keys(value);

		// Full display for small objects (≤12 keys)
		if (keys.length <= FULL_OBJECT_THRESHOLD) {
			return `- **${refId}**: object (FULL DATA)\n  ${JSON.stringify(value, null, 2).split("\n").join("\n  ")}`;
		}

		const keyFields = keys.slice(0, 8).join(", ");
		const suffix = keys.length > 8 ? `, ... (${keys.length - 8} more)` : "";
		return `- **${refId}**: object with keys: ${keyFields}${suffix}`;
	}

	return `- **${refId}**: ${String(value)}`;
}

function buildDataSummary(dataStore: DataStoreMap): string {
	if (dataStore.size === 0) {
		return "## Data Summary\n\nNo datasets were gathered. Write the report using only the analysis plan context.";
	}

	const allKeys = [...dataStore.keys()];
	const keyList = allKeys
		.map((k) => {
			const entry = dataStore.get(k);
			if (entry?.component) {
				return `\`${k}\` -> ${entry.component}`;
			}
			return `\`${k}\``;
		})
		.join(", ");

	const entries = [...dataStore.entries()]
		.map(([refId, entry]) => summarizeDataEntry(refId, entry.data))
		.join("\n\n");

	return `## Data Summary

**Available dataRef keys**: ${keyList}
You MUST use these exact refIds — no others exist. If the analysis plan references a key not in this list, skip that component and use prose instead.

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
