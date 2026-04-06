import type { LanguageModel } from "ai";
import { aiGenerateText } from "@/lib/ai/client";
import { executeCallAnalytics } from "@/lib/ai/tools/call-analytics";
import { executeGetMarketData } from "@/lib/ai/tools/get-market-data";
import { executeRunPython } from "@/lib/ai/tools/run-python";
import { executeRunQuery } from "@/lib/ai/tools/run-query";
import type { db as DbInstance } from "@/server/db";
import type { GatheringStep, StructuredPlan } from "./plan-schema";

type Db = typeof DbInstance;

// =============================================================================
// TYPES
// =============================================================================

interface GathererOptions {
	plan: StructuredPlan;
	userId: string;
	db: Db;
	dataStore: Map<string, unknown>;
	reportId?: string;
	accountId?: string;
	/** Model for SQL retry — only used when a run_query step fails */
	model?: LanguageModel;
	/** Schema context for SQL retry — table/column docs */
	schemaContext?: string;
}

interface StepError {
	refId: string;
	tool: string;
	error: string;
}

interface GathererResult {
	tokensUsed: number;
	dataStoreKeys: string[];
	totalToolCalls: number;
	errors: StepError[];
}

// =============================================================================
// SQL RETRY — targeted AI fix for failed queries
// =============================================================================

const SQL_FIX_PROMPT = `You are a SQL repair assistant. A SQL query failed with an error. Fix the query so it succeeds.

Rules:
- Only output the corrected SQL query — no explanation, no markdown fences
- Use the user-scoped CTE aliases: user_trades, user_accounts, user_tags, user_strategies, user_journals, user_executions, user_trade_tags
- P&L columns (realized_pnl, net_pnl, fees) are decimal strings — use CAST(column AS NUMERIC) for aggregation
- Soft-deleted trades and inactive accounts are auto-excluded at the CTE level
- Keep the query as close to the original intent as possible`;

async function retrySqlQuery(
	originalQuery: string,
	errorMessage: string,
	model: LanguageModel,
	schemaContext: string,
	userId: string,
	db: Db,
	accountId?: string,
): Promise<{
	success: boolean;
	data?: unknown;
	error?: string;
	tokensUsed: number;
}> {
	try {
		const result = await aiGenerateText({
			model,
			system: `${SQL_FIX_PROMPT}\n\n${schemaContext}`,
			messages: [
				{
					role: "user",
					content: `Original query:\n${originalQuery}\n\nError:\n${errorMessage}\n\nFixed query:`,
				},
			],
		});

		const fixedQuery = result.text
			.trim()
			.replace(/^```sql?\n?/, "")
			.replace(/\n?```$/, "");

		if (!fixedQuery || fixedQuery.length < 10) {
			return {
				success: false,
				error: "SQL fix produced empty query",
				tokensUsed: result.totalTokens,
			};
		}

		const retryResult = await executeRunQuery(
			userId,
			fixedQuery,
			db,
			accountId,
		);
		return { ...retryResult, tokensUsed: result.totalTokens };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, error: `SQL retry failed: ${msg}`, tokensUsed: 0 };
	}
}

// =============================================================================
// STEP EXECUTOR
// =============================================================================

async function executeStep(
	step: GatheringStep,
	userId: string,
	db: Db,
	accountId?: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	switch (step.tool) {
		case "call_analytics": {
			// Auto-inject accountId when present and not already specified
			const mergedInput =
				accountId && !step.input?.accountId
					? { ...step.input, accountId }
					: step.input;
			return executeCallAnalytics(
				userId,
				step.router,
				step.endpoint,
				mergedInput,
				db,
			);
		}
		case "run_query":
			return executeRunQuery(userId, step.query, db, accountId);
		case "get_market_data":
			return executeGetMarketData(
				step.symbol,
				step.interval,
				step.startDate,
				step.endDate,
			);
		case "run_python":
			return executeRunPython(step.code, step.dataContext);
	}
}

function describeData(data: unknown): string {
	if (Array.isArray(data)) return `array[${data.length}]`;
	if (typeof data === "object" && data !== null)
		return `object{${Object.keys(data).length} keys}`;
	return typeof data;
}

// =============================================================================
// GATHERER PHASE — DETERMINISTIC EXECUTOR
// =============================================================================

export async function runGathererPhase(
	options: GathererOptions,
): Promise<GathererResult> {
	const {
		plan,
		userId,
		db,
		dataStore,
		reportId,
		accountId,
		model,
		schemaContext,
	} = options;
	const tag = reportId ? `[report:${reportId}]` : "[report]";
	const errors: StepError[] = [];
	let totalToolCalls = 0;
	let tokensUsed = 0;

	for (const step of plan.steps) {
		totalToolCalls++;
		console.log(
			`${tag} Executing step ${totalToolCalls}/${plan.steps.length}: ${step.tool} -> ${step.refId}`,
		);

		try {
			let result = await executeStep(step, userId, db, accountId);

			// SQL retry: if a run_query step fails and we have a model, try to fix it
			if (
				!result.success &&
				step.tool === "run_query" &&
				model &&
				schemaContext &&
				result.error
			) {
				console.log(
					`${tag} SQL failed for ${step.refId}, attempting AI-assisted retry...`,
				);
				const retryResult = await retrySqlQuery(
					step.query,
					result.error,
					model,
					schemaContext,
					userId,
					db,
					accountId,
				);
				tokensUsed += retryResult.tokensUsed;
				totalToolCalls++;

				if (retryResult.success) {
					console.log(`${tag} SQL retry succeeded for ${step.refId}`);
					result = retryResult;
				} else {
					console.warn(
						`${tag} SQL retry also failed for ${step.refId}: ${retryResult.error}`,
					);
				}
			}

			if (result.success && result.data !== undefined) {
				// Automatic storage — the key innovation
				dataStore.set(step.refId, result.data);
				console.log(
					`${tag} Stored: ${step.refId} (${describeData(result.data)})`,
				);
			} else {
				const errorMsg = result.error ?? "Unknown error";
				errors.push({
					refId: step.refId,
					tool: step.tool,
					error: errorMsg,
				});
				console.warn(`${tag} Failed: ${step.refId} — ${errorMsg}`);
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			errors.push({ refId: step.refId, tool: step.tool, error: errorMsg });
			console.warn(`${tag} Exception on ${step.refId}: ${errorMsg}`);
			// Continue to next step — don't abort the report
		}
	}

	return {
		tokensUsed,
		dataStoreKeys: [...dataStore.keys()],
		totalToolCalls,
		errors,
	};
}
