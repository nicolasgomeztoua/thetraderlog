import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
	type ChatMessage,
	chatCompletion,
	type ToolCall,
} from "@/lib/ai/client";
import { buildUserContext } from "@/lib/ai/context-builder";
import { buildSystemPrompt } from "@/lib/ai/prompts/trading-analyst";
import { generateSchemaContext } from "@/lib/ai/schema-context";
import { AI_TOOLS, executeTool } from "@/lib/ai/tools";
import {
	DEFAULT_CHAT_MODEL,
	DEFAULT_REPORT_MODEL,
	MAX_CHAT_MESSAGES_PER_CONVERSATION,
	MAX_TOOL_ROUNDS_CHAT,
} from "@/lib/constants/ai";
import {
	ERR_CONVERSATION_CREATE_FAILED,
	ERR_CONVERSATION_NOT_FOUND,
	ERR_MESSAGE_LIMIT_REACHED,
	ERR_MESSAGE_SAVE_FAILED,
	ERR_REPORT_CONVERSATION_CREATE_FAILED,
	ERR_REPORT_CONVERSATION_NOT_FOUND,
	ERR_REPORT_CREATE_FAILED,
	ERR_REPORT_NOT_FOUND,
	ERR_REPORT_ONLY_FAILED_RETRY,
} from "@/lib/constants/errors";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { aiConversations, aiMessages, aiReports } from "@/server/db/schema";
import { generateAiReport } from "@/trigger/generate-ai-report";

// =============================================================================
// AI ROUTER (Chat + Report Endpoints)
// =============================================================================

