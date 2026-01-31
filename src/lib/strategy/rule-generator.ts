/**
 * Rule Generator Service
 *
 * Generates rules from strategy configuration (risk parameters, scaling rules,
 * trailing rules) so that config fields automatically become checklist items.
 */

import { createHash } from "node:crypto";
import type { RiskParameters } from "@/components/strategy/risk-config";
import type { ScalingRules } from "@/components/strategy/scaling-config";
import type { TrailingRules } from "@/components/strategy/trailing-config";
import type { AutoCondition, GeneratedRule, RuleType } from "./types";

// ============================================================================
// HASH FUNCTION
// ============================================================================

/**
 * Creates a hash of the config for change detection
 * Returns first 16 characters of MD5 hash
 */
export function hashConfig(config: unknown): string {
	const json = JSON.stringify(config);
	return createHash("md5").update(json).digest("hex").slice(0, 16);
}

// ============================================================================
// R-LEVEL PARSER
// ============================================================================

/**
 * Parses R-level from trigger text
 * Examples:
 *   "At +1R take 50%" → 1.0
 *   "+2R" → 2.0
 *   "At +1.5R" → 1.5
 *   "Price reaches +0.5R" → 0.5
 *   "At 2R target" → 2.0
 * Returns null if no R-level found
 */
export function parseRLevelFromTrigger(trigger: string): number | null {
	// Match patterns like +1R, +1.5R, 2R, +2R
	const match = trigger.match(/\+?(\d+(?:\.\d+)?)\s*R\b/i);
	if (match?.[1]) {
		const parsed = parseFloat(match[1]);
		return Number.isNaN(parsed) ? null : parsed;
	}
	return null;
}

// ============================================================================
// RULE GENERATORS
// ============================================================================

/**
 * Generates rules from risk parameters
 * Only generates rules for fields that have enabled: true
 */
function generateRiskRules(
	riskParams: RiskParameters | null | undefined,
): GeneratedRule[] {
	if (!riskParams) return [];

	const rules: GeneratedRule[] = [];

	// Max Risk Per Trade - only if enabled
	if (
		riskParams.maxRiskPerTrade?.value !== undefined &&
		riskParams.maxRiskPerTrade.enabled
	) {
		const { type, value } = riskParams.maxRiskPerTrade;
		const displayValue = type === "dollars" ? `$${value}` : `${value}%`;
		const condition: AutoCondition = {
			type: "maxRiskPerTrade",
			maxRiskType: type,
			maxRiskValue: value,
		};

		rules.push({
			text: `Max risk per trade: ${displayValue}`,
			category: "risk",
			ruleType: "auto",
			configSource: "riskParameters.maxRiskPerTrade",
			autoCondition: condition,
			sourceConfigHash: hashConfig(riskParams.maxRiskPerTrade),
		});
	}

	// Min R:R Ratio - only if enabled
	if (riskParams.minRRRatio !== undefined && riskParams.minRRRatioEnabled) {
		const condition: AutoCondition = {
			type: "minRRRatio",
			minRatio: riskParams.minRRRatio,
		};

		rules.push({
			text: `Minimum R:R ratio: ${riskParams.minRRRatio}:1`,
			category: "entry",
			ruleType: "auto",
			configSource: "riskParameters.minRRRatio",
			autoCondition: condition,
			sourceConfigHash: hashConfig({ minRRRatio: riskParams.minRRRatio }),
		});
	}

	// Daily Loss Limit - only if enabled
	if (
		riskParams.dailyLossLimit?.value !== undefined &&
		riskParams.dailyLossLimit.enabled
	) {
		const { type, value } = riskParams.dailyLossLimit;
		const displayValue = type === "dollars" ? `$${value}` : `${value}%`;
		const condition: AutoCondition = {
			type: "dailyLossLimit",
			limitType: type,
			limitValue: value,
		};

		rules.push({
			text: `Daily loss limit: ${displayValue}`,
			category: "risk",
			ruleType: "auto",
			configSource: "riskParameters.dailyLossLimit",
			autoCondition: condition,
			sourceConfigHash: hashConfig(riskParams.dailyLossLimit),
		});
	}

	// Max Concurrent Positions - only if enabled
	if (
		riskParams.maxConcurrentPositions !== undefined &&
		riskParams.maxConcurrentPositionsEnabled
	) {
		const condition: AutoCondition = {
			type: "maxConcurrentPositions",
			maxPositions: riskParams.maxConcurrentPositions,
		};

		rules.push({
			text: `Max concurrent positions: ${riskParams.maxConcurrentPositions}`,
			category: "risk",
			ruleType: "auto",
			configSource: "riskParameters.maxConcurrentPositions",
			autoCondition: condition,
			sourceConfigHash: hashConfig({
				maxConcurrentPositions: riskParams.maxConcurrentPositions,
			}),
		});
	}

	return rules;
}

/**
 * Generates rules from scaling configuration
 * Only generates rules for items that have enabled: true
 */
