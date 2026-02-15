import {
	generateObject,
	generateText,
	type LanguageModel,
	type ModelMessage,
	type StepResult,
	stepCountIs,
	streamText,
	type ToolSet,
} from "ai";
import type { z } from "zod";

// =============================================================================
// ERROR CLASS
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

// =============================================================================
// TYPES
// =============================================================================

interface AiGenerateTextOptions {
	model: LanguageModel;
	system?: string;
	messages: ModelMessage[];
	tools?: ToolSet;
	maxSteps?: number;
	maxRetries?: number;
	temperature?: number;
	maxOutputTokens?: number;
	onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
}

interface AiGenerateTextResult {
	text: string;
	totalTokens: number;
	steps: StepResult<ToolSet>[];
	finishReason: string;
}

interface AiStreamTextOptions {
	model: LanguageModel;
	system?: string;
	messages: ModelMessage[];
	tools?: ToolSet;
	maxSteps?: number;
	maxRetries?: number;
	temperature?: number;
	maxOutputTokens?: number;
	onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
}

interface AiGenerateObjectOptions<T extends z.ZodType> {
	model: LanguageModel;
	system?: string;
	messages: ModelMessage[];
	schema: T;
	maxRetries?: number;
	temperature?: number;
	maxOutputTokens?: number;
}

interface AiGenerateObjectResult<T> {
	object: T;
	totalTokens: number;
}

// =============================================================================
// GENERATE TEXT (NON-STREAMING)
// =============================================================================

/**
 * Wrapper around Vercel AI SDK generateText().
 * Handles multi-step tool calling via stopWhen: stepCountIs(maxSteps).
 */
export async function aiGenerateText(
	options: AiGenerateTextOptions,
): Promise<AiGenerateTextResult> {
	try {
		const result = await generateText({
			model: options.model,
			system: options.system,
			messages: options.messages,
			tools: options.tools,
			stopWhen: stepCountIs(options.maxSteps ?? 1),
			maxRetries: options.maxRetries ?? 3,
			temperature: options.temperature,
			maxOutputTokens: options.maxOutputTokens,
			onStepFinish: options.onStepFinish,
		});

		return {
			text: result.text,
			totalTokens:
				(result.totalUsage?.inputTokens ?? 0) +
				(result.totalUsage?.outputTokens ?? 0),
			steps: result.steps,
			finishReason: result.finishReason,
		};
	} catch (error) {
		throw mapToOpenRouterError(error);
	}
}

// =============================================================================
// STREAM TEXT
// =============================================================================

/**
 * Wrapper around Vercel AI SDK streamText().
 * Returns the streamText result object for consuming text/tool streams.
 */
export function aiStreamText(options: AiStreamTextOptions) {
	try {
		return streamText({
			model: options.model,
			system: options.system,
			messages: options.messages,
			tools: options.tools,
			stopWhen: options.maxSteps ? stepCountIs(options.maxSteps) : undefined,
			maxRetries: options.maxRetries ?? 3,
			temperature: options.temperature,
			maxOutputTokens: options.maxOutputTokens,
			onStepFinish: options.onStepFinish,
		});
	} catch (error) {
		throw mapToOpenRouterError(error);
	}
}

// =============================================================================
// GENERATE OBJECT (STRUCTURED OUTPUT)
// =============================================================================

/**
 * Wrapper around Vercel AI SDK generateObject().
 * Produces validated structured JSON output from a Zod schema.
 */
export async function aiGenerateObject<T extends z.ZodType>(
	options: AiGenerateObjectOptions<T>,
): Promise<AiGenerateObjectResult<z.infer<T>>> {
	try {
		const result = await generateObject({
			model: options.model,
			system: options.system,
			messages: options.messages,
			schema: options.schema,
			maxRetries: options.maxRetries ?? 3,
			temperature: options.temperature,
			maxOutputTokens: options.maxOutputTokens,
		});

		return {
			object: result.object as z.infer<T>,
			totalTokens:
				(result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
		};
	} catch (error) {
		throw mapToOpenRouterError(error);
	}
}

// =============================================================================
// ERROR MAPPING
// =============================================================================

/**
 * Map Vercel AI SDK errors to the existing OpenRouterError format.
 * This preserves backward compatibility with existing error handling.
 */
function mapToOpenRouterError(error: unknown): OpenRouterError {
	if (error instanceof OpenRouterError) {
		return error;
	}

	if (error instanceof Error) {
		const message = error.message;

		// Rate limit errors
		if (
			message.includes("429") ||
			message.toLowerCase().includes("rate limit")
		) {
			return new OpenRouterError(message, 429, true);
		}

		// Server errors (retryable)
		if (
			message.includes("500") ||
			message.includes("502") ||
			message.includes("503")
		) {
			const statusMatch = message.match(/\b(5\d{2})\b/);
			const status = statusMatch?.[1]
				? Number.parseInt(statusMatch[1], 10)
				: 500;
			return new OpenRouterError(message, status, true);
		}

		// Context length exceeded
		if (
			message.toLowerCase().includes("context length") ||
			message.toLowerCase().includes("too many tokens")
		) {
			return new OpenRouterError(message, 400, false);
		}

		// Content filter
		if (
			message.toLowerCase().includes("content filter") ||
			message.toLowerCase().includes("content_filter")
		) {
			return new OpenRouterError(message, 400, false);
		}

		// Generic error
		return new OpenRouterError(message, 500, false);
	}

	return new OpenRouterError(String(error), 500, false);
}
