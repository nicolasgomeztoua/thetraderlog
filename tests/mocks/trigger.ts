/**
 * Mock for Trigger.dev tasks used in tests.
 *
 * This mock tracks all trigger calls so tests can verify
 * that the correct trades are queued for background processing.
 */

// Track all processImportMAEMFE.trigger calls for test assertions
export const triggerMock = {
	triggerCalls: [] as Array<{ tradeIds: string[]; userId: string }>,

	/**
	 * Reset mock state between tests
	 */
	reset() {
		this.triggerCalls = [];
	},

	/**
	 * Get the most recent trigger call
	 */
	getLastCall() {
		return this.triggerCalls[this.triggerCalls.length - 1];
	},

	/**
	 * Get all trade IDs that were queued across all calls
	 */
	getAllTriggeredTradeIds() {
		return this.triggerCalls.flatMap((call) => call.tradeIds);
	},
};

/**
 * Mock processImportMAEMFE task matching Trigger.dev SDK interface.
 * Tracks calls and returns a mock RunHandle response.
 */
export const processImportMAEMFE = {
	trigger: async (payload: { tradeIds: string[]; userId: string }) => {
		triggerMock.triggerCalls.push(payload);

		return {
			id: `mock-run-${Date.now()}`,
			taskIdentifier: "process-import-maemfe",
		};
	},
};
