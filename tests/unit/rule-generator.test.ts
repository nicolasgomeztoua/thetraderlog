/**
 * Unit Tests for Rule Generator Service
 *
 * Tests the rule generation logic that transforms strategy config into checklist rules.
 */

import { describe, expect, it } from "vitest";
import type { RiskParameters } from "@/components/strategy/risk-config";
import type { ScalingRules } from "@/components/strategy/scaling-config";
import type { TrailingRules } from "@/components/strategy/trailing-config";
import {
	generateRulesFromConfig,
	hashConfig,
	parseRLevelFromTrigger,
} from "@/lib/strategy/rule-generator";

describe("parseRLevelFromTrigger", () => {
	it("should parse +1R pattern", () => {
		expect(parseRLevelFromTrigger("At +1R take 50%")).toBe(1);
	});

	it("should parse +1.5R pattern", () => {
		expect(parseRLevelFromTrigger("At +1.5R")).toBe(1.5);
	});

	it("should parse 2R without plus sign", () => {
		expect(parseRLevelFromTrigger("At 2R target")).toBe(2);
	});

	it("should parse +0.5R pattern", () => {
		expect(parseRLevelFromTrigger("Price reaches +0.5R")).toBe(0.5);
	});

	it("should return null for text without R-level", () => {
		expect(parseRLevelFromTrigger("On pullback to EMA")).toBeNull();
	});

	it("should return null for empty string", () => {
		expect(parseRLevelFromTrigger("")).toBeNull();
	});

	it("should handle R with spaces before it", () => {
		expect(parseRLevelFromTrigger("At +2 R")).toBe(2);
	});
});

describe("hashConfig", () => {
	it("should return a 16-character hex string", () => {
		const hash = hashConfig({ value: 100 });
		expect(hash).toMatch(/^[a-f0-9]{16}$/);
	});

	it("should return same hash for same config", () => {
		const config = { maxRisk: 100, type: "dollars" };
		const hash1 = hashConfig(config);
		const hash2 = hashConfig(config);
		expect(hash1).toBe(hash2);
	});

	it("should return different hash when config changes", () => {
		const config1 = { maxRisk: 100, type: "dollars" };
		const config2 = { maxRisk: 200, type: "dollars" };
		const hash1 = hashConfig(config1);
		const hash2 = hashConfig(config2);
		expect(hash1).not.toBe(hash2);
	});

	it("should be deterministic for same input", () => {
		const config = { a: 1, b: 2 };
		const hash1 = hashConfig(config);
		const hash2 = hashConfig(config);
		expect(hash1).toBe(hash2);
	});
});

