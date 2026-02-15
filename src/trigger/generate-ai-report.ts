import { task } from "@trigger.dev/sdk/v3";
import { and, eq } from "drizzle-orm";
import { buildUserContext } from "@/lib/ai/context-builder";
import { getModel } from "@/lib/ai/provider";
import { sendReportEmail } from "@/lib/ai/report-email";
import { runGathererPhase } from "@/lib/ai/report-pipeline/gatherer";
import { runPlannerPhase } from "@/lib/ai/report-pipeline/planner";
import { runValidatorPhase } from "@/lib/ai/report-pipeline/validator";
import { runWriterPhase } from "@/lib/ai/report-pipeline/writer";
import { buildWriterContext } from "@/lib/ai/report-pipeline/writer-context";
import { getTemplate } from "@/lib/ai/report-templates";
import { generateSchemaContext } from "@/lib/ai/schema-context";
import {
	ERR_AI_CONNECTION,
	ERR_AI_CONTENT_FILTER,
	ERR_AI_CONTEXT_LENGTH,
	ERR_AI_GENERIC,
	ERR_AI_NO_DATA,
	ERR_AI_NOT_FOUND,
	ERR_AI_OWNERSHIP,
	ERR_AI_QUOTA,
	ERR_AI_RATE_LIMIT,
	ERR_AI_REPORT_FALLBACK,
	ERR_AI_TIMEOUT,
	ERR_AI_UNAVAILABLE,
} from "@/lib/constants/errors";
import { db, dbReadOnly } from "@/server/db";
import {
	aiConversations,
	aiMessages,
	aiReports,
	users,
} from "@/server/db/schema";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map internal errors to user-friendly messages.
 * Technical details are logged server-side by Trigger.dev — only show
 * actionable, non-technical text to the user.
 */
function getUserFriendlyErrorMessage(error: unknown): string {
	const raw =
		error instanceof Error ? error.message : String(error ?? "Unknown error");
	const lower = raw.toLowerCase();

	// Rate limiting / quota
	if (lower.includes("rate limit") || lower.includes("429"))
		return ERR_AI_RATE_LIMIT;

	if (
		lower.includes("quota") ||
		lower.includes("insufficient_quota") ||
		lower.includes("billing")
	)
		return ERR_AI_QUOTA;

	// Model / API availability
	if (lower.includes("timeout") || lower.includes("timed out"))
		return ERR_AI_TIMEOUT;

	if (
		lower.includes("503") ||
		lower.includes("502") ||
		lower.includes("service unavailable") ||
		lower.includes("bad gateway")
	)
		return ERR_AI_UNAVAILABLE;

	if (lower.includes("connection") || lower.includes("econnrefused"))
		return ERR_AI_CONNECTION;

	// Content / safety filters
	if (lower.includes("content_filter") || lower.includes("content_policy"))
		return ERR_AI_CONTENT_FILTER;

	// Token / context length
	if (lower.includes("context_length") || lower.includes("maximum context"))
		return ERR_AI_CONTEXT_LENGTH;

	// Auth / ownership (should be rare for real users)
	if (lower.includes("ownership") || lower.includes("does not belong"))
		return ERR_AI_OWNERSHIP;

	if (lower.includes("not found")) return ERR_AI_NOT_FOUND;

	// No trade data
	if (lower.includes("no trades") || lower.includes("no data"))
		return ERR_AI_NO_DATA;

	// Fallback — generic but friendly
	return ERR_AI_GENERIC;
}

/**
 * Fire-and-forget progress update. Never blocks the pipeline.
 */
async function updateProgress(
	reportId: string,
	updates: {
		progressStage?: string;
		currentRound?: number;
		totalToolCalls?: number;
		chartsGenerated?: number;
		progressDetail?: string;
	},
): Promise<void> {
	try {
		await db.update(aiReports).set(updates).where(eq(aiReports.id, reportId));
	} catch {
		// Progress updates are fire-and-forget — never block the pipeline
	}
}

/**
 * Send email notification with link to the in-app report viewer.
 */
async function sendReportNotification(
	reportId: string,
	title: string,
	userId: string,
	metadata?: {
		generationTime?: string;
		chartsGenerated?: number;
	},
): Promise<void> {
	try {
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { email: true },
		});
		if (user?.email) {
			const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://edgejournal.com"}/ai/reports/${reportId}`;
			await sendReportEmail({
				to: user.email,
				reportTitle: title,
				reportUrl,
				metadata,
			});
		}
	} catch {
		// Email delivery failure should not fail the report generation
	}
}

// =============================================================================
// TASK
// =============================================================================

/**
 * Trigger.dev task for generating AI reports.
 * Uses a 4-phase pipeline: Plan → Gather → Write → Validate.
 */
