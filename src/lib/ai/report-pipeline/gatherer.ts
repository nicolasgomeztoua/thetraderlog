import type { LanguageModel } from "ai";
import { aiGenerateText } from "@/lib/ai/client";
import { getReportTools } from "@/lib/ai/tools/definitions";
import { MAX_TOOL_ROUNDS_REPORT } from "@/lib/constants/ai";
import type { db as DbInstance } from "@/server/db";

type Db = typeof DbInstance;

// =============================================================================
// TYPES
// =============================================================================

interface GathererOptions {
	plan: string;
	prompt: string;
	userContext: string;
	schemaContext: string;
	model: LanguageModel;
	userId: string;
	db: Db;
	dataStore: Map<string, unknown>;
	reportId?: string;
	accountId?: string;
}

interface GathererResult {
	tokensUsed: number;
	dataStoreKeys: string[];
	totalToolCalls: number;
}

// =============================================================================
// GATHERER SYSTEM PROMPT
// =============================================================================

const GATHERER_PERSONA = `You are the data gathering phase of EdgeJournal's report pipeline. Your ONLY job is to execute the analysis plan by calling tools to collect all required data.

CRITICAL RULES:
- After EVERY successful tool call, IMMEDIATELY call store_report_data to save the result before making more tool calls
- Do NOT wait to "process" or "analyze" data before storing — store raw results first
- Do NOT try to run Python analysis — the writer phase handles all analysis and formatting
- You have a limited number of tool calls — prioritize storing data over perfecting queries

You MUST:
- Follow the analysis plan and call the tools listed in it
- Use store_report_data to register each dataset with a unique refId IMMEDIATELY after getting results
- Match the tool to the data need: call_analytics for aggregate stats, run_query for trade-level detail and custom analysis, get_market_data for price context and entry/exit quality
- When the plan calls for price-related analysis (entry quality, market structure, trends), proactively use get_market_data combined with run_query

You MUST NOT:
- Write any report prose or markdown
- Generate final report content
- Skip data sources listed in the plan
- Invent data — only use tool results
- Use run_python — save raw data and let the writer handle analysis
- Delay storing data to batch or process it first`;

const DATA_HANDLING_NOTES = `## Data Handling Notes

- P&L columns (realized_pnl, net_pnl, fees) are stored as decimal strings — use CAST(column AS NUMERIC) for SQL aggregation
- Breakeven trades (net_pnl = 0) are counted as losses in win rate calculations
- All timestamps are in UTC — the user's timezone is in their context
- Dates in filter inputs use ISO 8601 format (e.g., "2026-01-15")
- Soft-deleted trades and inactive accounts are automatically excluded at the CTE level — no need to add deleted_at IS NULL manually
- Use the user-scoped CTE aliases (user_trades, user_accounts, etc.) — never raw table names`;

function buildGathererSystemPrompt(
	plan: string,
	userContext: string,
	schemaContext: string,
	accountId?: string,
): string {
	const sections = [
		GATHERER_PERSONA,
		userContext,
		schemaContext,
		DATA_HANDLING_NOTES,
	];

	if (accountId) {
		sections.push(
			`## Account Scope\n\nAnalysis is scoped to account: ${accountId}. All queries and analytics calls are automatically filtered to this account.`,
		);
	}

	sections.push(
		`## Analysis Plan\n\nExecute this plan by calling the appropriate tools:\n\n${plan}`,
		`## Instructions\n\n1. Work through the analysis plan section by section\n2. For each data source, call the tool AND immediately call store_report_data in the SAME step to save the result\n3. Never skip storing — a tool call without store_report_data is wasted\n4. If a query fails, fix it and retry once, then move on to the next data source\n5. Continue until all planned data sources have been gathered\n6. When all data is collected, output a brief summary of what was gathered`,
	);

	return sections.join("\n\n");
}

// =============================================================================
// GATHERER PHASE
// =============================================================================

export async function runGathererPhase(
	options: GathererOptions,
): Promise<GathererResult> {
	const systemPrompt = buildGathererSystemPrompt(
		options.plan,
		options.userContext,
		options.schemaContext,
		options.accountId,
	);

	const tools = getReportTools({
		userId: options.userId,
		db: options.db,
		dataStore: options.dataStore,
		accountId: options.accountId,
	});

	const tag = options.reportId ? `[report:${options.reportId}]` : "[report]";

	const result = await aiGenerateText({
		model: options.model,
		system: systemPrompt,
		messages: [{ role: "user", content: options.prompt }],
		tools,
		maxSteps: MAX_TOOL_ROUNDS_REPORT,
		onStepFinish: (step) => {
			if (step.toolCalls?.length) {
				for (const call of step.toolCalls) {
					const argsPreview = JSON.stringify(call.input).slice(0, 200);
					console.log(
						`${tag} Gatherer tool call: ${call.toolName}(${argsPreview})`,
					);
				}
			}
			if (step.toolResults?.length) {
				for (const toolResult of step.toolResults) {
					const outputObj = toolResult.output as Record<string, unknown>;
					const success = outputObj?.success;
					const error = outputObj?.error;
					const preview = JSON.stringify(toolResult.output).slice(0, 300);
					console.log(
						`${tag} Tool result [${toolResult.toolName}]: success=${success}${error ? ` error="${error}"` : ""} — ${preview}`,
					);
				}
			}
		},
	});

	// Log post-gathering diagnostics
	console.log(`${tag} Gatherer finish reason: ${result.finishReason}`);
	if (result.text) {
		console.log(
			`${tag} Gatherer final text (${result.text.length} chars): ${result.text.slice(0, 500)}`,
		);
	}
	console.log(
		`${tag} DataStore keys after gathering: [${[...options.dataStore.keys()].join(", ")}]`,
	);

	// Count total tool calls across all steps
	let totalToolCalls = 0;
	for (const step of result.steps) {
		totalToolCalls += step.toolCalls?.length ?? 0;
	}

	return {
		tokensUsed: result.totalTokens,
		dataStoreKeys: [...options.dataStore.keys()],
		totalToolCalls,
	};
}
