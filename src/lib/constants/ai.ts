// =============================================================================
// AI MODEL CONFIGURATION
// =============================================================================

/**
 * AI model definition used in model selector dropdowns
 */
export type AiModel = {
	id: string;
	name: string;
	provider: string;
	description: string;
	mode: "chat" | "report" | "both";
};

/**
 * Default model for chat mode (fast, cheap)
 */
export const DEFAULT_CHAT_MODEL = "moonshotai/kimi-k2";

/**
 * Default model for report mode (deeper analysis)
 */
export const DEFAULT_REPORT_MODEL = "anthropic/claude-sonnet-4";

/**
 * Available AI models for the model selector
 */
export const AI_MODELS: AiModel[] = [
	{
		id: "moonshotai/kimi-k2",
		name: "Kimi K2",
		provider: "Moonshot",
		description: "Fast and cost-effective for quick questions",
		mode: "chat",
	},
	{
		id: "openai/gpt-4.1-mini",
		name: "GPT-4.1 Mini",
		provider: "OpenAI",
		description: "Balanced speed and quality for chat",
		mode: "chat",
	},
	{
		id: "anthropic/claude-sonnet-4",
		name: "Claude Sonnet 4",
		provider: "Anthropic",
		description: "Strong analytical reasoning for deep reports",
		mode: "both",
	},
	{
		id: "openai/gpt-4.1",
		name: "GPT-4.1",
		provider: "OpenAI",
		description: "High-quality analysis and reasoning",
		mode: "both",
	},
	{
		id: "google/gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		provider: "Google",
		description: "Strong reasoning with large context window",
		mode: "report",
	},
	{
		id: "anthropic/claude-haiku-4",
		name: "Claude Haiku 4",
		provider: "Anthropic",
		description: "Ultra-fast responses for simple queries",
		mode: "chat",
	},
];

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
