import { task } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev task for generating AI reports.
 * Orchestrates multi-turn tool-calling with the AI model, saves messages,
 * and updates report status.
 *
 * Full implementation in US-015.
 */
export const generateAiReport = task({
	id: "generate-ai-report",
	queue: {
		concurrencyLimit: 5,
	},
	retry: {
		maxAttempts: 1,
	},
	run: async (payload: {
		reportId: string;
		userId: string;
		conversationId: string;
		prompt: string;
		model: string;
		dateRangeStart?: string;
		dateRangeEnd?: string;
	}) => {
		// Stub: full implementation in US-015
		return {
			reportId: payload.reportId,
			success: false,
			message: "Report generation task not yet implemented (US-015)",
		};
	},
});
