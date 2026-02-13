import { relations } from "drizzle-orm";
import {
	boolean,
	decimal,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTableCreator,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { ids } from "@/lib/shared";

export const createTable = pgTableCreator((name) => name);

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const instrumentTypeEnum = pgEnum("instrument_type", [
	"futures",
	"forex",
]);
export const tradeDirectionEnum = pgEnum("trade_direction", ["long", "short"]);
export const tradeStatusEnum = pgEnum("trade_status", ["open", "closed"]);
export const executionTypeEnum = pgEnum("execution_type", [
	"entry",
	"exit",
	"scale_in",
	"scale_out",
]);
export const emotionalStateEnum = pgEnum("emotional_state", [
	"confident",
	"fearful",
	"greedy",
	"neutral",
	"frustrated",
	"excited",
	"anxious",
]);
export const importSourceEnum = pgEnum("import_source", ["manual", "csv"]);
export const exitReasonEnum = pgEnum("exit_reason", [
	"manual", // Manually closed
	"stop_loss", // Hit original stop loss
	"trailing_stop", // Hit trailed stop loss
	"take_profit", // Hit take profit
	"time_based", // Time-based exit (e.g., end of session)
	"breakeven", // Moved to breakeven and stopped out
]);
export const accountTypeEnum = pgEnum("account_type", [
	"prop_challenge",
	"prop_funded",
	"live",
	"demo",
]);
export const drawdownTypeEnum = pgEnum("drawdown_type", [
	"trailing",
	"static",
	"eod",
]);
export const payoutFrequencyEnum = pgEnum("payout_frequency", [
	"weekly",
	"bi_weekly",
	"monthly",
]);
export const challengeStatusEnum = pgEnum("challenge_status", [
	"active",
	"passed",
	"failed",
]);
export const tradingPlatformEnum = pgEnum("trading_platform", [
	"mt4", // MetaTrader 4
	"mt5", // MetaTrader 5
	"projectx", // ProjectX
	"ninjatrader", // NinjaTrader (future)
	"other", // Manual/Other
]);
export const strategyRuleCategoryEnum = pgEnum("strategy_rule_category", [
	"entry",
	"exit",
	"risk",
	"management",
]);
export const ruleTypeEnum = pgEnum("rule_type", [
	"manual",
	"auto",
	"semi_auto",
]);
export const dataQualityEnum = pgEnum("data_quality", [
	"full", // Complete OHLC data for trade duration
	"partial", // Some bars missing (gaps in data)
	"unavailable", // No data found, MAE/MFE not calculated
	"pending", // Calculation queued but not yet completed
]);
export const aiConversationStatusEnum = pgEnum("ai_conversation_status", [
	"active",
	"generating",
	"complete",
	"failed",
]);
export const aiConversationModeEnum = pgEnum("ai_conversation_mode", [
	"chat",
	"report",
]);
export const aiReportStatusEnum = pgEnum("ai_report_status", [
	"queued",
	"generating",
	"complete",
	"failed",
]);

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = createTable(
	"user",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.user()),
		clerkId: text("clerk_id").notNull().unique(),
		email: text("email").notNull(),
		name: text("name"),
		imageUrl: text("image_url"),
		role: userRoleEnum("role").notNull().default("user"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [index("user_clerk_id_idx").on(t.clerkId)],
);

// ============================================================================
// ACCOUNT GROUPS TABLE (for copy trading)
// ============================================================================

export const accountGroups = createTable(
	"account_group",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.accountGroup()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(), // e.g., "Copy Trading Group A"
		description: text("description"),
		color: text("color").default("#6366f1"), // For UI distinction
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [index("account_group_user_id_idx").on(t.userId)],
);

// ============================================================================
// TRADING ACCOUNTS TABLE
// ============================================================================

export const accounts = createTable(
	"account",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.account()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		name: text("name").notNull(), // e.g., "Main Account", "Prop Firm"
		broker: text("broker"), // e.g., "IBKR", "Oanda", "ICMarkets"
		platform: tradingPlatformEnum("platform").notNull().default("other"), // Trading platform for CSV parsing
		accountType: accountTypeEnum("account_type").notNull().default("live"),

		// Balance tracking
		initialBalance: decimal("initial_balance", {
			precision: 20,
			scale: 2,
		}).default("0"),
		currency: text("currency").default("USD"),

		// Account identifiers
		accountNumber: text("account_number"), // Optional external account number

		// Status
		isActive: boolean("is_active").default(true),
		isDefault: boolean("is_default").default(false), // Default account for new trades

		// Metadata
		notes: text("notes"),
		color: text("color").default("#6366f1"), // For UI distinction

		// ========== PROP FIRM FIELDS ==========
		// Drawdown rules
		maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 2 }), // Max drawdown % (e.g., 6.00 for 6%)
		drawdownType: drawdownTypeEnum("drawdown_type"), // trailing, static, or eod
		dailyLossLimit: decimal("daily_loss_limit", { precision: 10, scale: 2 }), // Max daily loss %

		// Challenge rules (for prop_challenge accounts)
		profitTarget: decimal("profit_target", { precision: 10, scale: 2 }), // Profit target %
		consistencyRule: decimal("consistency_rule", { precision: 10, scale: 2 }), // Max single day profit as % of target
		minTradingDays: integer("min_trading_days"), // Minimum required trading days
		challengeStartDate: timestamp("challenge_start_date", {
			withTimezone: true,
		}), // When challenge started
		challengeEndDate: timestamp("challenge_end_date", { withTimezone: true }), // Challenge deadline
		challengeStatus: challengeStatusEnum("challenge_status"), // active, passed, failed

		// Funded account rules (for prop_funded accounts)
		profitSplit: decimal("profit_split", { precision: 10, scale: 2 }), // Profit sharing % (e.g., 80.00 for 80%)
		payoutFrequency: payoutFrequencyEnum("payout_frequency"), // weekly, bi_weekly, monthly

		// Account linking (funded → challenge) - self-referencing FK
		linkedAccountId: text("linked_account_id"),

		// Account groups (for copy trading)
		groupId: text("group_id").references(() => accountGroups.id, {
			onDelete: "set null",
		}),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		index("account_user_id_idx").on(t.userId),
		index("account_is_default_idx").on(t.isDefault),
		index("account_group_id_idx").on(t.groupId),
		index("account_linked_account_id_idx").on(t.linkedAccountId),
	],
);

