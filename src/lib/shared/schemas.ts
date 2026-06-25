// =============================================================================
// SHARED ZOD SCHEMAS
// Centralized validation schemas to prevent enum drift and reduce duplication
// These must match the PostgreSQL enums defined in server/db/schema.ts
// =============================================================================

import { z } from "zod";

// =============================================================================
// TRADE ENUMS
// =============================================================================

export const directionEnum = z.enum(["long", "short"]);
export type Direction = z.infer<typeof directionEnum>;

export const tradeStatusEnum = z.enum(["open", "closed"]);
export type TradeStatus = z.infer<typeof tradeStatusEnum>;

export const emotionalStateEnum = z.enum([
	"confident",
	"fearful",
	"greedy",
	"neutral",
	"frustrated",
	"excited",
	"anxious",
]);
export type EmotionalState = z.infer<typeof emotionalStateEnum>;

export const exitReasonEnum = z.enum([
	"manual",
	"stop_loss",
	"trailing_stop",
	"take_profit",
	"time_based",
	"breakeven",
]);
export type ExitReason = z.infer<typeof exitReasonEnum>;

export const executionTypeEnum = z.enum([
	"entry",
	"exit",
	"scale_in",
	"scale_out",
]);
export type ExecutionType = z.infer<typeof executionTypeEnum>;

export const importSourceEnum = z.enum(["manual", "csv"]);
export type ImportSource = z.infer<typeof importSourceEnum>;

// =============================================================================
// ACCOUNT ENUMS
// =============================================================================

export const accountTypeEnum = z.enum([
	"prop_challenge",
	"prop_funded",
	"live",
	"demo",
]);
export type AccountType = z.infer<typeof accountTypeEnum>;

export const drawdownTypeEnum = z.enum(["trailing", "static", "eod"]);
export type DrawdownType = z.infer<typeof drawdownTypeEnum>;

export const payoutFrequencyEnum = z.enum(["weekly", "bi_weekly", "monthly"]);
export type PayoutFrequency = z.infer<typeof payoutFrequencyEnum>;

export const challengeStatusEnum = z.enum(["active", "passed", "failed"]);
export type ChallengeStatus = z.infer<typeof challengeStatusEnum>;

// --- Expanded prop model (2026). String values MUST match the db pgEnums in
// src/server/db/schema.ts and the constants in src/lib/constants/prop.ts. ---
export const drawdownAnchorEnum = z.enum(["static", "trailing"]);
export const drawdownHighWaterSourceEnum = z.enum([
	"intraday_unrealized",
	"eod_realized",
]);
export const drawdownLockEnum = z.enum([
	"none",
	"at_start",
	"at_start_plus_buffer",
]);
export const drawdownBasisEnum = z.enum([
	"balance_realized",
	"equity_unrealized",
]);
export const dailyLossAnchorEnum = z.enum([
	"static_from_initial",
	"from_day_start_balance",
]);
export const consistencyRuleTypeEnum = z.enum([
	"off",
	"best_day_pct_of_total",
	"best_day_pct_of_target",
	"per_trade_pct_of_total",
	"top_days_ratio",
	"best_day_pct_of_positive_days",
]);
export const consistencyWindowEnum = z.enum([
	"full_evaluation",
	"since_last_payout",
	"fixed_cycle",
]);
export const consistencyComparatorEnum = z.enum(["lt", "lte"]);
export const consistencyPhaseEnum = z.enum([
	"evaluation_only",
	"funded_only",
	"both",
]);
export const qualifyingDayModeEnum = z.enum([
	"any_trade",
	"any_positive",
	"min_profit_abs",
	"min_profit_pct",
]);
export const payoutCycleTypeEnum = z.enum([
	"winning_days",
	"calendar_days",
	"hours",
]);
export const bufferTypeEnum = z.enum(["none", "start_plus_drawdown"]);
export const scalingBasisEnum = z.enum(["eod_balance", "profit_from_start"]);
export const scalingAppliesAtEnum = z.enum([
	"next_session",
	"next_day",
	"immediate",
]);

export const tradingPlatformEnum = z.enum([
	"projectx",
	"topstepx",
	"ninjatrader",
	"tradovate",
	"rithmic",
	"apex",
	"other",
]);
export type TradingPlatform = z.infer<typeof tradingPlatformEnum>;

// =============================================================================
// STRATEGY ENUMS
// =============================================================================

export const strategyRuleCategoryEnum = z.enum([
	"entry",
	"exit",
	"risk",
	"management",
]);
export type StrategyRuleCategory = z.infer<typeof strategyRuleCategoryEnum>;

// =============================================================================
// COMMON SCHEMA FRAGMENTS
// Reusable partial schemas for building input validation
// =============================================================================

/**
 * Base trade fields used in both create and update schemas
 */
export const tradeBaseFields = {
	symbol: z.string().min(1),
	direction: directionEnum,
	entryPrice: z.string(),
	quantity: z.string(),
	stopLoss: z.string().optional(),
	takeProfit: z.string().optional(),
	fees: z.string().optional(),
	setupType: z.string().optional(),
	emotionalState: emotionalStateEnum.optional(),
	notes: z.string().optional(),
} as const;

