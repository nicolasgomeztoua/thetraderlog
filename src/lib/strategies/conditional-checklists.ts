/**
 * Conditional Checklists Generator
 *
 * Generates conditional checklist items when trades hit R thresholds.
 * These are management rules that users confirm they followed (or didn't)
 * based on what the trade achieved.
 */

import { CONDITIONAL_RULE_TYPES } from "@/lib/constants/strategies";
import type { TradeForCompliance } from "./risk-compliance";
import { calculateAchievedR } from "./risk-compliance";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Move to breakeven rule configuration
 */
export interface MoveToBreakevenRule {
	triggerR: number; // R-multiple at which to move stop to breakeven
	offsetTicks?: number; // Optional offset from entry (positive = buffer above BE)
}

/**
 * Trail stop rule configuration
 */
export interface TrailStopRule {
	triggerR: number; // R-multiple at which to start trailing
	method: "fixed" | "atr" | "percent"; // Trailing method
	value: number; // Value for the method (ticks, ATR multiple, or percent)
}

/**
 * Scale out rule configuration
 */
export interface ScaleOutRule {
	triggerR: number; // R-multiple at which to scale out
	sizePercent: number; // Percentage of position to close
}

/**
 * Strategy trailing/management rules
 */
export interface TrailingRules {
	moveToBreakeven?: MoveToBreakevenRule | null;
	trailStops?: TrailStopRule[] | null;
}

/**
 * Strategy scaling rules
 */
export interface ScalingRules {
	scaleIn?: Array<{ trigger: string; sizePercent: number }> | null;
	scaleOut?: ScaleOutRule[] | null;
}

/**
 * Strategy data needed for conditional checklist generation
 */
export interface StrategyForConditionalChecklist {
	id: string;
	trailingRules?: TrailingRules | null;
	scalingRules?: ScalingRules | null;
	targetRMultiples?: number[] | null;
}

/**
 * Conditional checklist item
 */
