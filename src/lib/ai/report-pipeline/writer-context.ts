// =============================================================================
// WRITER CONTEXT BUILDER
//
// Builds a condensed context for the writer phase that includes ONLY what the
// writer needs: the analysis plan, data summaries from the dataStore with
// component type hints, and JSON-specific formatting rules.
//
// Excludes: database schema, SQL syntax, tRPC endpoint docs, tool descriptions,
// MDX catalog (the Zod schema defines available components)
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

### Prose Block Content
- Use **markdown** within prose blocks (bold, italics, lists, tables)
- Write currency as plain text: $1,234.56
- Write fractions as plain text: (A / B)
- Write multiplication as x
- **NO HTML tags** in prose content — use markdown equivalents only
- **NO LaTeX**: Never use $, $$, \\frac{}{}, \\text{}, or any LaTeX math notation

### Data Citation
- Cite specific numbers in prose (e.g., "$4,827", "58.3%", "1.4x your average loss")
- Never write vague statements like "your performance was good" — always quantify
- Cross-check superlatives against actual min/max values in the data

### DataRef Accuracy
- ONLY use dataRef keys from the "Available dataRef keys" list in the Data Summary
- NEVER invent or guess dataRef keys — a single typo causes a rendering error
- If the analysis plan mentions a dataset not in the available keys, skip the chart block and use prose instead`;

// =============================================================================
// DATA SUMMARY BUILDER
// =============================================================================

const FULL_DATA_THRESHOLD = 15;
const FULL_OBJECT_THRESHOLD = 12;

/** Minimum data points needed for each chart component to be useful */
export const COMPONENT_MINIMUMS: Record<string, number> = {
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
			return `  ⚠ WARNING: Only ${count} data point${count === 1 ? "" : "s"} — too few for a meaningful chart (need ${minimum}+). Use a metrics block or prose instead.`;
		}
	}
	if (count <= 2) {
		return `  ⚠ WARNING: Only ${count} data point${count === 1 ? "" : "s"} — consider using a metrics block or prose instead of a chart block.`;
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
You MUST use these exact refIds — no others exist. If the analysis plan references a key not in this list, skip that chart block and use prose instead.

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
		FORMATTING_RULES,
	];

	return sections.join("\n\n");
}