/**
 * Prop firm fields schema (for account creation/update)
 */
export const propFieldsSchema = z.object({
	// --- Legacy fields (retained for back-compat) ---
	maxDrawdown: z.string().optional(),
	drawdownType: drawdownTypeEnum.optional(),
	dailyLossLimit: z.string().optional(),
	profitTarget: z.string().optional(),
	consistencyRule: z.string().optional(),
	minTradingDays: z.number().optional(),
	challengeStartDate: z.string().optional(),
	challengeEndDate: z.string().optional(),
	challengeStatus: challengeStatusEnum.optional(),
	profitSplit: z.string().optional(),
	payoutFrequency: payoutFrequencyEnum.optional(),
	linkedAccountId: z.string().optional(),
	groupId: z.string().optional(),

	// --- Expanded 2026 model. Keys match accounts table columns so create/update
	// can spread them straight into the insert/update. Decimals are strings,
	// integers are numbers. See docs/PROP_COMPLIANCE_RESEARCH.md. ---
	propPresetId: z.string().optional(),

	// Drawdown: 4 axes
	drawdownAnchor: drawdownAnchorEnum.optional(),
	drawdownHighWaterSource: drawdownHighWaterSourceEnum.optional(),
	drawdownLock: drawdownLockEnum.optional(),
	drawdownLockBuffer: z.string().optional(),
	drawdownBasis: drawdownBasisEnum.optional(),
	maxDrawdownAbsolute: z.string().optional(),

	// Daily loss
	dailyLossAnchor: dailyLossAnchorEnum.optional(),
	dailyLossBasis: drawdownBasisEnum.optional(),
	dailyLossFailsAccount: z.boolean().optional(),
	dailyLossResetTime: z.string().optional(),
	dailyLossTimezone: z.string().optional(),

	// Eval target / timeline
	profitTargetAbsolute: z.string().optional(),
	evalMaxDays: z.number().optional(),

	// Qualifying trading day
	qualifyingDayMode: qualifyingDayModeEnum.optional(),
	qualifyingDayMinProfit: z.string().optional(),
	dayBoundaryTimezone: z.string().optional(),
	dayResetTime: z.string().optional(),
	inactivityLimitDays: z.number().optional(),
	inactivityLimitDaysEval: z.number().optional(),

	// Consistency (typed)
	consistencyRuleType: consistencyRuleTypeEnum.optional(),
	consistencyWindow: consistencyWindowEnum.optional(),
	consistencyComparator: consistencyComparatorEnum.optional(),
	consistencyPhase: consistencyPhaseEnum.optional(),
	consistencyExpiresAfterPayouts: z.number().optional(),
	consistencyTiers: z.string().optional(),

	// Payout eligibility (funded)
	winningDayThreshold: z.string().optional(),
	winningDaysRequired: z.number().optional(),
	payoutCycleType: payoutCycleTypeEnum.optional(),
	payoutCycleLength: z.number().optional(),
	firstPayoutWaitDays: z.number().optional(),
	bufferType: bufferTypeEnum.optional(),
	payoutRequiresBufferCleared: z.boolean().optional(),
	minWithdrawal: z.string().optional(),
	accountSize: z.string().optional(),
	safetyNetBuffer: z.string().optional(),
	firstPayoutCaps: z.string().optional(),
	maxLifetimePayouts: z.number().optional(),
	payoutConsistencyPct: z.string().optional(),
	profitSplitTiers: z.string().optional(),
	lifetimeBonusThreshold: z.string().optional(),
	activationFee: z.string().optional(),

	// Position / scaling
	maxContracts: z.number().optional(),
	microToMiniRatio: z.number().optional(),
	maxLotsFx: z.string().optional(),
	maxLotsMetalsIndices: z.string().optional(),
	maxOpenPositions: z.number().optional(),
	maxRiskPerTradePct: z.string().optional(),
	stopLossRequired: z.boolean().optional(),
	maxMarginPct: z.string().optional(),
	scalingPlan: z.string().optional(),
	scalingBasis: scalingBasisEnum.optional(),
	scalingAppliesAt: scalingAppliesAtEnum.optional(),

	// Conduct / time
	sessionFlatEnabled: z.boolean().optional(),
	sessionFlatTime: z.string().optional(),
	sessionFlatTimezone: z.string().optional(),
	weekendHoldingAllowed: z.boolean().optional(),
	overnightHoldingAllowed: z.boolean().optional(),
	minHoldSeconds: z.number().optional(),
	quickStrikeProfitPct: z.string().optional(),
	maxTradesPerDay: z.number().optional(),
	newsBlackoutEnabled: z.boolean().optional(),
	newsBlackoutMinutesBefore: z.number().optional(),
	newsBlackoutMinutesAfter: z.number().optional(),
	prohibitedStrategiesAck: z.string().optional(),
});