// ============================================================================
// TRADES TABLE
// ============================================================================

export const trades = createTable(
	"trade",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.trade()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accountId: text("account_id").references(() => accounts.id, {
			onDelete: "set null",
		}),
		strategyId: text("strategy_id"), // FK added after strategies table is defined

		// Instrument info
		symbol: text("symbol").notNull(), // e.g., "ES", "NQ", "EUR/USD"
		instrumentType: instrumentTypeEnum("instrument_type").notNull(),

		// Trade direction and status
		direction: tradeDirectionEnum("direction").notNull(),
		status: tradeStatusEnum("status").notNull().default("open"),

		// Entry details
		entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
		entryTime: timestamp("entry_time", { withTimezone: true }).notNull(),

		// Exit details (null if trade is still open)
		exitPrice: decimal("exit_price", { precision: 20, scale: 8 }),
		exitTime: timestamp("exit_time", { withTimezone: true }),

		// Position size
		quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(), // lots or contracts

		// Risk management levels (planned)
		stopLoss: decimal("stop_loss", { precision: 20, scale: 8 }),
		takeProfit: decimal("take_profit", { precision: 20, scale: 8 }),

		// Actual outcome
		stopLossHit: boolean("stop_loss_hit").default(false),
		takeProfitHit: boolean("take_profit_hit").default(false),

		// Trailing stop support
		trailedStopLoss: decimal("trailed_stop_loss", { precision: 20, scale: 8 }), // Final trailed SL (if different from original)
		wasTrailed: boolean("was_trailed").default(false), // Whether SL was trailed during the trade

		// Exit reason tracking
		exitReason: exitReasonEnum("exit_reason"), // How the trade was closed

		// Partial exit tracking
		isPartiallyExited: boolean("is_partially_exited").default(false), // Has partial exits
		remainingQuantity: decimal("remaining_quantity", {
			precision: 20,
			scale: 8,
		}), // Remaining position after partials

		// P&L
		realizedPnl: decimal("realized_pnl", { precision: 20, scale: 2 }),
		fees: decimal("fees", { precision: 20, scale: 2 }).default("0"),
		netPnl: decimal("net_pnl", { precision: 20, scale: 2 }),

		// MAE/MFE Analysis (computed from market data)
		maePrice: decimal("mae_price", { precision: 20, scale: 8 }), // Price of max adverse excursion
		mfePrice: decimal("mfe_price", { precision: 20, scale: 8 }), // Price of max favorable excursion
		maeAmount: decimal("mae_amount", { precision: 20, scale: 2 }), // $ value of MAE
		mfeAmount: decimal("mfe_amount", { precision: 20, scale: 2 }), // $ value of MFE
		marketDataQuality: dataQualityEnum("market_data_quality"), // Quality of market data used for analysis

		// Trade metadata
		setupType: text("setup_type"), // e.g., "breakout", "reversal", "trend_continuation"
		emotionalState: emotionalStateEnum("emotional_state"),
		notes: text("notes"),

		// Rating and review (Phase 1 enhancements)
		rating: integer("rating"), // 1-5 stars
		isReviewed: boolean("is_reviewed").default(false),

		// Import tracking
		importSource: importSourceEnum("import_source").notNull().default("manual"),
		externalId: text("external_id"), // For tracking imported trades
		tradeHash: text("trade_hash"), // SHA-256 hash for duplicate detection on CSV imports

		// Soft delete
		deletedAt: timestamp("deleted_at", { withTimezone: true }),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		index("trade_user_id_idx").on(t.userId),
		index("trade_account_id_idx").on(t.accountId),
		index("trade_strategy_id_idx").on(t.strategyId),
		index("trade_symbol_idx").on(t.symbol),
		index("trade_entry_time_idx").on(t.entryTime),
		index("trade_status_idx").on(t.status),
		index("trade_deleted_at_idx").on(t.deletedAt),
		index("trade_hash_idx").on(t.tradeHash),
	],
);

