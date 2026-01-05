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

export const instrumentTypeEnum = z.enum(["futures", "forex"]);
export type InstrumentType = z.infer<typeof instrumentTypeEnum>;

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

export const tradingPlatformEnum = z.enum([
	"mt4",
	"mt5",
	"projectx",
	"ninjatrader",
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
	instrumentType: instrumentTypeEnum,
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
});
