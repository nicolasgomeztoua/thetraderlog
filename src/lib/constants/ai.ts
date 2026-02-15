// =============================================================================
// AI MODEL CONFIGURATION
// =============================================================================

/**
 * Default AI model used for chat mode
 */
export const DEFAULT_CHAT_MODEL = "moonshotai/kimi-k2";

/**
 * Default AI model used for report generation
 */
export const DEFAULT_REPORT_MODEL = "z-ai/glm-5";

// =============================================================================
// AI MODE OPTIONS
// =============================================================================

/**
 * AI mode options for the mode switcher
 */
export const AI_MODES = [
	{
		value: "chat" as const,
		label: "Chat",
		description: "Ask quick questions about your trading data",
	},
	{
		value: "report" as const,
		label: "Report",
		description: "Generate deep analysis reports with charts",
	},
] as const;

// =============================================================================
// LIMITS
// =============================================================================

/**
 * Maximum messages allowed per conversation
 */
export const MAX_CHAT_MESSAGES_PER_CONVERSATION = 50;

/**
 * Maximum tokens for a single report generation run
 */
export const MAX_REPORT_TOKENS = 100_000;

/**
 * Maximum tool-calling rounds per chat message
 */
export const MAX_TOOL_ROUNDS_CHAT = 10;

/**
 * Maximum tool-calling rounds per report generation (more than chat)
 */
export const MAX_TOOL_ROUNDS_REPORT = 100;

/**
 * Maximum rows returned from AI SQL queries
 */
export const MAX_SQL_QUERY_ROWS = 500;

/**
 * Maximum OHLC bars returned from market data tool
 */
export const MAX_MARKET_DATA_BARS = 1000;

// =============================================================================
// SUGGESTED QUERIES & PROMPTS
// =============================================================================

/**
 * Suggested queries for empty chat conversations
 */
export const SUGGESTED_CHAT_QUERIES = [
	"What's my win rate this month compared to last month?",
	"Which trading session is most profitable for me?",
	"Show me my best and worst performing symbols",
	"Am I overtrading on losing days?",
	"What's my average R-multiple on winning trades?",
	"Do I perform better on specific days of the week?",
	"How has my equity curve trended over the last 90 days?",
	"What's my risk of ruin based on current performance?",
] as const;

/**
 * Suggested prompts for report mode
 */
export const SUGGESTED_REPORT_PROMPTS = [
	"Generate a comprehensive monthly performance review with equity curve analysis, win rate trends, and behavioral pattern insights",
	"Analyze my risk management across all accounts — compare position sizing, R-multiples, and drawdown patterns",
	"Create a detailed session-by-session breakdown showing where I'm leaving money on the table and where I'm most disciplined",
	"Build a strategy comparison report showing which setups have the best expectancy and which I should stop trading",
	"Analyze my revenge trading and overtrading patterns — show the data behind my worst days and what triggers them",
] as const;
