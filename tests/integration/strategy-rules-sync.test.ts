/**
 * Integration tests for strategy rule syncing.
 *
 * These tests verify that auto-generated rules sync correctly with strategy
 * configuration when creating, updating, and managing strategies.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	createTestUser,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("strategy-rules-sync", () => {
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const user = await createTestUser();
		caller = await createTestCaller(user.clerkId, user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("Creating strategy with enabled config generates rules", () => {
		it("should generate maxRiskPerTrade rule when enabled", async () => {
			const strategy = await caller.strategies.create({
				name: "Max Risk Test Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			expect(strategy).toBeDefined();
			expect(strategy.id).toBeDefined();

			// Fetch strategy with rules
			const result = await caller.strategies.getById({ id: strategy.id });
			expect(result).toBeDefined();

			// Find the generated rule
			const maxRiskRule = result.rules.find(
				(r) => r.configSource === "riskParameters.maxRiskPerTrade",
			);

			expect(maxRiskRule).toBeDefined();
			expect(maxRiskRule?.isGenerated).toBe(true);
			expect(maxRiskRule?.ruleType).toBe("auto");
			expect(maxRiskRule?.text).toContain("500");
			expect(maxRiskRule?.category).toBe("risk");
		});

		it("should generate minRRRatio rule when enabled", async () => {
			const strategy = await caller.strategies.create({
				name: "Min RR Test Strategy",
				riskParameters: {
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const rrRule = result.rules.find(
				(r) => r.configSource === "riskParameters.minRRRatio",
			);

			expect(rrRule).toBeDefined();
			expect(rrRule?.isGenerated).toBe(true);
			expect(rrRule?.ruleType).toBe("auto");
			expect(rrRule?.text).toContain("2");
		});

		it("should generate dailyLossLimit rule when enabled", async () => {
			const strategy = await caller.strategies.create({
				name: "Daily Loss Limit Strategy",
				riskParameters: {
					dailyLossLimit: {
						type: "dollars",
						value: 1000,
						enabled: true,
					},
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const dailyLossRule = result.rules.find(
				(r) => r.configSource === "riskParameters.dailyLossLimit",
			);

			expect(dailyLossRule).toBeDefined();
			expect(dailyLossRule?.isGenerated).toBe(true);
			expect(dailyLossRule?.ruleType).toBe("auto");
			expect(dailyLossRule?.text).toContain("1000");
		});

		it("should generate maxConcurrentPositions rule when enabled", async () => {
			const strategy = await caller.strategies.create({
				name: "Max Positions Strategy",
				riskParameters: {
					maxConcurrentPositions: 3,
					maxConcurrentPositionsEnabled: true,
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const maxPosRule = result.rules.find(
				(r) => r.configSource === "riskParameters.maxConcurrentPositions",
			);

			expect(maxPosRule).toBeDefined();
			expect(maxPosRule?.isGenerated).toBe(true);
			expect(maxPosRule?.ruleType).toBe("auto");
			expect(maxPosRule?.text).toContain("3");
		});

		it("should generate moveToBreakeven rule when enabled", async () => {
			const strategy = await caller.strategies.create({
				name: "Breakeven Strategy",
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						offsetTicks: 2,
						enabled: true,
					},
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const beRule = result.rules.find(
				(r) => r.configSource === "trailingRules.moveToBreakeven",
			);

			expect(beRule).toBeDefined();
			expect(beRule?.isGenerated).toBe(true);
			expect(beRule?.ruleType).toBe("auto");
			expect(beRule?.text).toContain("1R");
		});

		it("should generate scale out rule with auto type when R-level parseable", async () => {
			const strategy = await caller.strategies.create({
				name: "Scale Out Strategy",
				scalingRules: {
					scaleOut: [
						{
							trigger: "At +1R take 50%",
							sizePercent: 50,
							enabled: true,
						},
					],
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const scaleOutRule = result.rules.find(
				(r) => r.configSource === "scalingRules.scaleOut[0]",
			);

			expect(scaleOutRule).toBeDefined();
			expect(scaleOutRule?.isGenerated).toBe(true);
			expect(scaleOutRule?.ruleType).toBe("auto");
		});

		it("should generate scale in rule with manual type", async () => {
			const strategy = await caller.strategies.create({
				name: "Scale In Strategy",
				scalingRules: {
					scaleIn: [
						{
							trigger: "On pullback to support",
							sizePercent: 25,
							enabled: true,
						},
					],
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const scaleInRule = result.rules.find(
				(r) => r.configSource === "scalingRules.scaleIn[0]",
			);

			expect(scaleInRule).toBeDefined();
			expect(scaleInRule?.isGenerated).toBe(true);
			expect(scaleInRule?.ruleType).toBe("manual");
		});

		it("should generate trailing stop rule with correct type based on method", async () => {
			const strategy = await caller.strategies.create({
				name: "Trailing Stop Strategy",
				trailingRules: {
					trailStops: [
						{
							triggerR: 2.0,
							method: "fixed_ticks",
							value: 10,
							enabled: true,
						},
						{
							triggerR: 3.0,
							method: "atr_multiple",
							value: 2,
							enabled: true,
						},
					],
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const fixedTicksRule = result.rules.find(
				(r) => r.configSource === "trailingRules.trailStops[0]",
			);

			expect(fixedTicksRule).toBeDefined();
			expect(fixedTicksRule?.ruleType).toBe("semi_auto");

			const atrRule = result.rules.find(
				(r) => r.configSource === "trailingRules.trailStops[1]",
			);

			expect(atrRule).toBeDefined();
			expect(atrRule?.ruleType).toBe("manual");
		});
	});

	describe("Updating config value updates rule text", () => {
		it("should update generated rule text when config value changes", async () => {
			// Create strategy with initial config
			const strategy = await caller.strategies.create({
				name: "Update Test Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Verify initial rule
			let result = await caller.strategies.getById({ id: strategy.id });
			let rule = result.rules.find(
				(r) => r.configSource === "riskParameters.maxRiskPerTrade",
			);
			expect(rule?.text).toContain("500");

			// Update the config value
			await caller.strategies.update({
				id: strategy.id,
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 750,
						enabled: true,
					},
				},
			});

			// Verify rule text updated
			result = await caller.strategies.getById({ id: strategy.id });
			rule = result.rules.find(
				(r) => r.configSource === "riskParameters.maxRiskPerTrade",
			);
			expect(rule?.text).toContain("750");
			expect(rule?.text).not.toContain("500");
		});

		it("should update rule when type changes from dollars to percent", async () => {
			const strategy = await caller.strategies.create({
				name: "Type Change Strategy",
				riskParameters: {
					dailyLossLimit: {
						type: "dollars",
						value: 1000,
						enabled: true,
					},
				},
			});

			// Update to percent type
			await caller.strategies.update({
				id: strategy.id,
				riskParameters: {
					dailyLossLimit: {
						type: "percent",
						value: 5,
						enabled: true,
					},
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });
			const rule = result.rules.find(
				(r) => r.configSource === "riskParameters.dailyLossLimit",
			);

			expect(rule?.text).toContain("5%");
			expect(rule?.text).not.toContain("$");
		});
	});

	describe("Disabling config deletes generated rule", () => {
		it("should delete generated rule when config is disabled", async () => {
			// Create strategy with enabled config
			const strategy = await caller.strategies.create({
				name: "Disable Test Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
				},
			});

			// Verify both rules exist
			let result = await caller.strategies.getById({ id: strategy.id });
			expect(result.rules.length).toBe(2);

			// Disable maxRiskPerTrade
			await caller.strategies.update({
				id: strategy.id,
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: false, // Disabled
					},
					minRRRatio: 2.0,
					minRRRatioEnabled: true, // Still enabled
				},
			});

			// Verify only one rule remains
			result = await caller.strategies.getById({ id: strategy.id });
			expect(result.rules.length).toBe(1);

			const remainingRule = result.rules[0];
			expect(remainingRule?.configSource).toBe("riskParameters.minRRRatio");
		});

		it("should delete all generated rules when entire config section removed", async () => {
			const strategy = await caller.strategies.create({
				name: "Remove Config Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Update with null riskParameters
			await caller.strategies.update({
				id: strategy.id,
				riskParameters: null,
			});

			const result = await caller.strategies.getById({ id: strategy.id });
			const generatedRules = result.rules.filter((r) => r.isGenerated);
			expect(generatedRules.length).toBe(0);
		});
	});

	describe("Manual rules are not affected by sync", () => {
		it("should preserve manual rules when syncing generated rules", async () => {
			// Create strategy with manual rule
			const strategy = await caller.strategies.create({
				name: "Mixed Rules Strategy",
				rules: [
					{
						text: "Manual rule: Check sentiment before entry",
						category: "entry",
						order: 0,
					},
				],
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Verify both manual and generated rules exist
			let result = await caller.strategies.getById({ id: strategy.id });
			expect(result.rules.length).toBe(2);

			const manualRule = result.rules.find((r) => !r.isGenerated);
			const generatedRule = result.rules.find((r) => r.isGenerated);

			expect(manualRule).toBeDefined();
			expect(manualRule?.text).toContain("sentiment");
			expect(generatedRule).toBeDefined();

			// Update generated config - should not affect manual rule
			await caller.strategies.update({
				id: strategy.id,
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 750,
						enabled: true,
					},
				},
			});

			result = await caller.strategies.getById({ id: strategy.id });
			const updatedManualRule = result.rules.find((r) => !r.isGenerated);
			expect(updatedManualRule).toBeDefined();
			expect(updatedManualRule?.text).toContain("sentiment");
		});

		it("should allow adding manual rules without affecting generated rules", async () => {
			const strategy = await caller.strategies.create({
				name: "Add Manual Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Add a manual rule via update
			await caller.strategies.update({
				id: strategy.id,
				rules: [
					{
						text: "New manual rule",
						category: "entry",
						order: 10,
					},
				],
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			const manualRules = result.rules.filter((r) => !r.isGenerated);
			const generatedRules = result.rules.filter((r) => r.isGenerated);

			expect(manualRules.length).toBe(1);
			expect(generatedRules.length).toBe(1);
		});
	});

	describe("Hash prevents unnecessary updates", () => {
		it("should not update rule if config values unchanged", async () => {
			const strategy = await caller.strategies.create({
				name: "Hash Test Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Get the initial rule
			let result = await caller.strategies.getById({ id: strategy.id });
			const initialRule = result.rules.find(
				(r) => r.configSource === "riskParameters.maxRiskPerTrade",
			);
			const initialHash = initialRule?.sourceConfigHash;

			expect(initialHash).toBeDefined();

			// Update with same values
			await caller.strategies.update({
				id: strategy.id,
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Hash should be the same (no unnecessary update)
			result = await caller.strategies.getById({ id: strategy.id });
			const updatedRule = result.rules.find(
				(r) => r.configSource === "riskParameters.maxRiskPerTrade",
			);

			expect(updatedRule?.sourceConfigHash).toBe(initialHash);
		});

		it("should change hash when config value changes", async () => {
			const strategy = await caller.strategies.create({
				name: "Hash Change Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			let result = await caller.strategies.getById({ id: strategy.id });
			const initialHash = result.rules.find(
				(r) => r.configSource === "riskParameters.maxRiskPerTrade",
			)?.sourceConfigHash;

			// Update with different value
			await caller.strategies.update({
				id: strategy.id,
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 600,
						enabled: true,
					},
				},
			});

			result = await caller.strategies.getById({ id: strategy.id });
			const newHash = result.rules.find(
				(r) => r.configSource === "riskParameters.maxRiskPerTrade",
			)?.sourceConfigHash;

			expect(newHash).not.toBe(initialHash);
		});
	});

	describe("syncGeneratedRules endpoint", () => {
		it("should sync rules manually via endpoint", async () => {
			// Create strategy without triggering auto-sync (using direct DB for setup)
			const strategy = await caller.strategies.create({
				name: "Sync Endpoint Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Call syncGeneratedRules explicitly
			const syncResult = await caller.strategies.syncGeneratedRules({
				strategyId: strategy.id,
			});

			// Since rules were already created on create, expect no changes
			expect(syncResult.added).toBe(0);
			expect(syncResult.updated).toBe(0);
			expect(syncResult.deleted).toBe(0);
		});

		it("should report correct counts when syncing", async () => {
			const strategy = await caller.strategies.create({
				name: "Sync Counts Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// Manually insert a generated rule that will be orphaned
			const db = getTestDb();
			await db.insert(schema.strategyRules).values({
				strategyId: strategy.id,
				text: "Orphaned rule",
				category: "risk",
				order: 100,
				ruleType: "auto",
				configSource: "riskParameters.orphanedConfig",
				isGenerated: true,
				sourceConfigHash: "oldhash",
			});

			// Sync should delete the orphaned rule
			const syncResult = await caller.strategies.syncGeneratedRules({
				strategyId: strategy.id,
			});

			expect(syncResult.deleted).toBe(1);
		});
	});

	describe("Regression: frontend sending generated rules back", () => {
		it("should not duplicate rules when generated rules are sent in update rules array", async () => {
			// This regression test covers the bug where the frontend fetched all rules
			// (including generated ones) and sent them back in the update call,
			// causing duplicates because generated rules were re-inserted as manual rules
			const strategy = await caller.strategies.create({
				name: "Duplicate Bug Regression Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
					dailyLossLimit: {
						type: "dollars",
						value: 1000,
						enabled: true,
					},
				},
			});

			// Verify initial rules exist
			let result = await caller.strategies.getById({ id: strategy.id });
			expect(result.rules.length).toBe(2);

			// Simulate what the buggy frontend did: fetch rules and send them ALL back
			// including the generated ones (which should not be in the rules array)
			const allRulesFetchedByFrontend = result.rules.map((r) => ({
				id: r.id,
				text: r.text,
				category: r.category as "entry" | "exit" | "risk" | "management",
				order: r.order,
			}));

			// Update strategy sending the generated rules back as if they were manual
			await caller.strategies.update({
				id: strategy.id,
				rules: allRulesFetchedByFrontend, // Bug: sending generated rules back
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
					dailyLossLimit: {
						type: "dollars",
						value: 1000,
						enabled: true,
					},
				},
			});

			// After the fix: should still have exactly 2 rules, not 4 (duplicates)
			result = await caller.strategies.getById({ id: strategy.id });

			// Count rules by text to detect duplicates
			const ruleTexts = result.rules.map((r) => r.text);
			const uniqueTexts = new Set(ruleTexts);

			expect(ruleTexts.length).toBe(uniqueTexts.size); // No duplicate texts
			expect(result.rules.length).toBe(2); // Should still be 2, not 4
		});

		it("should not duplicate rules on multiple saves", async () => {
			// Simulate clicking save multiple times
			const strategy = await caller.strategies.create({
				name: "Multiple Saves Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			// First "save" - simulating frontend behavior
			let result = await caller.strategies.getById({ id: strategy.id });
			const rulesFromFrontend = result.rules.map((r) => ({
				text: r.text,
				category: r.category as "entry" | "exit" | "risk" | "management",
				order: r.order,
			}));

			await caller.strategies.update({
				id: strategy.id,
				rules: rulesFromFrontend,
			});

			// Second "save"
			result = await caller.strategies.getById({ id: strategy.id });
			const rulesFromFrontend2 = result.rules.map((r) => ({
				text: r.text,
				category: r.category as "entry" | "exit" | "risk" | "management",
				order: r.order,
			}));

			await caller.strategies.update({
				id: strategy.id,
				rules: rulesFromFrontend2,
			});

			// Third "save"
			result = await caller.strategies.getById({ id: strategy.id });
			const rulesFromFrontend3 = result.rules.map((r) => ({
				text: r.text,
				category: r.category as "entry" | "exit" | "risk" | "management",
				order: r.order,
			}));

			await caller.strategies.update({
				id: strategy.id,
				rules: rulesFromFrontend3,
			});

			// Should still have exactly 1 rule, not 3 or more
			result = await caller.strategies.getById({ id: strategy.id });
			expect(result.rules.length).toBe(1);
		});
	});

	describe("Complex scenarios", () => {
		it("should handle strategy with multiple config sections enabled", async () => {
			const strategy = await caller.strategies.create({
				name: "Multi-Config Strategy",
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
					minRRRatio: 2.0,
					minRRRatioEnabled: true,
					dailyLossLimit: {
						type: "percent",
						value: 5,
						enabled: true,
					},
				},
				scalingRules: {
					scaleOut: [
						{
							trigger: "At +1R take 50%",
							sizePercent: 50,
							enabled: true,
						},
						{
							trigger: "At +2R take remaining",
							sizePercent: 100,
							enabled: true,
						},
					],
				},
				trailingRules: {
					moveToBreakeven: {
						triggerR: 1.0,
						enabled: true,
					},
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });
			const generatedRules = result.rules.filter((r) => r.isGenerated);

			// Should have: maxRiskPerTrade, minRRRatio, dailyLossLimit, 2 scaleOut, moveToBreakeven = 6 rules
			expect(generatedRules.length).toBe(6);

			// Verify each category is represented
			const riskRules = generatedRules.filter((r) => r.category === "risk");
			const managementRules = generatedRules.filter(
				(r) => r.category === "management",
			);
			const exitRules = generatedRules.filter((r) => r.category === "exit");

			const entryRules = generatedRules.filter((r) => r.category === "entry");

			expect(riskRules.length).toBe(2); // maxRisk, dailyLoss
			expect(entryRules.length).toBe(1); // minRR (entry criteria)
			expect(managementRules.length).toBe(1); // moveToBreakeven
			expect(exitRules.length).toBe(2); // 2 scale out rules
		});

		it("should preserve rule ordering when updating", async () => {
			const strategy = await caller.strategies.create({
				name: "Ordering Strategy",
				rules: [
					{ text: "Manual rule 1", category: "entry", order: 0 },
					{ text: "Manual rule 2", category: "exit", order: 1 },
				],
				riskParameters: {
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
						enabled: true,
					},
				},
			});

			const result = await caller.strategies.getById({ id: strategy.id });

			// Generated rules should have order after manual rules
			const generatedRule = result.rules.find((r) => r.isGenerated);
			const manualRules = result.rules.filter((r) => !r.isGenerated);

			const maxManualOrder = Math.max(...manualRules.map((r) => r.order));
			expect(generatedRule?.order).toBeGreaterThan(maxManualOrder);
		});
	});
});