// ============================================================================
// TRADE EXECUTIONS TABLE (for scaling in/out)
// ============================================================================

export const tradeExecutions = createTable(
	"trade_execution",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.execution()),
		tradeId: text("trade_id")
			.notNull()
			.references(() => trades.id, { onDelete: "cascade" }),

		executionType: executionTypeEnum("execution_type").notNull(),
		price: decimal("price", { precision: 20, scale: 8 }).notNull(),
		quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
		executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
		fees: decimal("fees", { precision: 20, scale: 2 }).default("0"),

		// P&L for this specific execution (for partial exits)
		realizedPnl: decimal("realized_pnl", { precision: 20, scale: 2 }),

		// Notes for this execution
		notes: text("notes"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("execution_trade_id_idx").on(t.tradeId)],
);

// ============================================================================
// TAGS TABLE
// ============================================================================

export const tags = createTable(
	"tag",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.tag()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color").default("#6366f1"), // Default indigo
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("tag_user_id_idx").on(t.userId)],
);

// ============================================================================
// TRADE TAGS (junction table)
// ============================================================================

export const tradeTags = createTable(
	"trade_tag",
	{
		tradeId: text("trade_id")
			.notNull()
			.references(() => trades.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ columns: [t.tradeId, t.tagId] }),
		index("trade_tag_trade_id_idx").on(t.tradeId),
		index("trade_tag_tag_id_idx").on(t.tagId),
	],
);

// ============================================================================
// USER SETTINGS TABLE
// ============================================================================

