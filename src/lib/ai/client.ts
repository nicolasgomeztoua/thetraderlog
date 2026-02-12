import { env } from "@/env";
import { DEFAULT_CHAT_MODEL } from "@/lib/constants/ai";

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
	name?: string;
}

export interface ToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

export interface ToolDefinition {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

export interface ChatCompletionOptions {
	model?: string;
	messages: ChatMessage[];
	tools?: ToolDefinition[];
	tool_choice?: "auto" | "none" | "required";
	temperature?: number;
	max_tokens?: number;
	stream?: boolean;
}

export interface TokenUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

export interface ChatCompletionResponse {
	id: string;
	choices: {
		index: number;
		message: ChatMessage;
		finish_reason: string;
	}[];
	usage: TokenUsage;
	model: string;
}

export interface StreamChunk {
	id: string;
	choices: {
		index: number;
		delta: {
			role?: string;
			content?: string | null;
			tool_calls?: {
				index: number;
				id?: string;
				type?: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}[];
		};
		finish_reason: string | null;
	}[];
	usage?: TokenUsage;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// =============================================================================
// CLIENT
// =============================================================================

/**
 * Send a non-streaming chat completion request to OpenRouter.
 * Used for tool-calling loops where we need the full response at once.
 */
export async function chatCompletion(
	options: ChatCompletionOptions,
): Promise<ChatCompletionResponse> {
	const body = buildRequestBody(options, false);

	const response = await fetchWithRetry(
		`${OPENROUTER_BASE_URL}/chat/completions`,
		{
			method: "POST",
			headers: buildHeaders(),
			body: JSON.stringify(body),
		},
	);

	const data = (await response.json()) as ChatCompletionResponse;
	return data;
}

/**
 * Send a streaming chat completion request to OpenRouter.
 * Returns an async generator that yields parsed SSE chunks.
 */
export async function* chatCompletionStream(
	options: ChatCompletionOptions,
): AsyncGenerator<StreamChunk, void, unknown> {
	const body = buildRequestBody(options, true);

	const response = await fetchWithRetry(
		`${OPENROUTER_BASE_URL}/chat/completions`,
		{
			method: "POST",
			headers: buildHeaders(),
			body: JSON.stringify(body),
		},
	);

	if (!response.body) {
		throw new OpenRouterError("No response body for streaming request", 500);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			// Keep the last potentially incomplete line in the buffer
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith("data: ")) continue;

				const data = trimmed.slice(6);
				if (data === "[DONE]") return;

				try {
					const chunk = JSON.parse(data) as StreamChunk;
					yield chunk;
				} catch {
					// Skip malformed JSON chunks
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

// =============================================================================
// HELPERS
// =============================================================================

function buildHeaders(): Record<string, string> {
	return {
		Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
		"Content-Type": "application/json",
		"HTTP-Referer": "https://edgejournal.app",
		"X-Title": "EdgeJournal",
	};
}

function buildRequestBody(
	options: ChatCompletionOptions,
	stream: boolean,
): Record<string, unknown> {
	const body: Record<string, unknown> = {
		model: options.model ?? DEFAULT_CHAT_MODEL,
		messages: options.messages,
		stream,
	};

	if (options.tools && options.tools.length > 0) {
		body.tools = options.tools;
		body.tool_choice = options.tool_choice ?? "auto";
	}

	if (options.temperature !== undefined) {
		body.temperature = options.temperature;
	}

	if (options.max_tokens !== undefined) {
		body.max_tokens = options.max_tokens;
	}

	// Include usage in streaming responses
	if (stream) {
		body.stream_options = { include_usage: true };
	}

	return body;
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

export class OpenRouterError extends Error {
	constructor(
		message: string,
		public statusCode: number,
		public retryable: boolean = false,
	) {
		super(message);
		this.name = "OpenRouterError";
	}
}

async function fetchWithRetry(
	url: string,
	init: RequestInit,
	attempt = 0,
): Promise<Response> {
	const response = await fetch(url, init);

	if (response.ok) return response;

	const status = response.status;
	const isRetryable = status === 429 || status >= 500;
	const body = await response.text();

	if (isRetryable && attempt < MAX_RETRIES) {
		const delay = BASE_DELAY_MS * 2 ** attempt;
		await sleep(delay);
		return fetchWithRetry(url, init, attempt + 1);
	}

	throw new OpenRouterError(
		`OpenRouter API error (${status}): ${body}`,
		status,
		isRetryable,
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
