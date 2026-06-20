// =============================================================================
// AI MODEL CONFIGURATION
// =============================================================================

/**
 * User-selectable AI models (shown in the chat/report model dropdowns).
 *
 * These are the current top open-weight frontier models on OpenRouter as of
 * June 2026 — all 1M-context, agentic, and reasoning-capable. The same set is
 * offered for both chat and reports; only the default differs per use case.
 *
 * IMPORTANT: this list is the server-side allowlist. Any model the client can
 * select MUST live here — getModel() forwards the ID straight to OpenRouter, so
 * a free-form string would be an injection vector. Add the slug here first.
 */
export const AI_MODEL_OPTIONS = [
	{
		id: "deepseek/deepseek-v4-pro",
		label: "DeepSeek V4 Pro",
		description: "Frontier reasoning · 1M context · $0.44/$0.87",
	},
	{
		id: "xiaomi/mimo-v2.5-pro",
		label: "MiMo V2.5 Pro",
		description: "Agentic flagship · 1M context · $0.44/$0.87",
	},
	{
		id: "z-ai/glm-5.2",
		label: "GLM 5.2",
		description: "Most capable open model · 1M context · $1.20/$4.10",
	},
] as const;

/** Union of selectable OpenRouter model IDs. */
export type AiModelId = (typeof AI_MODEL_OPTIONS)[number]["id"];

/** Tuple of selectable model IDs — feed into z.enum() for server-side validation. */
export const AI_MODEL_IDS = AI_MODEL_OPTIONS.map((m) => m.id) as [
	AiModelId,
	...AiModelId[],
];

/**
 * Default AI model used for chat mode.
 * DeepSeek V4 Pro: 1M context, thinking/non-thinking modes, strong numeric
 * reasoning per dollar ($0.44/$0.87) — best fit for tool-heavy interactive Q&A.
 */
export const DEFAULT_CHAT_MODEL: AiModelId = "deepseek/deepseek-v4-pro";

/**
 * Default AI model used for report generation.
 * GLM 5.2: the most capable open-weight model (Jun 2026), 1M context, built for
 * long-horizon agentic workflows — quality-first for the deep report pipeline.
 */
export const DEFAULT_REPORT_MODEL: AiModelId = "z-ai/glm-5.2";

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
