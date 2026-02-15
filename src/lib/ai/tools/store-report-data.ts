import type { DataStoreMap } from "@/lib/ai/report-pipeline/report-schema";

// =============================================================================
// EXECUTOR
// =============================================================================

/**
 * Store data in the report's data store for later use by chart components.
 * The dataStore is an in-memory Map during generation, persisted to DB after.
 * Each entry stores the data alongside optional component metadata.
 */
export function executeStoreReportData(
	refId: string,
	description: string,
	data: unknown,
	dataStore: DataStoreMap,
	component?: string,
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

	dataStore.set(refId, { data, component, description });

	const result: Record<string, unknown> = {
		success: true,
		refId,
		description,
	};

	if (component) {
		result.component = component;
	}

	if (Array.isArray(data)) {
		result.rowCount = data.length;
	}

	return { success: true, data: result };
}
