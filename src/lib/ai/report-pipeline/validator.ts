import type {
	ContentBlock,
	DataStoreMap,
	Section,
	StructuredReport,
} from "@/lib/ai/report-pipeline/report-schema";
import { COMPONENT_MINIMUMS } from "@/lib/ai/report-pipeline/writer-context";

// =============================================================================
// TYPES
// =============================================================================

interface ValidatorOptions {
	report: StructuredReport;
	dataStore: DataStoreMap;
}

interface ValidatorResult {
	report: StructuredReport;
	warnings: string[];
}

// =============================================================================
// DATA SHAPE VALIDATORS
// =============================================================================

/**
 * Check if data shape is compatible with the chart component.
 * - RMultipleChart expects { buckets: unknown[], stats: object }
 * - MonteCarloChart expects a non-array object
 * - All other chart components expect an array
 */
function isDataShapeCompatible(component: string, data: unknown): boolean {
	if (component === "RMultipleChart") {
		return (
			typeof data === "object" &&
			data !== null &&
			!Array.isArray(data) &&
			"buckets" in data &&
			Array.isArray((data as Record<string, unknown>).buckets) &&
			"stats" in data &&
			typeof (data as Record<string, unknown>).stats === "object"
		);
	}

	if (component === "MonteCarloChart") {
		return typeof data === "object" && data !== null && !Array.isArray(data);
	}

	// All other chart components expect arrays
	return Array.isArray(data);
}

/**
 * Get the effective data count for sufficiency checks.
 * - Arrays: length
 * - RMultipleChart: buckets.length
 * - Other objects: number of keys
 */
function getDataCount(component: string, data: unknown): number {
	if (Array.isArray(data)) {
		return data.length;
	}

	if (
		component === "RMultipleChart" &&
		typeof data === "object" &&
		data !== null &&
		"buckets" in data
	) {
		const buckets = (data as Record<string, unknown>).buckets;
		return Array.isArray(buckets) ? buckets.length : 0;
	}

	if (typeof data === "object" && data !== null) {
		return Object.keys(data).length;
	}

	return 0;
}

/**
 * Check data sufficiency using COMPONENT_MINIMUMS thresholds.
 * Returns the minimum threshold if data is insufficient, null otherwise.
 */
function checkDataSufficiency(
	dataRef: string,
	component: string,
	count: number,
): { minimum: number } | null {
	// Check by dataRef pattern (same approach as writer-context.ts)
	for (const [pattern, minimum] of Object.entries(COMPONENT_MINIMUMS)) {
		if (dataRef.includes(pattern) && count < minimum) {
			return { minimum };
		}
	}

	// Check by component name patterns
	const componentLower = component.toLowerCase();
	for (const [pattern, minimum] of Object.entries(COMPONENT_MINIMUMS)) {
		if (componentLower.includes(pattern) && count < minimum) {
			return { minimum };
		}
	}

	// General minimum: at least 1 data point for any chart
	if (count === 0) {
		return { minimum: 1 };
	}

	return null;
}

// =============================================================================
// PROSE FALLBACK BUILDER
// =============================================================================

function buildProseFallback(
	component: string,
	dataRef: string,
	reason: string,
): ContentBlock {
	return {
		type: "prose" as const,
		content: `*${component} chart for "${dataRef}" was omitted: ${reason}.*`,
	};
}

// =============================================================================
// BLOCK VALIDATION
// =============================================================================

function validateAndFixBlocks(
	blocks: ContentBlock[],
	dataStore: DataStoreMap,
	sectionHeading: string,
	warnings: string[],
): ContentBlock[] {
	return blocks.map((block) => {
		if (block.type !== "chart") {
			return block;
		}

		const { component, dataRef } = block;
		const entry = dataStore.get(dataRef);

		// Check 1: dataRef exists in dataStore
		if (!entry) {
			const warning = `[${sectionHeading}] Chart block "${component}" references missing dataRef "${dataRef}" — replaced with prose fallback`;
			warnings.push(warning);
			return buildProseFallback(
				component,
				dataRef,
				"the referenced dataset was not found in the gathered data",
			);
		}

		const data = entry.data;

		// Check 2: data shape is compatible with component
		if (!isDataShapeCompatible(component, data)) {
			const expectedShape =
				component === "RMultipleChart"
					? "{ buckets: array, stats: object }"
					: component === "MonteCarloChart"
						? "non-array object"
						: "array";
			const warning = `[${sectionHeading}] Chart block "${component}" dataRef "${dataRef}" has incompatible data shape (expected ${expectedShape}) — replaced with prose fallback`;
			warnings.push(warning);
			return buildProseFallback(
				component,
				dataRef,
				`the data shape is incompatible (expected ${expectedShape})`,
			);
		}

		// Check 3: data sufficiency
		const count = getDataCount(component, data);
		const insufficiency = checkDataSufficiency(dataRef, component, count);
		if (insufficiency) {
			const warning = `[${sectionHeading}] Chart block "${component}" dataRef "${dataRef}" has insufficient data (${count} points, need ${insufficiency.minimum}+) — replaced with prose fallback`;
			warnings.push(warning);
			return buildProseFallback(
				component,
				dataRef,
				`only ${count} data point${count === 1 ? "" : "s"} available (need ${insufficiency.minimum}+ for a meaningful chart)`,
			);
		}

		// All checks passed — keep the chart block
		return block;
	});
}

// =============================================================================
// VALIDATOR PHASE
// =============================================================================

export function runValidatorPhase(options: ValidatorOptions): ValidatorResult {
	const { report, dataStore } = options;
	const warnings: string[] = [];

	// Validate and fix each section's blocks
	const validatedSections: Section[] = report.sections.map((section) => ({
		...section,
		blocks: validateAndFixBlocks(
			section.blocks,
			dataStore,
			section.heading,
			warnings,
		),
	}));

	return {
		report: {
			...report,
			sections: validatedSections,
		},
		warnings,
	};
}
