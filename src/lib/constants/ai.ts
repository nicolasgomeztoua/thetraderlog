// =============================================================================
// AI MODEL CONFIGURATION
// =============================================================================

/**
 * Default AI model used for chat mode
 * Kimi K2.5: 262K context, AIME 96.1%, HumanEval 99.0, $0.38/$1.72
 */
export const DEFAULT_CHAT_MODEL = "moonshotai/kimi-k2.5";

/**
 * Default AI model used for report generation
 * MiMo-V2-Pro: 1M context, 1T params MoE, #1 on OpenRouter, near Opus-level agentic
 * Pricing: $1.00/$3.00 per 1M tokens (input/output)
 */
export const DEFAULT_REPORT_MODEL = "xiaomi/mimo-v2-pro";

/**
 * Vision model used ONLY for chat turns that carry an image (e.g. a pasted chart
 * screenshot). Text-only turns keep using DEFAULT_CHAT_MODEL (Kimi is reasoning-first
 * and weak on small-text OCR). Qwen3-VL-8B leads the cheap-open tier on chart/number
 * OCR (OCRBench 896, DocVQA 96.1, ChartQA 90.3) at $0.08/$0.50 per 1M tokens.
 */
export const DEFAULT_VISION_MODEL = "qwen/qwen3-vl-8b-instruct";

/**
 * Accuracy escalation for vision turns when the 8B fumbles a decimal.
 * ~3B-active MoE, $0.13/$0.52 per 1M tokens. Documented fallback; not auto-routed yet.
 */
export const VISION_FALLBACK_MODEL = "qwen/qwen3-vl-30b-a3b-instruct";

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
 * Reasoning token budget for report phases (billed as output tokens)
 */
export const REPORT_REASONING_TOKENS = 16_000;

/**
 * Reasoning token budget for chat (lighter than reports for speed)
 */
export const CHAT_REASONING_TOKENS = 8_000;

/**
 * Maximum rows returned from AI SQL queries
 */
export const MAX_SQL_QUERY_ROWS = 500;

/**
 * Maximum OHLC bars returned from market data tool
 */
export const MAX_MARKET_DATA_BARS = 1000;

// =============================================================================
// CHAT IMAGE ATTACHMENTS (paste-a-chart-to-log)
// =============================================================================

/**
 * Max size for an image pasted/dropped into AI chat. Larger than bug-report
 * screenshots (5MB) because trading charts are often high-resolution.
 */
export const AI_CHAT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Allowed mime types for chat image attachments. GIF is excluded — charts are
 * static and animation only wastes vision tokens. All are accepted by Qwen3-VL.
 */
export const AI_CHAT_ALLOWED_IMAGE_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

/**
 * Maximum images attached to a single chat message.
 */
export const MAX_AI_CHAT_IMAGES = 4;

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
	"How am I doing on my prop challenge?",
	"Will I pass this challenge at my current pace?",
	"What's my risk of failing the challenge?",
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
	"Generate a prop challenge compliance report with drawdown analysis, daily loss tracking, and probability of passing",
] as const;
