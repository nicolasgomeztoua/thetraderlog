/**
 * Mock for Trigger.dev tasks used in tests.
 *
 * This mock tracks all batchTrigger calls so tests can verify
 * that the correct trades are queued for background processing.
 */

// Track all batchTrigger calls for test assertions
export const triggerMock = {
	batchTriggerCalls: [] as Array<
		{ payload: { tradeId: string; userId: string } }[]
	>,

	/**
	 * Reset mock state between tests
	 */
	reset() {
		this.batchTriggerCalls = [];
	},

	/**
	 * Get the most recent batchTrigger call
	 */
	getLastCall() {
		return this.batchTriggerCalls[this.batchTriggerCalls.length - 1];
	},

	/**
	 * Get total count of items triggered across all calls
	 */
	getTotalTriggeredCount() {
		return this.batchTriggerCalls.reduce((sum, call) => sum + call.length, 0);
	},

	/**
	 * Get all trade IDs that were triggered
	 */
	getAllTriggeredTradeIds() {
		return this.batchTriggerCalls.flatMap((call) =>
			call.map((item) => item.payload.tradeId),
		);
	},
};

/**
 * Mock processTradeMAEMFE task matching Trigger.dev SDK interface.
 * Tracks calls and returns mock BatchTriggerResult responses.
 */
export const processTradeMAEMFE = {
	batchTrigger: async (
		items: Array<{ payload: { tradeId: string; userId: string } }>,
	) => {
		triggerMock.batchTriggerCalls.push(items);

		// Return mock BatchTriggerResult array matching Trigger.dev SDK
		return items.map((item, index) => ({
			id: `mock-run-${Date.now()}-${index}`,
			taskIdentifier: "process-trade-maemfe",
			ok: true as const,
		}));
	},
};
