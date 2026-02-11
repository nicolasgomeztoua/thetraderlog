import { task } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import {
	type ChatMessage,
	chatCompletion,
	type ToolCall,
} from "@/lib/ai/client";
import { buildUserContext } from "@/lib/ai/context-builder";
import { buildSystemPrompt } from "@/lib/ai/prompts/trading-analyst";
import { generateReportPdf } from "@/lib/ai/report-pdf";
import { generateSchemaContext } from "@/lib/ai/schema-context";
import { AI_TOOLS, executeTool } from "@/lib/ai/tools";
import { db } from "@/server/db";
import { aiConversations, aiMessages, aiReports } from "@/server/db/schema";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum tool-calling rounds for report generation (more than chat's 10) */
const MAX_TOOL_ROUNDS = 20;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract chart image URLs from tool call results in the message history.
 * Charts are produced by run_python tool and stored in the result's data.images array.
 */
function extractChartUrls(messages: ChatMessage[]): string[] {
	const urls: string[] = [];
	for (const msg of messages) {
		if (msg.role !== "tool") continue;
		try {
			const parsed = JSON.parse(msg.content ?? "{}");
			if (parsed.data?.images && Array.isArray(parsed.data.images)) {
				for (const url of parsed.data.images) {
					if (typeof url === "string" && url.length > 0) {
						urls.push(url);
					}
				}
			}
		} catch {
			// Not valid JSON, skip
		}
	}
	return urls;
}

/**
 * Extract code artifacts from tool call results (run_python stdout output).
 */
function extractCodeArtifacts(messages: ChatMessage[]): string[] {
	const artifacts: string[] = [];
	for (const msg of messages) {
		if (msg.role !== "tool") continue;
		try {
			const parsed = JSON.parse(msg.content ?? "{}");
			if (
				parsed.data?.artifacts &&
				Array.isArray(parsed.data.artifacts) &&
				parsed.data.artifacts.length > 0
			) {
				artifacts.push(...parsed.data.artifacts);
			}
		} catch {
			// Not valid JSON, skip
		}
	}
	return artifacts;
}

/**
 * Generate PDF and update the report record with pdfUrl and pdfKey.
 */
async function generateAndUploadPdf(
	reportId: string,
	title: string,
	content: string,
	chatMessages: ChatMessage[],
	dateRange?: { start?: string; end?: string },
): Promise<void> {
	const charts = extractChartUrls(chatMessages);
	const codeArtifacts = extractCodeArtifacts(chatMessages);

	const result = await generateReportPdf({
		title,
		content,
		charts,
		codeArtifacts,
		dateRange,
	});

	if (result) {
		await db
			.update(aiReports)
			.set({ pdfUrl: result.pdfUrl, pdfKey: result.pdfKey })
			.where(eq(aiReports.id, reportId));
	}
}

// =============================================================================
// TASK
// =============================================================================

/**
 * Trigger.dev task for generating AI reports.
 * Orchestrates multi-turn tool-calling with the AI model, saves messages,
 * and updates report status.
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
		try {
			// Update report status to generating
			await db
				.update(aiReports)
				.set({ status: "generating" })
				.where(eq(aiReports.id, payload.reportId));

			// Update conversation status to generating
			await db
				.update(aiConversations)
				.set({ status: "generating" })
				.where(eq(aiConversations.id, payload.conversationId));

			// Build system prompt with schema + user context
			const [schemaContext, userContext] = await Promise.all([
				Promise.resolve(generateSchemaContext()),
				buildUserContext(payload.userId, db),
			]);

			// Add date range context to the prompt if provided
			let augmentedPrompt = payload.prompt;
			if (payload.dateRangeStart || payload.dateRangeEnd) {
				const dateRange = [
					payload.dateRangeStart ? `from ${payload.dateRangeStart}` : "",
					payload.dateRangeEnd ? `to ${payload.dateRangeEnd}` : "",
				]
					.filter(Boolean)
					.join(" ");
				augmentedPrompt = `${payload.prompt}\n\n[Date range for analysis: ${dateRange}]`;
			}

			const systemPrompt = buildSystemPrompt({
				schemaContext,
				userContext,
				mode: "report",
			});

			// Build initial message history
			const chatMessages: ChatMessage[] = [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: augmentedPrompt },
			];

			// Tool-calling loop
			let totalTokensUsed = 0;
			const allToolCalls: ToolCall[] = [];

			for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
				const response = await chatCompletion({
					model: payload.model,
					messages: chatMessages,
					tools: AI_TOOLS,
					tool_choice: "auto",
				});

				totalTokensUsed += response.usage?.total_tokens ?? 0;

				const choice = response.choices[0];
				if (!choice) break;

				const assistantMessage = choice.message;

				// If no tool calls, we have the final text response
				if (
					!assistantMessage.tool_calls ||
					assistantMessage.tool_calls.length === 0
				) {
					const finalContent = assistantMessage.content ?? "";

					// Save assistant message to conversation
					await db.insert(aiMessages).values({
						conversationId: payload.conversationId,
						role: "assistant",
						content: finalContent,
						model: payload.model,
						tokensUsed: totalTokensUsed,
						toolCalls:
							allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null,
					});

					// Generate PDF from report content
					const reportRecord = await db.query.aiReports.findFirst({
						where: eq(aiReports.id, payload.reportId),
						columns: { title: true },
					});
					await generateAndUploadPdf(
						payload.reportId,
						reportRecord?.title ?? payload.prompt,
						finalContent,
						chatMessages,
						{
							start: payload.dateRangeStart,
							end: payload.dateRangeEnd,
						},
					);

					// Update report as complete
					await db
						.update(aiReports)
						.set({
							status: "complete",
							tokensUsed: totalTokensUsed,
							completedAt: new Date(),
						})
						.where(eq(aiReports.id, payload.reportId));

					// Update conversation status
					await db
						.update(aiConversations)
						.set({ status: "complete" })
						.where(eq(aiConversations.id, payload.conversationId));

					return {
						reportId: payload.reportId,
						success: true,
						tokensUsed: totalTokensUsed,
						toolCallsCount: allToolCalls.length,
					};
				}

				// Process tool calls
				allToolCalls.push(...assistantMessage.tool_calls);

				// Add assistant message with tool calls to context
				chatMessages.push({
					role: "assistant",
					content: assistantMessage.content,
					tool_calls: assistantMessage.tool_calls,
				});

				// Execute each tool call and add results
				for (const toolCall of assistantMessage.tool_calls) {
					let args: Record<string, unknown>;
					try {
						args = JSON.parse(toolCall.function.arguments);
					} catch {
						args = {};
					}

					const result = await executeTool(toolCall.function.name, args, {
						userId: payload.userId,
						db,
					});

					chatMessages.push({
						role: "tool",
						content: JSON.stringify(result),
						tool_call_id: toolCall.id,
					});
				}
			}

			// If we exhausted tool rounds, save fallback and mark complete
			const fallbackContent =
				"The report analysis reached the maximum number of tool-calling rounds. The results above represent the analysis completed within the allowed iterations.";

			await db.insert(aiMessages).values({
				conversationId: payload.conversationId,
				role: "assistant",
				content: fallbackContent,
				model: payload.model,
				tokensUsed: totalTokensUsed,
				toolCalls:
					allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null,
			});

			// Generate PDF from fallback content
			const reportRecord = await db.query.aiReports.findFirst({
				where: eq(aiReports.id, payload.reportId),
				columns: { title: true },
			});
			await generateAndUploadPdf(
				payload.reportId,
				reportRecord?.title ?? payload.prompt,
				fallbackContent,
				chatMessages,
				{
					start: payload.dateRangeStart,
					end: payload.dateRangeEnd,
				},
			);

			// Still mark as complete since we have partial results
			await db
				.update(aiReports)
				.set({
					status: "complete",
					tokensUsed: totalTokensUsed,
					completedAt: new Date(),
				})
				.where(eq(aiReports.id, payload.reportId));

			await db
				.update(aiConversations)
				.set({ status: "complete" })
				.where(eq(aiConversations.id, payload.conversationId));

			return {
				reportId: payload.reportId,
				success: true,
				tokensUsed: totalTokensUsed,
				toolCallsCount: allToolCalls.length,
				truncated: true,
			};
		} catch (error) {
			// Update report status to failed
			await db
				.update(aiReports)
				.set({
					status: "failed",
					completedAt: new Date(),
				})
				.where(eq(aiReports.id, payload.reportId));

			// Update conversation status to failed
			await db
				.update(aiConversations)
				.set({ status: "failed" })
				.where(eq(aiConversations.id, payload.conversationId));

			// Save error message to conversation
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			await db.insert(aiMessages).values({
				conversationId: payload.conversationId,
				role: "assistant",
				content: `Report generation failed: ${errorMessage}`,
			});

			throw error;
		}
	},
});
