// =============================================================================
// SHARED TYPE DEFINITIONS
// Inferred from Drizzle schema for type safety across the application
// =============================================================================

import type { InferSelectModel } from "drizzle-orm";
import type {
	accounts,
	strategies,
	strategyRules,
	tags,
	tradeAttachments,
	tradeExecutions,
	tradeRuleChecks,
	trades,
	tradeTags,
} from "@/server/db/schema";

// =============================================================================
// BASE TYPES (inferred from Drizzle schema)
// =============================================================================

export type Trade = InferSelectModel<typeof trades>;
export type TradeExecution = InferSelectModel<typeof tradeExecutions>;
export type TradeTag = InferSelectModel<typeof tradeTags>;
export type Tag = InferSelectModel<typeof tags>;
export type Account = InferSelectModel<typeof accounts>;
export type Strategy = InferSelectModel<typeof strategies>;
export type StrategyRule = InferSelectModel<typeof strategyRules>;
export type TradeRuleCheck = InferSelectModel<typeof tradeRuleChecks>;
export type TradeAttachment = InferSelectModel<typeof tradeAttachments>;

// =============================================================================
// RELATION TYPES
// =============================================================================

/**
 * Trade tag with resolved tag relation
 */
export type TradeTagWithTag = TradeTag & {
	tag: Tag;
};

/**
 * Trade with all relations loaded
 */
export type TradeWithRelations = Trade & {
	executions?: TradeExecution[];
	tradeTags?: TradeTagWithTag[];
	strategy?: Strategy | null;
	account?: Account | null;
	ruleChecks?: TradeRuleCheck[];
};

/**
 * Strategy with rules loaded
 */
export type StrategyWithRules = Strategy & {
	rules: StrategyRule[];
};

// =============================================================================
// COMPONENT-SPECIFIC TYPES
// Use Pick/Omit to create minimal types for specific components
// =============================================================================

/**
 * Minimal trade data for stats panel
 */
export type TradeForStatsPanel = Pick<
	Trade,
	| "id"
	| "symbol"
	| "direction"
	| "status"
	| "instrumentType"
	| "quantity"
	| "entryPrice"
	| "exitPrice"
	| "entryTime"
	| "exitTime"
	| "stopLoss"
	| "takeProfit"
	| "fees"
	| "netPnl"
	| "rating"
	| "strategyId"
	| "wasTrailed"
	| "trailedStopLoss"
	| "emotionalState"
	| "exitReason"
	// MAE/MFE Analysis
	| "maePrice"
	| "mfePrice"
	| "maeAmount"
	| "mfeAmount"
	| "marketDataQuality"
> & {
	executions?: TradeExecution[];
	tradeTags?: TradeTagWithTag[];
};

/**
 * Minimal trade data for content panel (chart, notes)
 */
export type TradeForContentPanel = Pick<
	Trade,
	| "id"
	| "symbol"
	| "direction"
	| "status"
	| "instrumentType"
	| "entryPrice"
	| "exitPrice"
	| "stopLoss"
	| "takeProfit"
	| "notes"
	| "quantity"
	// Chart visualization fields
	| "entryTime"
	| "exitTime"
	| "wasTrailed"
	| "trailedStopLoss"
	// MAE/MFE visualization
	| "maePrice"
	| "mfePrice"
> & {
	tradeTags?: TradeTagWithTag[];
	executions?: TradeExecution[];
	attachments?: TradeAttachment[];
};

/**
 * Minimal trade data for trade log table row
 */
export type TradeForTable = Pick<
	Trade,
	| "id"
	| "symbol"
	| "direction"
	| "status"
	| "instrumentType"
	| "entryPrice"
	| "exitPrice"
	| "entryTime"
	| "exitTime"
	| "quantity"
	| "netPnl"
	| "rating"
	| "isReviewed"
	| "setupType"
	| "strategyId"
> & {
	tradeTags?: TradeTagWithTag[];
	account?: Pick<Account, "id" | "name" | "color"> | null;
	strategy?: Pick<Strategy, "id" | "name" | "color"> | null;
};

// =============================================================================
// ENUM VALUE TYPES (for TypeScript discriminated unions)
// =============================================================================

export type TradeDirection = Trade["direction"];
export type TradeStatus = Trade["status"];
export type InstrumentType = Trade["instrumentType"];
export type EmotionalState = NonNullable<Trade["emotionalState"]>;
export type ExitReason = NonNullable<Trade["exitReason"]>;
export type AccountType = Account["accountType"];