export const userSettings = createTable("user_settings", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => ids.settings()),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),

	// AI Provider API Keys (encrypted in application layer)
	openaiApiKey: text("openai_api_key"),
	anthropicApiKey: text("anthropic_api_key"),
	googleApiKey: text("google_api_key"),

	// Preferred AI provider
	preferredAiProvider: text("preferred_ai_provider").default("openai"),

	// Trading preferences
	defaultInstrumentType: instrumentTypeEnum("default_instrument_type").default(
		"futures",
	),
	timezone: text("timezone").default("UTC"),
	breakevenThreshold: decimal("breakeven_threshold", {
		precision: 10,
		scale: 2,
	}).default("3.00"), // P&L within ±$X is considered breakeven

	// Display preferences
	currency: text("currency").default("USD"),
	theme: text("theme").default("terminal"), // Theme ID (e.g., "terminal", "midnight", "paper")

	// Trade log column preferences (JSON array of column configs)
	tradeLogColumns: text("trade_log_columns"), // JSON string of column visibility/order
	tradeLogSort: text("trade_log_sort"), // JSON string of { field, direction }

	// Trading sessions (JSON array of session configs)
	// [{ name: "Asia", startHour: 0, endHour: 8, color: "#00d4ff" }, ...]
	tradingSessions: text("trading_sessions"), // JSON string of session definitions

	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
		() => new Date(),
	),
});

// ============================================================================
// FILTER PRESETS TABLE (for saved analytics filters)
// ============================================================================

export const filterPresets = createTable(
	"filter_preset",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.filterPreset()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		filters: text("filters").notNull(), // JSON string of AnalyticsFilters
		isDefault: boolean("is_default").default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		index("filter_preset_user_id_idx").on(t.userId),
		index("filter_preset_is_default_idx").on(t.isDefault),
	],
);

// ============================================================================
// AI CONVERSATIONS TABLE
// ============================================================================

export const aiConversations = createTable(
	"ai_conversation",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.conversation()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		title: text("title"),
		status: aiConversationStatusEnum("status").notNull().default("active"),
		mode: aiConversationModeEnum("mode"),
		initialPrompt: text("initial_prompt"),
		dateRangeStart: timestamp("date_range_start", { withTimezone: true }),
		dateRangeEnd: timestamp("date_range_end", { withTimezone: true }),
		model: text("model"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [index("conversation_user_id_idx").on(t.userId)],
);

// ============================================================================
// AI MESSAGES TABLE
// ============================================================================

export const aiMessages = createTable(
	"ai_message",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.message()),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => aiConversations.id, { onDelete: "cascade" }),
		role: text("role").notNull(), // "user", "assistant", or "system"
		content: text("content").notNull(),
		model: text("model"), // Model used for this message (assistant messages)
		tokensUsed: integer("tokens_used"), // Token count for this message
		toolCalls: text("tool_calls"), // JSON string of tool calls made
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("message_conversation_id_idx").on(t.conversationId)],
);

// ============================================================================
// AI REPORTS TABLE
// ============================================================================