describe("generateRulesFromConfig - Risk Parameters", () => {
	it("should generate all rules when all risk fields are set", () => {
		const riskParams: RiskParameters = {
			maxRiskPerTrade: { type: "dollars", value: 100 },
			minRRRatio: 2,
			dailyLossLimit: { type: "dollars", value: 500 },
			maxConcurrentPositions: 3,
		};

		const rules = generateRulesFromConfig(riskParams, null, null);

		expect(rules).toHaveLength(4);

		// Max risk per trade
		const maxRiskRule = rules.find((r) =>
			r.configSource.includes("maxRiskPerTrade"),
		);
		expect(maxRiskRule).toBeDefined();
		expect(maxRiskRule?.text).toBe("Max risk per trade: $100");
		expect(maxRiskRule?.ruleType).toBe("auto");
		expect(maxRiskRule?.category).toBe("risk");
		expect(maxRiskRule?.autoCondition?.type).toBe("maxRiskPerTrade");

		// Min R:R ratio
		const rrRule = rules.find((r) => r.configSource.includes("minRRRatio"));
		expect(rrRule).toBeDefined();
		expect(rrRule?.text).toBe("Minimum R:R ratio: 2:1");
		expect(rrRule?.ruleType).toBe("auto");
		expect(rrRule?.category).toBe("entry");

		// Daily loss limit
		const dailyLossRule = rules.find((r) =>
			r.configSource.includes("dailyLossLimit"),
		);
		expect(dailyLossRule).toBeDefined();
		expect(dailyLossRule?.text).toBe("Daily loss limit: $500");
		expect(dailyLossRule?.ruleType).toBe("auto");
		expect(dailyLossRule?.category).toBe("risk");

		// Max concurrent positions
		const maxPosRule = rules.find((r) =>
			r.configSource.includes("maxConcurrentPositions"),
		);
		expect(maxPosRule).toBeDefined();
		expect(maxPosRule?.text).toBe("Max concurrent positions: 3");
		expect(maxPosRule?.ruleType).toBe("auto");
		expect(maxPosRule?.category).toBe("risk");
	});

	it("should generate no rules when fields are not set", () => {
		const riskParams: RiskParameters = {};
		const rules = generateRulesFromConfig(riskParams, null, null);
		expect(rules).toHaveLength(0);
	});

	it("should generate no rules when riskParams is null", () => {
		const rules = generateRulesFromConfig(null, null, null);
		expect(rules).toHaveLength(0);
	});

	it("should generate no rules when riskParams is undefined", () => {
		const rules = generateRulesFromConfig(undefined, null, null);
		expect(rules).toHaveLength(0);
	});

	it("should handle percent type for max risk", () => {
		const riskParams: RiskParameters = {
			maxRiskPerTrade: { type: "percent", value: 2 },
		};

		const rules = generateRulesFromConfig(riskParams, null, null);
		expect(rules).toHaveLength(1);
		expect(rules[0]?.text).toBe("Max risk per trade: 2%");
		if (rules[0]?.autoCondition?.type === "maxRiskPerTrade") {
			expect(rules[0].autoCondition.maxRiskType).toBe("percent");
		}
	});

	it("should handle percent type for daily loss limit", () => {
		const riskParams: RiskParameters = {
			dailyLossLimit: { type: "percent", value: 5 },
		};

		const rules = generateRulesFromConfig(riskParams, null, null);
		expect(rules).toHaveLength(1);
		expect(rules[0]?.text).toBe("Daily loss limit: 5%");
	});
});

describe("generateRulesFromConfig - Scaling Rules", () => {
	it("should generate manual rules for scale-in", () => {
		const scalingRules: ScalingRules = {
			scaleIn: [
				{ trigger: "Price pulls back to support", sizePercent: 25 },
				{ trigger: "On confirmation candle", sizePercent: 25 },
			],
		};

		const rules = generateRulesFromConfig(null, scalingRules, null);

		expect(rules).toHaveLength(2);
		rules.forEach((rule) => {
			expect(rule.ruleType).toBe("manual");
			expect(rule.category).toBe("management");
			expect(rule.autoCondition).toBeNull();
		});

		expect(rules[0]?.text).toBe("Scale in: Price pulls back to support (25%)");
		expect(rules[0]?.configSource).toBe("scalingRules.scaleIn[0]");
	});

	it("should generate auto rules for scale-out with R-level", () => {
		const scalingRules: ScalingRules = {
			scaleOut: [{ trigger: "At +1R take 50%", sizePercent: 50 }],
		};

		const rules = generateRulesFromConfig(null, scalingRules, null);

		expect(rules).toHaveLength(1);
		expect(rules[0]?.ruleType).toBe("auto");
		expect(rules[0]?.category).toBe("exit");
		expect(rules[0]?.text).toBe("Scale out: At +1R take 50% (50%)");

		if (rules[0]?.autoCondition?.type === "scaleOutAtR") {
			expect(rules[0].autoCondition.targetR).toBe(1);
			expect(rules[0].autoCondition.sizePercent).toBe(50);
		} else {
			throw new Error("Expected scaleOutAtR condition");
		}
	});

	it("should generate manual rules for scale-out without R-level", () => {
		const scalingRules: ScalingRules = {
			scaleOut: [{ trigger: "At resistance level", sizePercent: 50 }],
		};

		const rules = generateRulesFromConfig(null, scalingRules, null);

		expect(rules).toHaveLength(1);
		expect(rules[0]?.ruleType).toBe("manual");
		expect(rules[0]?.autoCondition).toBeNull();
	});

	it("should parse various R-level formats in scale-out triggers", () => {
		const scalingRules: ScalingRules = {
			scaleOut: [
				{ trigger: "At +1.5R take first partial", sizePercent: 30 },
				{ trigger: "Take profit at 2R", sizePercent: 40 },
				{ trigger: "+3R final exit", sizePercent: 30 },
			],
		};

		const rules = generateRulesFromConfig(null, scalingRules, null);

		expect(rules).toHaveLength(3);
		expect(rules[0]?.ruleType).toBe("auto");
		expect(rules[1]?.ruleType).toBe("auto");
		expect(rules[2]?.ruleType).toBe("auto");

		if (rules[0]?.autoCondition?.type === "scaleOutAtR") {
			expect(rules[0].autoCondition.targetR).toBe(1.5);
		}
		if (rules[1]?.autoCondition?.type === "scaleOutAtR") {
			expect(rules[1].autoCondition.targetR).toBe(2);
		}
		if (rules[2]?.autoCondition?.type === "scaleOutAtR") {
			expect(rules[2].autoCondition.targetR).toBe(3);
		}
	});

	it("should skip scale-in entries without trigger", () => {
		const scalingRules: ScalingRules = {
			scaleIn: [
				{ trigger: "", sizePercent: 25 },
				{ trigger: "Valid trigger", sizePercent: 50 },
			],
		};

		const rules = generateRulesFromConfig(null, scalingRules, null);
		expect(rules).toHaveLength(1);
		expect(rules[0]?.text).toContain("Valid trigger");
	});

	it("should handle empty scaling rules", () => {
		const scalingRules: ScalingRules = {};
		const rules = generateRulesFromConfig(null, scalingRules, null);
		expect(rules).toHaveLength(0);
	});
});

