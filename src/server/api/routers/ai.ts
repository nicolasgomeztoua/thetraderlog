import { runs } from "@trigger.dev/sdk/v3";

import type { ModelMessage } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { aiGenerateText } from "@/lib/ai/client";
import { buildUserContext } from "@/lib/ai/context-builder";
import { buildSystemPrompt } from "@/lib/ai/prompts/trading-analyst";
import { getModel } from "@/lib/ai/provider";
import { generateSchemaContext } from "@/lib/ai/schema-context";
import { getChatTools } from "@/lib/ai/tools/definitions";
import { createPdfToken } from "@/lib/auth/pdf-token";
import { getEffectivePlan, type UserWithMetadata } from "@/lib/billing/utils";
import {
	CHAT_REASONING_TOKENS,
	DEFAULT_CHAT_MODEL,
	DEFAULT_REPORT_MODEL,
	MAX_CHAT_MESSAGES_PER_CONVERSATION,
	MAX_TOOL_ROUNDS_CHAT,
} from "@/lib/constants/ai";
import {
	FEATURE_AI_CHAT,
	FEATURE_AI_REPORTS,
	FEATURE_PDF_EXPORT,
	PLAN_FREE,
	PLAN_PRO,
} from "@/lib/constants/billing";
import {
	ERR_CONVERSATION_CREATE_FAILED,
	ERR_CONVERSATION_NOT_FOUND,
	ERR_MESSAGE_LIMIT_REACHED,
	ERR_MESSAGE_SAVE_FAILED,
	ERR_REPORT_CONVERSATION_CREATE_FAILED,
	ERR_REPORT_CONVERSATION_NOT_FOUND,
	ERR_REPORT_CREATE_FAILED,
	ERR_REPORT_NOT_COMPLETE,
	ERR_REPORT_NOT_FOUND,
	ERR_REPORT_ONLY_FAILED_RETRY,
} from "@/lib/constants/errors";
import {
	createTRPCRouter,
	protectedProcedure,
	requireFeature,
} from "@/server/api/trpc";
import { aiConversations, aiMessages, aiReports } from "@/server/db/schema";
import { generateAiReport } from "@/trigger/generate-ai-report";
import { generateReportPdf } from "@/trigger/generate-report-pdf";
import {
	decrementChatUsage,
	decrementReportUsage,
	incrementAndCheckChatUsage,
	incrementAndCheckReportUsage,
} from "./billing";

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
	sendMessage: requireFeature(FEATURE_AI_CHAT)
		.input(
			z.object({
				conversationId: z.string(),
				content: z.string().min(1).max(10_000),
				accountId: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Enforce daily chat usage limit — derive Pro status from Clerk auth,
			// not DB user (which lacks publicMetadata for beta detection).
			const userMeta = ctx.user as unknown as UserWithMetadata;
			const effectivePlan = ctx.clerkAuth
				? getEffectivePlan(ctx.clerkAuth, userMeta)
				: PLAN_FREE;
			const beta = effectivePlan === PLAN_PRO;
			const { date: usageDate } = await incrementAndCheckChatUsage(
				ctx.db,
				ctx.user.id,
				beta,
			);

			try {
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

				const messages: ModelMessage[] = allMessages.map((msg) => ({
					role: msg.role as "user" | "assistant",
					content: msg.content ?? "",
				}));

				const modelId = conversation.model ?? DEFAULT_CHAT_MODEL;

				// Vercel AI SDK handles the tool-calling loop via maxSteps
				const tools = getChatTools({
					userId: ctx.user.id,
					db: ctx.db,
					accountId: input.accountId,
				});

				const result = await aiGenerateText({
					model: getModel(modelId),
					system: systemPrompt,
					messages,
					tools,
					maxSteps: MAX_TOOL_ROUNDS_CHAT,
					reasoning: { maxTokens: CHAT_REASONING_TOKENS },
				});

				// Collect tool calls from all steps for logging
				const allToolCalls = result.steps.flatMap((step) =>
					(step.toolCalls ?? []).map((tc) => ({
						id: tc.toolCallId,
						type: "function" as const,
						function: {
							name: tc.toolName,
							arguments: JSON.stringify(tc.input),
						},
					})),
				);

				const finalContent =
					result.text ||
					"I apologize, but I was unable to complete the analysis within the allowed number of tool calls. Please try rephrasing your question or breaking it into smaller parts.";

				// Save assistant message
				const [savedMessage] = await ctx.db
					.insert(aiMessages)
					.values({
						conversationId: input.conversationId,
						role: "assistant",
						content: finalContent,
						model: modelId,
						tokensUsed: result.totalTokens,
						toolCalls:
							allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null,
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
			} catch (error) {
				// incrementAndCheckChatUsage is called before this try block,
				// so all errors here are from the AI call or DB writes — always roll back.
				try {
					await decrementChatUsage(ctx.db, ctx.user.id, usageDate);
				} catch {
					console.error("Failed to rollback chat usage after error");
				}
				throw error;
			}
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
	startReport: requireFeature(FEATURE_AI_REPORTS)
		.input(
			z.object({
				prompt: z.string().min(1).max(10_000),
				title: z.string().max(200).optional(),
				dateRangeStart: z.string().datetime().optional(),
				dateRangeEnd: z.string().datetime().optional(),
				templateId: z.string().optional(),
				accountId: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Enforce monthly report usage limit — derive Pro status from Clerk auth,
			// not DB user (which lacks publicMetadata for beta detection).
			const userMeta = ctx.user as unknown as UserWithMetadata;
			const effectivePlan = ctx.clerkAuth
				? getEffectivePlan(ctx.clerkAuth, userMeta)
				: PLAN_FREE;
			const beta = effectivePlan === PLAN_PRO;
			const { month: usageMonth, year: usageYear } =
				await incrementAndCheckReportUsage(ctx.db, ctx.user.id, beta);

			let createdReportId: string | null = null;

			try {
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
				createdReportId = report.id;

				// Trigger Trigger.dev background task
				const handle = await generateAiReport.trigger({
					reportId: report.id,
					userId: ctx.user.id,
					conversationId: conversation.id,
					prompt: input.prompt,
					model,
					dateRangeStart: input.dateRangeStart,
					dateRangeEnd: input.dateRangeEnd,
					templateId: input.templateId,
					accountId: input.accountId,
				});

				// Store the Trigger.dev task ID for tracking
				await ctx.db
					.update(aiReports)
					.set({ triggerTaskId: handle.id })
					.where(eq(aiReports.id, report.id));

				return { ...report, triggerTaskId: handle.id };
			} catch (error) {
				// incrementAndCheckReportUsage is called before this try block,
				// so all errors here are from DB writes or Trigger.dev — always roll back.
				try {
					await decrementReportUsage(
						ctx.db,
						ctx.user.id,
						usageMonth,
						usageYear,
					);
				} catch {
					console.error("Failed to rollback report usage after error");
				}

				// Mark orphaned report as "failed" so retryReport can recover it
				if (createdReportId) {
					try {
						await ctx.db
							.update(aiReports)
							.set({ status: "failed" })
							.where(eq(aiReports.id, createdReportId));
					} catch {
						console.error("Failed to mark orphaned report as failed");
					}
				}

				throw error;
			}
		}),

	/**
	 * Get a report by ID with full details (includes conversation + messages).
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
	 * Get report content and data artifacts for the MDX viewer page.
	 */
	getReportContent: protectedProcedure
		.input(z.object({ reportId: z.string() }))
		.query(async ({ ctx, input }) => {
			const report = await ctx.db.query.aiReports.findFirst({
				where: and(
					eq(aiReports.id, input.reportId),
					eq(aiReports.userId, ctx.user.id),
				),
				columns: {
					id: true,
					title: true,
					content: true,
					dataArtifacts: true,
					status: true,
					createdAt: true,
					completedAt: true,
					model: true,
					tokensUsed: true,
					chartsGenerated: true,
					prompt: true,
				},
			});

			if (!report) {
				throw new Error(ERR_REPORT_NOT_FOUND);
			}

			return report;
		}),

	/**
	 * List user reports (most recent first), paginated.
	 * Includes hasContent flag for UI to determine if viewer link is available.
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
				items: reports.map((report) => ({
					...report,
					hasContent: report.content != null && report.content.length > 0,
				})),
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
					tokensUsed: true,
					completedAt: true,
					errorMessage: true,
					progressStage: true,
					currentRound: true,
					totalToolCalls: true,
					chartsGenerated: true,
					progressDetail: true,
				},
			});

			if (!report) {
				throw new Error(ERR_REPORT_NOT_FOUND);
			}

			return report;
		}),

	/**
	 * Retry a failed report — resets state and re-triggers generation.
	 * Note: This intentionally does NOT call incrementAndCheckReportUsage because
	 * the quota slot was already consumed by the original startReport call.
	 * Only reports with status "failed" can be retried, so concurrent abuse is
	 * limited — each retry resets status to "queued", preventing re-entry until
	 * the job completes or fails again.
	 */
	retryReport: requireFeature(FEATURE_AI_REPORTS)
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

	// =========================================================================
	// PDF DOWNLOAD ENDPOINTS
	// =========================================================================

	/**
	 * Start PDF generation for a completed report.
	 * Creates a signed auth token and triggers the Puppeteer-based PDF task.
	 */
	generatePdf: requireFeature(FEATURE_PDF_EXPORT)
		.input(z.object({ reportId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const report = await ctx.db.query.aiReports.findFirst({
				where: and(
					eq(aiReports.id, input.reportId),
					eq(aiReports.userId, ctx.user.id),
				),
				columns: { id: true, status: true },
			});

			if (!report) {
				throw new Error(ERR_REPORT_NOT_FOUND);
			}

			if (report.status !== "complete") {
				throw new Error(ERR_REPORT_NOT_COMPLETE);
			}

			const token = createPdfToken(input.reportId, ctx.user.id);

			const handle = await generateReportPdf.trigger({
				reportId: input.reportId,
				userId: ctx.user.id,
				token,
			});

			return { runId: handle.id };
		}),

	/**
	 * Check PDF generation status. Returns a presigned download URL when complete.
	 */
	getPdfStatus: protectedProcedure
		.input(z.object({ runId: z.string() }))
		.query(async ({ input }) => {
			const run = await runs.retrieve(input.runId);

			if (run.status === "COMPLETED") {
				const output = run.output as { s3Key: string } | undefined;
				if (!output?.s3Key) {
					return { status: "failed" as const };
				}

				// Generate presigned download URL
				const { getPresignedDownloadUrl } = await import("@/lib/storage/s3");
				const downloadUrl = getPresignedDownloadUrl(output.s3Key, 3600);
				return { status: "complete" as const, downloadUrl };
			}

			if (
				run.status === "FAILED" ||
				run.status === "CANCELED" ||
				run.status === "CRASHED" ||
				run.status === "SYSTEM_FAILURE" ||
				run.status === "EXPIRED" ||
				run.status === "TIMED_OUT"
			) {
				return { status: "failed" as const };
			}

			return { status: "generating" as const };
		}),
});
