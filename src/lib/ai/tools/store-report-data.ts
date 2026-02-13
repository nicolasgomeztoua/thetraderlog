import type { ToolDefinition } from "@/lib/ai/client";

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const storeReportDataToolDefinition: ToolDefinition = {
	type: "function",
	function: {
		name: "store_report_data",
		description:
			"Register a dataset with a unique reference ID so that MDX components in the report can access it at render time via their dataRef prop. " +
			"Call this BEFORE referencing a dataRef in any MDX component. " +
			"Each refId must be unique within the report. " +
			"The data can be any shape — arrays for charts/tables, objects for single values.",
		parameters: {
			type: "object",
			properties: {
				refId: {
					type: "string",
					description:
						"A unique reference ID for this dataset (e.g. 'equity-data', 'monthly-pnl', 'symbol-breakdown'). Used as the dataRef prop on MDX components.",
				},
				description: {
					type: "string",
					description:
						"A short description of what this data contains (for debugging and documentation).",
				},
				data: {
					description:
						"The actual data to store. Can be an array of objects (for charts/tables) or a single object (for display components).",
				},
			},
			required: ["refId", "description", "data"],
		},
	},
};

// =============================================================================
// EXECUTOR
// =============================================================================

/**
 * Store data in the report's data store for later use by MDX components.
 * The dataStore is an in-memory Map during generation, persisted to DB after.
 */
export function executeStoreReportData(
	refId: string,
	description: string,
	data: unknown,
	dataStore: Map<string, unknown>,
): { success: boolean; data?: unknown; error?: string } {
	if (!refId || refId.trim().length === 0) {
		return { success: false, error: "refId must be a non-empty string" };
	}

	if (dataStore.has(refId)) {
		return {
			success: false,
			error: `refId "${refId}" already exists in the data store. Use a unique refId.`,
		};
	}

	dataStore.set(refId, data);

	const result: Record<string, unknown> = {
		success: true,
		refId,
		description,
	};

	if (Array.isArray(data)) {
		result.rowCount = data.length;
	}

	return { success: true, data: result };
}
