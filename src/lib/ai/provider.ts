import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "@/env";
import { DEFAULT_CHAT_MODEL, DEFAULT_REPORT_MODEL } from "@/lib/constants/ai";

const openrouter = createOpenRouter({
	apiKey: env.OPENROUTER_API_KEY,
});

/**
 * Get a Vercel AI SDK model instance for any OpenRouter model ID
 */
export function getModel(modelId: string) {
	return openrouter(modelId);
}

/**
 * Get the default chat model instance
 */
export function getChatModel() {
	return getModel(DEFAULT_CHAT_MODEL);
}

/**
 * Get the default report generation model instance
 */
export function getReportModel() {
	return getModel(DEFAULT_REPORT_MODEL);
}