function generateScalingRules(
	scalingRules: ScalingRules | null | undefined,
): GeneratedRule[] {
	if (!scalingRules) return [];

	const rules: GeneratedRule[] = [];

	// Scale In Rules - always manual (can't auto-evaluate adding to position)
	// Only generate if enabled
	if (scalingRules.scaleIn) {
		for (let i = 0; i < scalingRules.scaleIn.length; i++) {
			const scaleIn = scalingRules.scaleIn[i];
			if (!scaleIn?.trigger || !scaleIn.enabled) continue;

			rules.push({
				text: `Scale in: ${scaleIn.trigger} (${scaleIn.sizePercent}%)`,
				category: "management",
				ruleType: "manual",
				configSource: `scalingRules.scaleIn[${i}]`,
				autoCondition: null,
				sourceConfigHash: hashConfig(scaleIn),
			});
		}
	}

	// Scale Out Rules - auto if R-level parseable
	// Only generate if enabled
	if (scalingRules.scaleOut) {
		for (let i = 0; i < scalingRules.scaleOut.length; i++) {
			const scaleOut = scalingRules.scaleOut[i];
			if (!scaleOut?.trigger || !scaleOut.enabled) continue;

			const rLevel = parseRLevelFromTrigger(scaleOut.trigger);
			let ruleType: RuleType = "manual";
			let autoCondition: AutoCondition | null = null;

			if (rLevel !== null) {
				ruleType = "auto";
				autoCondition = {
					type: "scaleOutAtR",
					targetR: rLevel,
					sizePercent: scaleOut.sizePercent,
				};
			}

			rules.push({
				text: `Scale out: ${scaleOut.trigger} (${scaleOut.sizePercent}%)`,
				category: "exit",
				ruleType,
				configSource: `scalingRules.scaleOut[${i}]`,
				autoCondition,
				sourceConfigHash: hashConfig(scaleOut),
			});
		}
	}

	return rules;
}

/**
 * Generates rules from trailing stop configuration
 * Only generates rules for items that have enabled: true
 */
function generateTrailingRules(
	trailingRules: TrailingRules | null | undefined,
): GeneratedRule[] {
	if (!trailingRules) return [];

	const rules: GeneratedRule[] = [];

	// Move to Breakeven - only if enabled
	if (trailingRules.moveToBreakeven?.enabled) {
		const { triggerR, offsetTicks = 0 } = trailingRules.moveToBreakeven;
		const condition: AutoCondition = {
			type: "breakevenTrigger",
			triggerR,
			offsetTicks,
		};

		const offsetText = offsetTicks > 0 ? ` +${offsetTicks} ticks` : "";
		rules.push({
			text: `Move to breakeven at +${triggerR}R${offsetText}`,
			category: "management",
			ruleType: "auto",
			configSource: "trailingRules.moveToBreakeven",
			autoCondition: condition,
			sourceConfigHash: hashConfig(trailingRules.moveToBreakeven),
		});
	}

	// Trailing Stops - only generate if enabled
	if (trailingRules.trailStops) {
		for (let i = 0; i < trailingRules.trailStops.length; i++) {
			const trailStop = trailingRules.trailStops[i];
			if (!trailStop?.enabled) continue;

			const { triggerR, method, value } = trailStop;

			// fixed_ticks is semi_auto (system can check, but user may want control)
			// atr_multiple and swing_low are manual (require external data)
			let ruleType: RuleType;
			let autoCondition: AutoCondition | null = null;

			if (method === "fixed_ticks") {
				ruleType = "semi_auto";
				autoCondition = {
					type: "trailingStopTrigger",
					triggerR,
					method: "fixed_ticks",
					value,
				};
			} else if (method === "atr_multiple") {
				ruleType = "manual";
				// Could be semi_auto if we add ATR data
			} else {
				// swing_low
				ruleType = "manual";
			}

			const methodLabel =
				method === "fixed_ticks"
					? `${value} ticks`
					: method === "atr_multiple"
						? `${value}x ATR`
						: "Swing Low/High";

			rules.push({
				text: `Trail stop at +${triggerR}R: ${methodLabel}`,
				category: "management",
				ruleType,
				configSource: `trailingRules.trailStops[${i}]`,
				autoCondition,
				sourceConfigHash: hashConfig(trailStop),
			});
		}
	}

	return rules;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generates all rules from strategy configuration
 *
 * @param riskParams - Risk parameters from strategy
 * @param scalingRules - Scaling rules from strategy
 * @param trailingRules - Trailing rules from strategy
 * @returns Array of generated rules
 */
export function generateRulesFromConfig(
	riskParams: RiskParameters | null | undefined,
	scalingRules: ScalingRules | null | undefined,
	trailingRules: TrailingRules | null | undefined,
): GeneratedRule[] {
	return [
		...generateRiskRules(riskParams),
		...generateScalingRules(scalingRules),
		...generateTrailingRules(trailingRules),
	];
}