export const aiReports = createTable(
	"ai_report",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.aiReport()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => aiConversations.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		prompt: text("prompt").notNull(),
		model: text("model").notNull(),
		status: aiReportStatusEnum("status").notNull().default("queued"),
		content: text("content"),
		dataArtifacts: jsonb("data_artifacts").$type<Record<string, unknown>>(),
		tokensUsed: integer("tokens_used").notNull().default(0),
		triggerTaskId: text("trigger_task_id"),
		errorMessage: text("error_message"),
		progressStage: text("progress_stage").default("queued"),
		currentRound: integer("current_round").default(0),
		totalToolCalls: integer("total_tool_calls").default(0),
		chartsGenerated: integer("charts_generated").default(0),
		progressDetail: text("progress_detail"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(t) => [
		index("ai_report_user_id_idx").on(t.userId),
		index("ai_report_conversation_id_idx").on(t.conversationId),
		index("ai_report_status_idx").on(t.status),
	],
);

// ============================================================================
// STRATEGIES TABLE
// ============================================================================

export const strategies = createTable(
	"strategy",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.strategy()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		// Basic info
		name: text("name").notNull(),
		description: text("description"),
		color: text("color").default("#d4ff00"), // Primary chartreuse

		// Strategy documentation
		entryCriteria: text("entry_criteria"), // Rich text for entry rules
		exitRules: text("exit_rules"), // Rich text for exit rules

		// Risk management (JSON)
		// { positionSizing: { method, fixedSize, riskPercent, kellyFraction },
		//   maxRiskPerTrade: { type, value }, dailyLossLimit: { type, value },
		//   maxConcurrentPositions, minRRRatio, targetRMultiples }
		riskParameters: text("risk_parameters"), // JSON string

		// Scaling rules (JSON)
		// { scaleIn: [{ trigger, sizePercent }], scaleOut: [{ trigger, sizePercent }] }
		scalingRules: text("scaling_rules"), // JSON string

		// Trailing stop rules (JSON)
		// { moveToBreakeven: { triggerR, offsetTicks }, trailStops: [{ triggerR, method, value }] }
		trailingRules: text("trailing_rules"), // JSON string

		// Status
		isActive: boolean("is_active").default(true),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		index("strategy_user_id_idx").on(t.userId),
		index("strategy_is_active_idx").on(t.isActive),
	],
);

// ============================================================================
// STRATEGY RULES TABLE (checklist items)
// ============================================================================

export const strategyRules = createTable(
	"strategy_rule",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.strategyRule()),
		strategyId: text("strategy_id")
			.notNull()
			.references(() => strategies.id, { onDelete: "cascade" }),

		text: text("text").notNull(), // The rule text
		category: strategyRuleCategoryEnum("category").notNull().default("entry"),
		order: integer("order").notNull().default(0), // For sorting

		// Auto-evaluation fields
		ruleType: ruleTypeEnum("rule_type").notNull().default("manual"), // manual, auto, or semi_auto
		configSource: text("config_source"), // Source config path (e.g., 'riskParameters.maxRiskPerTrade')
		autoCondition: text("auto_condition"), // JSON evaluation parameters
		isGenerated: boolean("is_generated").notNull().default(false), // Whether rule was auto-generated from config
		sourceConfigHash: text("source_config_hash"), // Hash for change detection

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [
		index("strategy_rule_strategy_id_idx").on(t.strategyId),
		index("strategy_rule_category_idx").on(t.category),
		index("strategy_rule_is_generated_idx").on(t.isGenerated),
	],
);

// ============================================================================
// TRADE RULE CHECKS TABLE (junction: tracks which rules were checked per trade)
// ============================================================================

export const tradeRuleChecks = createTable(
	"trade_rule_check",
	{
		tradeId: text("trade_id")
			.notNull()
			.references(() => trades.id, { onDelete: "cascade" }),
		ruleId: text("rule_id")
			.notNull()
			.references(() => strategyRules.id, { onDelete: "cascade" }),

		checked: boolean("checked").notNull().default(false),
		checkedAt: timestamp("checked_at", { withTimezone: true }),

		// Auto-evaluation fields
		evaluationResult: text("evaluation_result"), // JSON with evaluation details (actual, expected, dataQuality, etc.)
		wasAutoEvaluated: boolean("was_auto_evaluated").notNull().default(false), // Whether this check was auto-evaluated
		userOverride: boolean("user_override"), // Nullable - if set, user overrode the auto-evaluation result
	},
	(t) => [
		primaryKey({ columns: [t.tradeId, t.ruleId] }),
		index("trade_rule_check_trade_id_idx").on(t.tradeId),
		index("trade_rule_check_rule_id_idx").on(t.ruleId),
	],
);

// ============================================================================
// DAILY JOURNALS TABLE
// ============================================================================

