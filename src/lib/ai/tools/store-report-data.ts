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