export const generateAiReport = task({
	id: "generate-ai-report",
	// AI report generation involves 4 LLM phases with multi-turn tool-calling,
	// SQL queries, Python sandbox execution, and email delivery.
	// 5 min global default is insufficient — allow up to 30 minutes.
	maxDuration: 1800,
	queue: {
		concurrencyLimit: 5,
	},
	retry: {
		maxAttempts: 1,
	},
	onFailure: async ({ payload, error }) => {
		// This hook runs in a separate execution even when the task is killed
		// by MAX_DURATION_EXCEEDED, ensuring the report never stays stuck in "generating".
		try {
			const errorString =
				error instanceof Error ? error.message : String(error ?? "");

			const isTimeout =
				errorString.includes("MAX_DURATION") ||
				errorString.includes("maxDuration") ||
				errorString.includes("compute time");

			const errorMessage = isTimeout
				? ERR_AI_TIMEOUT
				: getUserFriendlyErrorMessage(error);

			await db
				.update(aiReports)
				.set({
					status: "failed",
					progressStage: "failed",
					completedAt: new Date(),
					errorMessage,
				})
				.where(eq(aiReports.id, payload.reportId));

			await db
				.update(aiConversations)
				.set({ status: "failed" })
				.where(eq(aiConversations.id, payload.conversationId));

			await db.insert(aiMessages).values({
				conversationId: payload.conversationId,
				role: "assistant",
				content: ERR_AI_REPORT_FALLBACK,
			});
		} catch {
			// Last-resort: if even the failure handler fails, there's nothing more we can do.
			// Trigger.dev will still log the original error.
		}
	},
	run: async (payload: {
		reportId: string;
		userId: string;
		conversationId: string;
		prompt: string;
		model: string;
		dateRangeStart?: string;
		dateRangeEnd?: string;
		templateId?: string;
		accountId?: string;
	}) => {
		try {
			// Verify ownership: ensure the userId in the payload matches the report and conversation records.
			// Defense-in-depth against compromised task payloads.
			const report = await db.query.aiReports.findFirst({
				where: and(
					eq(aiReports.id, payload.reportId),
					eq(aiReports.userId, payload.userId),
				),
				columns: { id: true },
			});
			if (!report) {
				throw new Error(
					"Report ownership verification failed: report not found or does not belong to user",
				);
			}

			const conversation = await db.query.aiConversations.findFirst({
				where: and(
					eq(aiConversations.id, payload.conversationId),
					eq(aiConversations.userId, payload.userId),
				),
				columns: { id: true },
			});
			if (!conversation) {
				throw new Error(
					"Conversation ownership verification failed: conversation not found or does not belong to user",
				);
			}

			// Update report status to generating
			await db
				.update(aiReports)
				.set({ status: "generating" })
				.where(
					and(
						eq(aiReports.id, payload.reportId),
						eq(aiReports.userId, payload.userId),
					),
				);

			// Update conversation status to generating
			await db
				.update(aiConversations)
				.set({ status: "generating" })
				.where(
					and(
						eq(aiConversations.id, payload.conversationId),
						eq(aiConversations.userId, payload.userId),
					),
				);

			// Build context
			await updateProgress(payload.reportId, {
				progressStage: "building_context",
			});

			const [schemaContext, userContext] = await Promise.all([
				Promise.resolve(generateSchemaContext()),
				buildUserContext(payload.userId, dbReadOnly),
			]);

			// Augment prompt with date range if provided
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

			const model = getModel(payload.model);
			let totalTokensUsed = 0;

			// Resolve template hint if templateId is provided
			let templateHint: string | undefined;
			if (payload.templateId) {
				const template = getTemplate(payload.templateId);
				if (template) {
					templateHint = template.plannerHint;
				}
			}

			// =====================================================================
			// PHASE 1: PLANNING
			// =====================================================================
			await updateProgress(payload.reportId, {
				progressStage: "planning",
			});

			let plan: string;
			try {
				console.log(
					`[report:${payload.reportId}] Phase 1: Planning${templateHint ? ` (template: ${payload.templateId})` : ""}`,
				);
				const plannerResult = await runPlannerPhase({
					prompt: augmentedPrompt,
					userContext,
					model,
					templateHint,
				});
				plan = plannerResult.plan;
				totalTokensUsed += plannerResult.tokensUsed;
				console.log(
					`[report:${payload.reportId}] Planning complete — ${plannerResult.tokensUsed} tokens`,
				);
				console.log(
					`[report:${payload.reportId}] Planner output (${plan.length} chars):\n${plan.slice(0, 1000)}`,
				);
			} catch (error) {
				// Planner failure fallback: gatherer will use the raw user prompt
				console.warn(
					`[report:${payload.reportId}] Planner failed, falling back to raw prompt: ${error instanceof Error ? error.message : String(error)}`,
				);
				plan = augmentedPrompt;
			}

			// =====================================================================
			// PHASE 2: DATA GATHERING
			// =====================================================================
			await updateProgress(payload.reportId, {
				progressStage: "gathering_data",
			});

			const dataStore = new Map<string, unknown>();
			console.log(`[report:${payload.reportId}] Phase 2: Gathering data`);

			const gathererResult = await runGathererPhase({
				plan,
				prompt: augmentedPrompt,
				userContext,
				schemaContext,
				model,
				userId: payload.userId,
				db: dbReadOnly,
				dataStore,
				reportId: payload.reportId,
				accountId: payload.accountId,
			});

			totalTokensUsed += gathererResult.tokensUsed;
			console.log(
				`[report:${payload.reportId}] Gathering complete — ${gathererResult.totalToolCalls} tool calls, ${gathererResult.dataStoreKeys.length} datasets, ${gathererResult.tokensUsed} tokens`,
			);

			await updateProgress(payload.reportId, {
				totalToolCalls: gathererResult.totalToolCalls,
				chartsGenerated: dataStore.size,
			});

			// =====================================================================
			// PHASE 3: WRITING
			// =====================================================================
			await updateProgress(payload.reportId, {
				progressStage: "writing",
			});

			const writerContext = buildWriterContext({ dataStore, plan });
			console.log(`[report:${payload.reportId}] Phase 3: Writing report`);

			const writerResult = await runWriterPhase({
				plan,
				writerContext,
				prompt: augmentedPrompt,
				model,
				dataStoreKeys: gathererResult.dataStoreKeys,
			});

			totalTokensUsed += writerResult.tokensUsed;
			console.log(
				`[report:${payload.reportId}] Writing complete — ${writerResult.tokensUsed} tokens, ${writerResult.content.length} chars`,
			);

			// =====================================================================
			// PHASE 4: VALIDATION
			// =====================================================================
			await updateProgress(payload.reportId, {
				progressStage: "validating",
			});

			console.log(`[report:${payload.reportId}] Phase 4: Validating MDX`);

			const validatorResult = await runValidatorPhase({
				content: writerResult.content,
				dataStoreKeys: gathererResult.dataStoreKeys,
				model,
			});

			totalTokensUsed += validatorResult.tokensUsed;

			// Use validated content (may be repaired), or original if repair failed
			const finalContent = validatorResult.content;

			if (validatorResult.valid) {
				console.log(
					`[report:${payload.reportId}] Validation passed — ${validatorResult.tokensUsed} tokens`,
				);
			} else {
				console.warn(
					`[report:${payload.reportId}] Validation failed after repair attempts — saving content anyway. Errors: ${validatorResult.errors.join("; ")}`,
				);
			}

			// =====================================================================
			// SAVE RESULTS
			// =====================================================================
			const dataArtifacts =
				dataStore.size > 0 ? Object.fromEntries(dataStore) : null;

			// Save assistant message to conversation
			await db.insert(aiMessages).values({
				conversationId: payload.conversationId,
				role: "assistant",
				content: finalContent,
				model: payload.model,
				tokensUsed: totalTokensUsed,
			});

			// Update report as complete
			const reportRecord = await db.query.aiReports.findFirst({
				where: eq(aiReports.id, payload.reportId),
				columns: { title: true },
			});
			await db
				.update(aiReports)
				.set({
					status: "complete",
					progressStage: "complete",
					content: finalContent,
					dataArtifacts,
					tokensUsed: totalTokensUsed,
					totalToolCalls: gathererResult.totalToolCalls,
					chartsGenerated: dataStore.size,
					completedAt: new Date(),
				})
				.where(eq(aiReports.id, payload.reportId));

			// Update conversation status
			await db
				.update(aiConversations)
				.set({ status: "complete" })
				.where(eq(aiConversations.id, payload.conversationId));

			// Send email notification with viewer link
			await sendReportNotification(
				payload.reportId,
				reportRecord?.title ?? payload.prompt,
				payload.userId,
				{ chartsGenerated: dataStore.size },
			);

			return {
				reportId: payload.reportId,
				success: true,
				tokensUsed: totalTokensUsed,
				toolCallsCount: gathererResult.totalToolCalls,
			};
		} catch (error) {
			// Update report status to failed
			await db
				.update(aiReports)
				.set({
					status: "failed",
					progressStage: "failed",
					completedAt: new Date(),
					errorMessage: getUserFriendlyErrorMessage(error),
				})
				.where(eq(aiReports.id, payload.reportId));

			// Update conversation status to failed
			await db
				.update(aiConversations)
				.set({ status: "failed" })
				.where(eq(aiConversations.id, payload.conversationId));

			// Save a generic error message to the user-visible conversation.
			// Internal details are logged server-side by Trigger.dev, not exposed to the user.
			await db.insert(aiMessages).values({
				conversationId: payload.conversationId,
				role: "assistant",
				content: ERR_AI_REPORT_FALLBACK,
			});

			throw error;
		}
	},
});