describe("generateRulesFromConfig - Trailing Rules", () => {
	it("should generate auto rule for move to breakeven", () => {
		const trailingRules: TrailingRules = {
			moveToBreakeven: { triggerR: 1, offsetTicks: 2 },
		};

		const rules = generateRulesFromConfig(null, null, trailingRules);

		expect(rules).toHaveLength(1);
		expect(rules[0]?.ruleType).toBe("auto");
		expect(rules[0]?.category).toBe("management");
		expect(rules[0]?.text).toBe("Move to breakeven at +1R +2 ticks");
		expect(rules[0]?.configSource).toBe("trailingRules.moveToBreakeven");

		if (rules[0]?.autoCondition?.type === "breakevenTrigger") {
			expect(rules[0].autoCondition.triggerR).toBe(1);
			expect(rules[0].autoCondition.offsetTicks).toBe(2);
		}
	});

	it("should omit offset text when offsetTicks is 0", () => {
		const trailingRules: TrailingRules = {
			moveToBreakeven: { triggerR: 1, offsetTicks: 0 },
		};

		const rules = generateRulesFromConfig(null, null, trailingRules);
		expect(rules[0]?.text).toBe("Move to breakeven at +1R");
	});

	it("should generate semi_auto rule for fixed_ticks trailing stop", () => {
		const trailingRules: TrailingRules = {
			trailStops: [{ triggerR: 1.5, method: "fixed_ticks", value: 10 }],
		};

		const rules = generateRulesFromConfig(null, null, trailingRules);

		expect(rules).toHaveLength(1);
		expect(rules[0]?.ruleType).toBe("semi_auto");
		expect(rules[0]?.text).toBe("Trail stop at +1.5R: 10 ticks");
		expect(rules[0]?.configSource).toBe("trailingRules.trailStops[0]");

		if (rules[0]?.autoCondition?.type === "trailingStopTrigger") {
			expect(rules[0].autoCondition.method).toBe("fixed_ticks");
			expect(rules[0].autoCondition.value).toBe(10);
		}
	});

	it("should generate manual rule for atr_multiple trailing stop", () => {
		const trailingRules: TrailingRules = {
			trailStops: [{ triggerR: 2, method: "atr_multiple", value: 1.5 }],
		};

		const rules = generateRulesFromConfig(null, null, trailingRules);

		expect(rules).toHaveLength(1);
		expect(rules[0]?.ruleType).toBe("manual");
		expect(rules[0]?.text).toBe("Trail stop at +2R: 1.5x ATR");
		expect(rules[0]?.autoCondition).toBeNull();
	});

	it("should generate manual rule for swing_low trailing stop", () => {
		const trailingRules: TrailingRules = {
			trailStops: [{ triggerR: 2.5, method: "swing_low", value: 0 }],
		};

		const rules = generateRulesFromConfig(null, null, trailingRules);

		expect(rules).toHaveLength(1);
		expect(rules[0]?.ruleType).toBe("manual");
		expect(rules[0]?.text).toBe("Trail stop at +2.5R: Swing Low/High");
		expect(rules[0]?.autoCondition).toBeNull();
	});

	it("should handle multiple trailing stops with different methods", () => {
		const trailingRules: TrailingRules = {
			trailStops: [
				{ triggerR: 1, method: "fixed_ticks", value: 8 },
				{ triggerR: 2, method: "atr_multiple", value: 2 },
				{ triggerR: 3, method: "swing_low", value: 0 },
			],
		};

		const rules = generateRulesFromConfig(null, null, trailingRules);

		expect(rules).toHaveLength(3);
		expect(rules[0]?.ruleType).toBe("semi_auto");
		expect(rules[1]?.ruleType).toBe("manual");
		expect(rules[2]?.ruleType).toBe("manual");
	});
});