export const dailyJournals = createTable(
	"daily_journal",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.dailyJournal()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		date: timestamp("date", { withTimezone: true }).notNull(), // Date of the journal (normalized to midnight)
		content: text("content"), // Rich text content (HTML from Tiptap)
		contentFormat: text("content_format").default("html"), // Format: "html", "markdown", etc.
		dayStartedAt: timestamp("day_started_at", { withTimezone: true }), // When user clicked "Start My Journal"
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		index("daily_journal_user_id_idx").on(t.userId),
		uniqueIndex("daily_journal_user_date_idx").on(t.userId, t.date),
	],
);

// ============================================================================
// DAILY CHECKLIST TEMPLATES TABLE
// ============================================================================

export const dailyChecklistTemplates = createTable(
	"daily_checklist_template",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.checklistTemplate()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		text: text("text").notNull(), // The checklist item text
		order: integer("order").notNull().default(0), // For sorting items
		isActive: boolean("is_active").notNull().default(true), // Whether to show in daily checklist
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("daily_checklist_template_user_id_idx").on(t.userId)],
);

// ============================================================================
// DAILY CHECKLIST CHECKS TABLE
// ============================================================================

export const dailyChecklistChecks = createTable(
	"daily_checklist_check",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.checklistCheck()),
		journalId: text("journal_id")
			.notNull()
			.references(() => dailyJournals.id, { onDelete: "cascade" }),
		// For user-created template checks (nullable - either templateId OR forcedItemId must be set)
		templateId: text("template_id").references(
			() => dailyChecklistTemplates.id,
			{
				onDelete: "cascade",
			},
		),
		// For system-level forced checks like "Pre Market Check" (e.g., "forced-pre-market")
		forcedItemId: text("forced_item_id"),
		checked: boolean("checked").notNull().default(false),
		checkedAt: timestamp("checked_at", { withTimezone: true }),
	},
	(t) => [
		// Unique constraint: one check per journal+template OR journal+forcedItem
		uniqueIndex("daily_checklist_check_journal_template_idx").on(
			t.journalId,
			t.templateId,
		),
		uniqueIndex("daily_checklist_check_journal_forced_idx").on(
			t.journalId,
			t.forcedItemId,
		),
		index("daily_checklist_check_journal_id_idx").on(t.journalId),
	],
);

// ============================================================================
// JOURNAL ATTACHMENTS TABLE
// ============================================================================

export const journalAttachments = createTable(
	"journal_attachment",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.journalAttachment()),
		journalId: text("journal_id")
			.notNull()
			.references(() => dailyJournals.id, { onDelete: "cascade" }),
		url: text("url").notNull(), // S3/CDN URL
		key: text("key").notNull(), // S3 object key
		filename: text("filename").notNull(), // Original filename
		mimeType: text("mime_type").notNull(), // e.g., "image/png"
		size: integer("size").notNull(), // File size in bytes
		caption: text("caption"), // Optional caption
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("journal_attachment_journal_id_idx").on(t.journalId)],
);

// ============================================================================
// TRADE ATTACHMENTS TABLE
// ============================================================================

export const tradeAttachments = createTable(
	"trade_attachment",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.tradeAttachment()),
		tradeId: text("trade_id")
			.notNull()
			.references(() => trades.id, { onDelete: "cascade" }),
		url: text("url").notNull(), // S3/CDN URL (stores S3 key for presigned URL generation)
		key: text("key").notNull(), // S3 object key
		filename: text("filename").notNull(), // Original filename
		mimeType: text("mime_type").notNull(), // e.g., "image/png"
		size: integer("size").notNull(), // File size in bytes
		caption: text("caption"), // Optional caption
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("trade_attachment_trade_id_idx").on(t.tradeId)],
);

// ============================================================================
// CANDLE CACHE TABLE (for market data caching)
// ============================================================================

