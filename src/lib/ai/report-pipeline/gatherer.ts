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

You MUST:
- Follow the analysis plan and call the tools listed in it
- Use store_report_data to register each dataset with a unique refId
- Use call_analytics for pre-computed statistics (preferred over raw SQL)
- Use run_query for custom queries not covered by analytics endpoints
- Use get_market_data for OHLC price data
- Use run_python for statistical analysis and chart generation

You MUST NOT:
- Write any report prose or markdown
- Generate final report content
- Skip data sources listed in the plan
- Invent data — only use tool results`;

const DATA_HANDLING_NOTES = `## Data Handling Notes

- P&L columns (realized_pnl, net_pnl, fees) are stored as decimal strings — use CAST(column AS NUMERIC) for SQL aggregation
- Breakeven trades (net_pnl = 0) are counted as losses in win rate calculations
- All timestamps are in UTC — the user's timezone is in their context
- Dates in filter inputs use ISO 8601 format (e.g., "2026-01-15")
- Always include deleted_at IS NULL for trade queries to exclude soft-deleted trades
- Use the user-scoped CTE aliases (user_trades, user_accounts, etc.) — never raw table names`;

function buildGathererSystemPrompt(
	plan: string,
	userContext: string,
	schemaContext: string,
): string {
	return [
		GATHERER_PERSONA,
		userContext,
		schemaContext,
		DATA_HANDLING_NOTES,
		`## Analysis Plan\n\nExecute this plan by calling the appropriate tools:\n\n${plan}`,
		`## Instructions\n\n1. Work through the analysis plan section by section\n2. For each data source listed, call the appropriate tool\n3. After receiving tool results, use store_report_data to register the data with the refId specified in the plan\n4. Continue until all planned data sources have been gathered\n5. When all data is collected, output a brief summary of what was gathered`,
	].join("\n\n");
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
	);

	const tools = getReportTools({
		userId: options.userId,
		db: options.db,
		dataStore: options.dataStore,
	});

	const result = await aiGenerateText({
		model: options.model,
		system: systemPrompt,
		messages: [{ role: "user", content: options.prompt }],
		tools,
		maxSteps: MAX_TOOL_ROUNDS_REPORT,
	});

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