export interface ConditionalChecklistItem {
	id: string; // Unique ID for the item
	type: (typeof CONDITIONAL_RULE_TYPES)[number]["value"]; // breakeven, trail, scale_out
	label: string; // Display label
	triggerR: number; // R-multiple that triggers this item
	triggered: boolean; // Whether the trade hit this threshold
	description?: string; // Additional context
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for a conditional checklist item
 */
function generateItemId(
	strategyId: string,
	type: string,
	triggerR: number,
	index?: number,
): string {
	const suffix = index !== undefined ? `-${index}` : "";
	return `${strategyId}-${type}-${triggerR}${suffix}`;
}

/**
 * Get the label for a conditional rule type
 */
function getRuleTypeLabel(
	type: (typeof CONDITIONAL_RULE_TYPES)[number]["value"],
): string {
	const ruleType = CONDITIONAL_RULE_TYPES.find((r) => r.value === type);
	return ruleType?.label ?? type;
}

// ============================================================================
// CHECKLIST GENERATORS
// ============================================================================

/**
 * Generate move to breakeven checklist item
 */
function generateBreakevenItem(
	strategyId: string,
	rule: MoveToBreakevenRule,
	achievedR: number | null,
): ConditionalChecklistItem {
	const triggered = achievedR !== null && achievedR >= rule.triggerR;
	const offsetText =
		rule.offsetTicks !== undefined && rule.offsetTicks > 0
			? ` (${rule.offsetTicks} tick offset)`
			: "";

	return {
		id: generateItemId(strategyId, "breakeven", rule.triggerR),
		type: "breakeven",
		label: `${getRuleTypeLabel("breakeven")} at ${rule.triggerR}R${offsetText}`,
		triggerR: rule.triggerR,
		triggered,
		description: triggered
			? `Trade reached ${achievedR?.toFixed(2)}R - confirm stop was moved to breakeven`
			: `Trade didn't hit ${rule.triggerR}R threshold`,
	};
}

/**
 * Generate trail stop checklist items
 */
function generateTrailItems(
	strategyId: string,
	rules: TrailStopRule[],
	achievedR: number | null,
): ConditionalChecklistItem[] {
	return rules.map((rule, index) => {
		const triggered = achievedR !== null && achievedR >= rule.triggerR;
		const methodLabel =
			rule.method === "fixed"
				? `${rule.value} ticks`
				: rule.method === "atr"
					? `${rule.value}x ATR`
					: `${rule.value}%`;

		return {
			id: generateItemId(strategyId, "trail", rule.triggerR, index),
			type: "trail" as const,
			label: `${getRuleTypeLabel("trail")} at ${rule.triggerR}R (${methodLabel})`,
			triggerR: rule.triggerR,
			triggered,
			description: triggered
				? `Trade reached ${achievedR?.toFixed(2)}R - confirm trailing stop was activated`
				: `Trade didn't hit ${rule.triggerR}R threshold`,
		};
	});
}

/**
 * Generate scale out checklist items
 */
function generateScaleOutItems(
	strategyId: string,
	rules: ScaleOutRule[],
	achievedR: number | null,
): ConditionalChecklistItem[] {
	return rules.map((rule, index) => {
		const triggered = achievedR !== null && achievedR >= rule.triggerR;

		return {
			id: generateItemId(strategyId, "scale_out", rule.triggerR, index),
			type: "scale_out" as const,
			label: `${getRuleTypeLabel("scale_out")} ${rule.sizePercent}% at ${rule.triggerR}R`,
			triggerR: rule.triggerR,
			triggered,
			description: triggered
				? `Trade reached ${achievedR?.toFixed(2)}R - confirm ${rule.sizePercent}% was scaled out`
				: `Trade didn't hit ${rule.triggerR}R threshold`,
		};
	});
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate conditional checklist items for a trade based on strategy rules
 *
 * @param trade - Trade data with entry, exit, stop loss, and P&L
 * @param strategy - Strategy with trailing rules and scaling rules
 * @returns Array of conditional checklist items
 */
export function generateConditionalChecklists(
	trade: TradeForCompliance,
	strategy: StrategyForConditionalChecklist,
): ConditionalChecklistItem[] {
	const items: ConditionalChecklistItem[] = [];

	// Calculate achieved R for the trade
	const achievedR = calculateAchievedR(trade);

	// Generate breakeven item if rule exists
	if (strategy.trailingRules?.moveToBreakeven) {
		items.push(
			generateBreakevenItem(
				strategy.id,
				strategy.trailingRules.moveToBreakeven,
				achievedR,
			),
		);
	}

	// Generate trail stop items if rules exist
	if (
		strategy.trailingRules?.trailStops &&
		strategy.trailingRules.trailStops.length > 0
	) {
		items.push(
			...generateTrailItems(
				strategy.id,
				strategy.trailingRules.trailStops,
				achievedR,
			),
		);
	}

	// Generate scale out items if rules exist
	if (
		strategy.scalingRules?.scaleOut &&
		strategy.scalingRules.scaleOut.length > 0
	) {
		items.push(
			...generateScaleOutItems(
				strategy.id,
				strategy.scalingRules.scaleOut,
				achievedR,
			),
		);
	}

	// Sort items by trigger R (ascending)
	items.sort((a, b) => a.triggerR - b.triggerR);

	return items;
}

/**
 * Get only triggered checklist items (items where trade hit the threshold)
 */
export function getTriggeredChecklists(
	trade: TradeForCompliance,
	strategy: StrategyForConditionalChecklist,
): ConditionalChecklistItem[] {
	return generateConditionalChecklists(trade, strategy).filter(
		(item) => item.triggered,
	);
}

/**
 * Get only non-triggered checklist items (items where trade didn't hit threshold)
 */
export function getNonTriggeredChecklists(
	trade: TradeForCompliance,
	strategy: StrategyForConditionalChecklist,
): ConditionalChecklistItem[] {
	return generateConditionalChecklists(trade, strategy).filter(
		(item) => !item.triggered,
	);
}