export const candleCache = createTable(
	"candle_cache",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ids.candleCache()),
		symbol: text("symbol").notNull(), // e.g., "ES", "MNQ", "EUR/USD"
		interval: text("interval").notNull(), // "1min", "5min", "15min", "1h"
		date: timestamp("date", { withTimezone: true }).notNull(), // Day of data (normalized to midnight UTC)
		bars: text("bars").notNull(), // JSON array of OHLC bars
		barCount: integer("bar_count").notNull(), // Quick count without parsing JSON
		source: text("source").notNull(), // "twelve_data", "polygon"
		fetchedAt: timestamp("fetched_at", { withTimezone: true })
			.notNull()
			.$defaultFn(() => new Date()),
		// No expiresAt - data persists forever for historical lookups
	},
	(t) => [
		// Unique constraint on symbol+interval+date = our cache key
		uniqueIndex("candle_cache_lookup_idx").on(t.symbol, t.interval, t.date),
		// Index for queries by symbol
		index("candle_cache_symbol_idx").on(t.symbol),
	],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
	accounts: many(accounts),
	accountGroups: many(accountGroups),
	trades: many(trades),
	tags: many(tags),
	settings: one(userSettings),
	aiConversations: many(aiConversations),
	aiReports: many(aiReports),
	filterPresets: many(filterPresets),
	strategies: many(strategies),
	dailyJournals: many(dailyJournals),
	dailyChecklistTemplates: many(dailyChecklistTemplates),
}));

export const filterPresetsRelations = relations(filterPresets, ({ one }) => ({
	user: one(users, {
		fields: [filterPresets.userId],
		references: [users.id],
	}),
}));

export const accountGroupsRelations = relations(
	accountGroups,
	({ one, many }) => ({
		user: one(users, {
			fields: [accountGroups.userId],
			references: [users.id],
		}),
		accounts: many(accounts),
	}),
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
	trades: many(trades),
	group: one(accountGroups, {
		fields: [accounts.groupId],
		references: [accountGroups.id],
	}),
	linkedAccount: one(accounts, {
		fields: [accounts.linkedAccountId],
		references: [accounts.id],
		relationName: "linkedAccounts",
	}),
	linkedFromAccounts: many(accounts, {
		relationName: "linkedAccounts",
	}),
}));

export const tradesRelations = relations(trades, ({ one, many }) => ({
	user: one(users, {
		fields: [trades.userId],
		references: [users.id],
	}),
	account: one(accounts, {
		fields: [trades.accountId],
		references: [accounts.id],
	}),
	strategy: one(strategies, {
		fields: [trades.strategyId],
		references: [strategies.id],
	}),
	executions: many(tradeExecutions),
	tradeTags: many(tradeTags),
	ruleChecks: many(tradeRuleChecks),
	attachments: many(tradeAttachments),
}));

export const tradeExecutionsRelations = relations(
	tradeExecutions,
	({ one }) => ({
		trade: one(trades, {
			fields: [tradeExecutions.tradeId],
			references: [trades.id],
		}),
	}),
);

export const tagsRelations = relations(tags, ({ one, many }) => ({
	user: one(users, {
		fields: [tags.userId],
		references: [users.id],
	}),
	tradeTags: many(tradeTags),
}));

export const tradeTagsRelations = relations(tradeTags, ({ one }) => ({
	trade: one(trades, {
		fields: [tradeTags.tradeId],
		references: [trades.id],
	}),
	tag: one(tags, {
		fields: [tradeTags.tagId],
		references: [tags.id],
	}),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
	user: one(users, {
		fields: [userSettings.userId],
		references: [users.id],
	}),
}));

export const aiConversationsRelations = relations(
	aiConversations,
	({ one, many }) => ({
		user: one(users, {
			fields: [aiConversations.userId],
			references: [users.id],
		}),
		messages: many(aiMessages),
		reports: many(aiReports),
	}),
);

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
	conversation: one(aiConversations, {
		fields: [aiMessages.conversationId],
		references: [aiConversations.id],
	}),
}));

export const aiReportsRelations = relations(aiReports, ({ one }) => ({
	user: one(users, {
		fields: [aiReports.userId],
		references: [users.id],
	}),
	conversation: one(aiConversations, {
		fields: [aiReports.conversationId],
		references: [aiConversations.id],
	}),
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
	user: one(users, {
		fields: [strategies.userId],
		references: [users.id],
	}),
	rules: many(strategyRules),
	trades: many(trades),
}));