describe("generateRulesFromConfig - Combined Configurations", () => {
	it("should generate rules from all config sections", () => {
		const riskParams: RiskParameters = {
			maxRiskPerTrade: { type: "dollars", value: 100 },
			minRRRatio: 2,
		};

		const scalingRules: ScalingRules = {
			scaleIn: [{ trigger: "On pullback", sizePercent: 25 }],
			scaleOut: [{ trigger: "At +1R", sizePercent: 50 }],
		};

		const trailingRules: TrailingRules = {
			moveToBreakeven: { triggerR: 1 },
			trailStops: [{ triggerR: 2, method: "fixed_ticks", value: 10 }],
		};

		const rules = generateRulesFromConfig(
			riskParams,
			scalingRules,
			trailingRules,
		);

		// 2 risk + 2 scaling + 2 trailing = 6 rules
		expect(rules).toHaveLength(6);

		// Verify order: risk first, then scaling, then trailing
		expect(rules[0]?.configSource).toContain("riskParameters");
		expect(rules[1]?.configSource).toContain("riskParameters");
		expect(rules[2]?.configSource).toContain("scalingRules");
		expect(rules[3]?.configSource).toContain("scalingRules");
		expect(rules[4]?.configSource).toContain("trailingRules");
		expect(rules[5]?.configSource).toContain("trailingRules");
	});

	it("should assign correct categories to all rule types", () => {
		const riskParams: RiskParameters = {
			maxRiskPerTrade: { type: "dollars", value: 100 },
			minRRRatio: 2,
		};

		const scalingRules: ScalingRules = {
			scaleIn: [{ trigger: "On pullback", sizePercent: 25 }],
			scaleOut: [{ trigger: "At +1R", sizePercent: 50 }],
		};

		const rules = generateRulesFromConfig(riskParams, scalingRules, null);

		const maxRiskRule = rules.find((r) =>
			r.configSource.includes("maxRiskPerTrade"),
		);
		const rrRule = rules.find((r) => r.configSource.includes("minRRRatio"));
		const scaleInRule = rules.find((r) => r.configSource.includes("scaleIn"));
		const scaleOutRule = rules.find((r) => r.configSource.includes("scaleOut"));

		expect(maxRiskRule?.category).toBe("risk");
		expect(rrRule?.category).toBe("entry");
		expect(scaleInRule?.category).toBe("management");
		expect(scaleOutRule?.category).toBe("exit");
	});

	it("should include sourceConfigHash for all generated rules", () => {
		const riskParams: RiskParameters = {
			maxRiskPerTrade: { type: "dollars", value: 100 },
		};

		const scalingRules: ScalingRules = {
			scaleOut: [{ trigger: "At +1R", sizePercent: 50 }],
		};

		const trailingRules: TrailingRules = {
			moveToBreakeven: { triggerR: 1 },
		};

		const rules = generateRulesFromConfig(
			riskParams,
			scalingRules,
			trailingRules,
		);

		rules.forEach((rule) => {
			expect(rule.sourceConfigHash).toBeDefined();
			expect(rule.sourceConfigHash).toMatch(/^[a-f0-9]{16}$/);
		});
	});
});