export const aiRouter = createTRPCRouter({
	/**
	 * Create a new AI conversation.
	 */
	createConversation: protectedProcedure
		.input(
			z.object({
				mode: z.enum(["chat", "report"]),
				initialPrompt: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [conversation] = await ctx.db
				.insert(aiConversations)
				.values({
					userId: ctx.user.id,
					mode: input.mode,
					model: DEFAULT_CHAT_MODEL,
					initialPrompt: input.initialPrompt ?? null,
					status: "active",
				})
				.returning();

			if (!conversation) {
				throw new Error(ERR_CONVERSATION_CREATE_FAILED);
			}

			return conversation;
		}),

	/**
	 * Send a message to a conversation and get an AI response.
	 * Implements the full tool-calling loop: model → tool_calls → results → repeat until text response.
	 */
	sendMessage: protectedProcedure
		.input(
			z.object({
				conversationId: z.string(),
				content: z.string().min(1).max(10_000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify conversation ownership
			const conversation = await ctx.db.query.aiConversations.findFirst({
				where: and(
					eq(aiConversations.id, input.conversationId),
					eq(aiConversations.userId, ctx.user.id),
				),
			});

			if (!conversation) {
				throw new Error(ERR_CONVERSATION_NOT_FOUND);
			}

			// Check message limit
			const existingMessages = await ctx.db.query.aiMessages.findMany({
				where: eq(aiMessages.conversationId, input.conversationId),
			});

			if (existingMessages.length >= MAX_CHAT_MESSAGES_PER_CONVERSATION) {
				throw new Error(ERR_MESSAGE_LIMIT_REACHED);
			}

			// Save user message
			const [userMessage] = await ctx.db
				.insert(aiMessages)
				.values({
					conversationId: input.conversationId,
					role: "user",
					content: input.content,
				})
				.returning();

			if (!userMessage) {
				throw new Error(ERR_MESSAGE_SAVE_FAILED);
			}

			// Build system prompt with schema + user context
			const [schemaContext, userContext] = await Promise.all([
				Promise.resolve(generateSchemaContext()),
				buildUserContext(ctx.user.id, ctx.db),
			]);

			const systemPrompt = buildSystemPrompt({
				schemaContext,
				userContext,
				mode: (conversation.mode as "chat" | "report") ?? "chat",
			});

			// Build message history for the model
			const allMessages = await ctx.db.query.aiMessages.findMany({
				where: eq(aiMessages.conversationId, input.conversationId),
				orderBy: [aiMessages.createdAt],
			});

			const chatMessages: ChatMessage[] = [
				{ role: "system", content: systemPrompt },
				...allMessages.map((msg) => ({
					role: msg.role as ChatMessage["role"],
					content: msg.content,
				})),
			];

			const model = conversation.model ?? DEFAULT_CHAT_MODEL;

			// Tool-calling loop
			let totalTokensUsed = 0;
			let toolCallsSummary: ToolCall[] = [];

			for (let round = 0; round < MAX_TOOL_ROUNDS_CHAT; round++) {
				const response = await chatCompletion({
					model,
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

					// Save assistant message
					const [savedMessage] = await ctx.db
						.insert(aiMessages)
						.values({
							conversationId: input.conversationId,
							role: "assistant",
							content: finalContent,
							model,
							tokensUsed: totalTokensUsed,
							toolCalls:
								toolCallsSummary.length > 0
									? JSON.stringify(toolCallsSummary)
									: null,
						})
						.returning();

					// Update conversation title from first user message if not set
					if (!conversation.title && input.content.length > 0) {
						const title =
							input.content.length > 100
								? `${input.content.slice(0, 97)}...`
								: input.content;
						await ctx.db
							.update(aiConversations)
							.set({ title })
							.where(eq(aiConversations.id, input.conversationId));
					}

					return savedMessage;
				}

				// Process tool calls
				toolCallsSummary = [
					...toolCallsSummary,
					...assistantMessage.tool_calls,
				];

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
						userId: ctx.user.id,
						db: ctx.db,
					});

					chatMessages.push({
						role: "tool",
						content: JSON.stringify(result),
						tool_call_id: toolCall.id,
					});
				}
			}

			// If we exhausted tool rounds, save whatever we have
			const fallbackContent =
				"I apologize, but I was unable to complete the analysis within the allowed number of tool calls. Please try rephrasing your question or breaking it into smaller parts.";

			const [savedMessage] = await ctx.db
				.insert(aiMessages)
				.values({
					conversationId: input.conversationId,
					role: "assistant",
					content: fallbackContent,
					model,
					tokensUsed: totalTokensUsed,
					toolCalls:
						toolCallsSummary.length > 0
							? JSON.stringify(toolCallsSummary)
							: null,
				})
				.returning();

			return savedMessage;
		}),

	/**
	 * Get a conversation with all its messages.
	 */
	getConversation: protectedProcedure
		.input(z.object({ conversationId: z.string() }))
		.query(async ({ ctx, input }) => {
			const conversation = await ctx.db.query.aiConversations.findFirst({
				where: and(
					eq(aiConversations.id, input.conversationId),
					eq(aiConversations.userId, ctx.user.id),
				),
				with: {
					messages: {
						orderBy: [aiMessages.createdAt],
					},
				},
			});

			if (!conversation) {
				throw new Error(ERR_CONVERSATION_NOT_FOUND);
			}

			return conversation;
		}),

	/**
	 * List user conversations (most recent first), paginated.
	 */
	listConversations: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(20),
				cursor: z.string().optional(),
				mode: z.enum(["chat", "report"]).default("chat"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const conversations = await ctx.db.query.aiConversations.findMany({
				where: and(
					eq(aiConversations.userId, ctx.user.id),
					eq(aiConversations.mode, input.mode),
				),
				orderBy: [desc(aiConversations.createdAt)],
				limit: input.limit + 1,
			});

			let nextCursor: string | undefined;
			if (conversations.length > input.limit) {
				const next = conversations.pop();
				nextCursor = next?.id;
			}

			return {
				items: conversations,
				nextCursor,
			};
		}),

	/**
	 * Delete a conversation and all its messages (cascade).
	 */
	deleteConversation: protectedProcedure
		.input(z.object({ conversationId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const conversation = await ctx.db.query.aiConversations.findFirst({
				where: and(
					eq(aiConversations.id, input.conversationId),
					eq(aiConversations.userId, ctx.user.id),
				),
			});

			if (!conversation) {
				throw new Error(ERR_CONVERSATION_NOT_FOUND);
			}

			await ctx.db
				.delete(aiConversations)
				.where(eq(aiConversations.id, input.conversationId));

			return { success: true };
		}),

	// =========================================================================
	// REPORT ENDPOINTS
	// =========================================================================

	/**
	 * Start a new AI report generation.
	 * Creates a report record + conversation in report mode, saves the initial prompt
	 * as the first message, and triggers the Trigger.dev background task.
	 */
	startReport: protectedProcedure
		.input(
			z.object({
				prompt: z.string().min(1).max(10_000),
				title: z.string().max(200).optional(),
				dateRangeStart: z.string().datetime().optional(),
				dateRangeEnd: z.string().datetime().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const model = DEFAULT_REPORT_MODEL;
			const title =
				input.title ??
				(input.prompt.length > 100
					? `${input.prompt.slice(0, 97)}...`
					: input.prompt);

			// Create conversation in report mode
			const [conversation] = await ctx.db
				.insert(aiConversations)
				.values({
					userId: ctx.user.id,
					mode: "report",
					model,
					title,
					initialPrompt: input.prompt,
					status: "generating",
					dateRangeStart: input.dateRangeStart
						? new Date(input.dateRangeStart)
						: null,
					dateRangeEnd: input.dateRangeEnd
						? new Date(input.dateRangeEnd)
						: null,
				})
				.returning();

			if (!conversation) {
				throw new Error(ERR_REPORT_CONVERSATION_CREATE_FAILED);
			}

			// Save initial prompt as first user message
			await ctx.db.insert(aiMessages).values({
				conversationId: conversation.id,
				role: "user",
				content: input.prompt,
			});

			// Create report record
			const [report] = await ctx.db
				.insert(aiReports)
				.values({
					userId: ctx.user.id,
					conversationId: conversation.id,
					title,
					prompt: input.prompt,
					model,
					status: "queued",
				})
				.returning();

			if (!report) {
				throw new Error(ERR_REPORT_CREATE_FAILED);
			}

			// Trigger Trigger.dev background task
			const handle = await generateAiReport.trigger({
				reportId: report.id,
				userId: ctx.user.id,
				conversationId: conversation.id,
				prompt: input.prompt,
				model,
				dateRangeStart: input.dateRangeStart,
				dateRangeEnd: input.dateRangeEnd,
			});

			// Store the Trigger.dev task ID for tracking
			await ctx.db
				.update(aiReports)
				.set({ triggerTaskId: handle.id })
				.where(eq(aiReports.id, report.id));

			return { ...report, triggerTaskId: handle.id };
		}),

	/**
	 * Get a report by ID with full details.
	 */
	getReport: protectedProcedure
		.input(z.object({ reportId: z.string() }))
		.query(async ({ ctx, input }) => {
			const report = await ctx.db.query.aiReports.findFirst({
				where: and(
					eq(aiReports.id, input.reportId),
					eq(aiReports.userId, ctx.user.id),
				),
				with: {
					conversation: {
						with: {
							messages: {
								orderBy: [aiMessages.createdAt],
							},
						},
					},
				},
			});

			if (!report) {
				throw new Error(ERR_REPORT_NOT_FOUND);
			}

			return report;
		}),

	/**
	 * List user reports (most recent first), paginated.
	 */
	listReports: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(20),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const reports = await ctx.db.query.aiReports.findMany({
				where: eq(aiReports.userId, ctx.user.id),
				orderBy: [desc(aiReports.createdAt)],
				limit: input.limit + 1,
			});

			let nextCursor: string | undefined;
			if (reports.length > input.limit) {
				const next = reports.pop();
				nextCursor = next?.id;
			}

			return {
				items: reports,
				nextCursor,
			};
		}),

	/**
	 * Get just the status of a report (for lightweight polling).
	 */
	getReportStatus: protectedProcedure
		.input(z.object({ reportId: z.string() }))
		.query(async ({ ctx, input }) => {
			const report = await ctx.db.query.aiReports.findFirst({
				where: and(
					eq(aiReports.id, input.reportId),
					eq(aiReports.userId, ctx.user.id),
				),
				columns: {
					id: true,
					status: true,
					pdfUrl: true,
					tokensUsed: true,
					completedAt: true,
					errorMessage: true,
				},
			});

			if (!report) {
				throw new Error(ERR_REPORT_NOT_FOUND);
			}

			return report;
		}),

	/**
	 * Retry a failed report — resets state and re-triggers generation.
	 */
	retryReport: protectedProcedure
		.input(z.object({ reportId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const report = await ctx.db.query.aiReports.findFirst({
				where: and(
					eq(aiReports.id, input.reportId),
					eq(aiReports.userId, ctx.user.id),
				),
			});

			if (!report) {
				throw new Error(ERR_REPORT_NOT_FOUND);
			}

			if (report.status !== "failed") {
				throw new Error(ERR_REPORT_ONLY_FAILED_RETRY);
			}

			// Fetch conversation for date range fields
			const conversation = await ctx.db.query.aiConversations.findFirst({
				where: eq(aiConversations.id, report.conversationId),
			});

			if (!conversation) {
				throw new Error(ERR_REPORT_CONVERSATION_NOT_FOUND);
			}

			// Reset report state
			await ctx.db
				.update(aiReports)
				.set({
					status: "queued",
					errorMessage: null,
					completedAt: null,
					triggerTaskId: null,
				})
				.where(eq(aiReports.id, report.id));

			// Reset conversation status
			await ctx.db
				.update(aiConversations)
				.set({ status: "generating" })
				.where(eq(aiConversations.id, report.conversationId));

			// Re-trigger background task
			const handle = await generateAiReport.trigger({
				reportId: report.id,
				userId: ctx.user.id,
				conversationId: report.conversationId,
				prompt: report.prompt,
				model: report.model,
				dateRangeStart: conversation.dateRangeStart?.toISOString(),
				dateRangeEnd: conversation.dateRangeEnd?.toISOString(),
			});

			// Store new task ID
			await ctx.db
				.update(aiReports)
				.set({ triggerTaskId: handle.id })
				.where(eq(aiReports.id, report.id));

			return { ...report, status: "queued" as const, triggerTaskId: handle.id };
		}),
});