export const strategyRulesRelations = relations(
	strategyRules,
	({ one, many }) => ({
		strategy: one(strategies, {
			fields: [strategyRules.strategyId],
			references: [strategies.id],
		}),
		tradeChecks: many(tradeRuleChecks),
	}),
);

export const tradeRuleChecksRelations = relations(
	tradeRuleChecks,
	({ one }) => ({
		trade: one(trades, {
			fields: [tradeRuleChecks.tradeId],
			references: [trades.id],
		}),
		rule: one(strategyRules, {
			fields: [tradeRuleChecks.ruleId],
			references: [strategyRules.id],
		}),
	}),
);

export const dailyJournalsRelations = relations(
	dailyJournals,
	({ one, many }) => ({
		user: one(users, {
			fields: [dailyJournals.userId],
			references: [users.id],
		}),
		checklistChecks: many(dailyChecklistChecks),
		attachments: many(journalAttachments),
	}),
);

export const dailyChecklistTemplatesRelations = relations(
	dailyChecklistTemplates,
	({ one, many }) => ({
		user: one(users, {
			fields: [dailyChecklistTemplates.userId],
			references: [users.id],
		}),
		checks: many(dailyChecklistChecks),
	}),
);

export const dailyChecklistChecksRelations = relations(
	dailyChecklistChecks,
	({ one }) => ({
		journal: one(dailyJournals, {
			fields: [dailyChecklistChecks.journalId],
			references: [dailyJournals.id],
		}),
		template: one(dailyChecklistTemplates, {
			fields: [dailyChecklistChecks.templateId],
			references: [dailyChecklistTemplates.id],
		}),
	}),
);

export const journalAttachmentsRelations = relations(
	journalAttachments,
	({ one }) => ({
		journal: one(dailyJournals, {
			fields: [journalAttachments.journalId],
			references: [dailyJournals.id],
		}),
	}),
);

export const tradeAttachmentsRelations = relations(
	tradeAttachments,
	({ one }) => ({
		trade: one(trades, {
			fields: [tradeAttachments.tradeId],
			references: [trades.id],
		}),
	}),
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AccountGroup = typeof accountGroups.$inferSelect;
export type NewAccountGroup = typeof accountGroups.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type TradeExecution = typeof tradeExecutions.$inferSelect;
export type NewTradeExecution = typeof tradeExecutions.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;
export type AiReport = typeof aiReports.$inferSelect;
export type NewAiReport = typeof aiReports.$inferInsert;
export type FilterPreset = typeof filterPresets.$inferSelect;
export type NewFilterPreset = typeof filterPresets.$inferInsert;
export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;
export type StrategyRule = typeof strategyRules.$inferSelect;
export type NewStrategyRule = typeof strategyRules.$inferInsert;
export type TradeRuleCheck = typeof tradeRuleChecks.$inferSelect;
export type NewTradeRuleCheck = typeof tradeRuleChecks.$inferInsert;
export type CandleCache = typeof candleCache.$inferSelect;
export type NewCandleCache = typeof candleCache.$inferInsert;
export type DailyJournal = typeof dailyJournals.$inferSelect;
export type NewDailyJournal = typeof dailyJournals.$inferInsert;
export type DailyChecklistTemplate =
	typeof dailyChecklistTemplates.$inferSelect;
export type NewDailyChecklistTemplate =
	typeof dailyChecklistTemplates.$inferInsert;
export type DailyChecklistCheck = typeof dailyChecklistChecks.$inferSelect;
export type NewDailyChecklistCheck = typeof dailyChecklistChecks.$inferInsert;
export type JournalAttachment = typeof journalAttachments.$inferSelect;
export type NewJournalAttachment = typeof journalAttachments.$inferInsert;
export type TradeAttachment = typeof tradeAttachments.$inferSelect;
export type NewTradeAttachment = typeof tradeAttachments.$inferInsert;
