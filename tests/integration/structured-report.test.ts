/**
 * Integration tests for the structured report pipeline.
 *
 * Tests schema validation (Zod), deterministic validator (fallbacks),
 * and executeStoreReportData (component metadata).
 */

import { describe, expect, it } from "vitest";

import {
	contentBlockSchema,
	type DataStoreMap,
	type StructuredReport,
	structuredReportSchema,
} from "@/lib/ai/report-pipeline/report-schema";
import { runValidatorPhase } from "@/lib/ai/report-pipeline/validator";
import { executeStoreReportData } from "@/lib/ai/tools/store-report-data";

// =============================================================================
// HELPERS
// =============================================================================

/** Build a minimal valid report with the given sections */
function buildReport(
	overrides: Partial<StructuredReport> = {},
): StructuredReport {
	return {
		executiveSummary: "Test executive summary.",
		sections: [
			{
				heading: "Test Section",
				blocks: [{ type: "prose", content: "Some analysis content." }],
			},
		],
		keyTakeaways: ["Takeaway 1"],
		...overrides,
	};
}

// =============================================================================
// REPORT SCHEMA VALIDATION
// =============================================================================

describe("structuredReportSchema", () => {
	it("should validate a well-formed report with all block types", () => {
		const report = {
			executiveSummary: "Good performance this month.",
			sections: [
				{
					heading: "Performance Overview",
					blocks: [
						{ type: "prose", content: "Your equity grew **15%** this month." },
						{
							type: "metrics",
							items: [
								{
									title: "Win Rate",
									value: "58.3%",
									tooltip: {
										what: "Percentage of winning trades",
										why: "Measures consistency",
										benchmark: "Above 50% is profitable",
									},
								},
								{
									title: "Net P&L",
									value: "$4,827",
									tooltip: {
										what: "Total profit/loss",
										why: "Bottom line performance",
										benchmark: "Compare to monthly average",
									},
									colorClass: "text-profit",
									description: "Best month in Q1",
								},
							],
						},
						{
							type: "chart",
							component: "EquityCurve",
							dataRef: "equity-data",
						},
						{
							type: "callout",
							calloutType: "tip",
							content: "Consider scaling position sizes gradually.",
						},
						{
							type: "image",
							src: "/charts/custom-analysis.png",
							alt: "Custom analysis chart",
							caption: "Generated via Python analysis",
						},
					],
				},
			],
			keyTakeaways: [
				"Increase position size on high-conviction setups",
				"Avoid trading during low-volume sessions",
			],
		};

		const result = structuredReportSchema.safeParse(report);
		expect(result.success).toBe(true);
	});

	it("should reject a report missing executiveSummary", () => {
		const report = {
			sections: [
				{
					heading: "Section",
					blocks: [{ type: "prose", content: "Content" }],
				},
			],
			keyTakeaways: ["Takeaway"],
		};

		const result = structuredReportSchema.safeParse(report);
		expect(result.success).toBe(false);
	});

	it("should reject a report with empty sections array", () => {
		const report = {
			executiveSummary: "Summary",
			sections: [],
			keyTakeaways: ["Takeaway"],
		};

		const result = structuredReportSchema.safeParse(report);
		expect(result.success).toBe(false);
	});

	it("should reject a report with empty keyTakeaways array", () => {
		const report = {
			executiveSummary: "Summary",
			sections: [
				{
					heading: "Section",
					blocks: [{ type: "prose", content: "Content" }],
				},
			],
			keyTakeaways: [],
		};

		const result = structuredReportSchema.safeParse(report);
		expect(result.success).toBe(false);
	});

	it("should reject a section with empty blocks array", () => {
		const report = {
			executiveSummary: "Summary",
			sections: [{ heading: "Empty Section", blocks: [] }],
			keyTakeaways: ["Takeaway"],
		};

		const result = structuredReportSchema.safeParse(report);
		expect(result.success).toBe(false);
	});

	it("should reject an invalid block type", () => {
		const block = { type: "table", rows: [] };

		const result = contentBlockSchema.safeParse(block);
		expect(result.success).toBe(false);
	});

	it("should reject a chart block with invalid component name", () => {
		const block = {
			type: "chart",
			component: "NonExistentChart",
			dataRef: "some-data",
		};

		const result = contentBlockSchema.safeParse(block);
		expect(result.success).toBe(false);
	});

	it("should reject a metrics block with empty items array", () => {
		const block = { type: "metrics", items: [] };

		const result = contentBlockSchema.safeParse(block);
		expect(result.success).toBe(false);
	});

	it("should reject a callout with invalid calloutType", () => {
		const block = {
			type: "callout",
			calloutType: "danger",
			content: "Watch out!",
		};

		const result = contentBlockSchema.safeParse(block);
		expect(result.success).toBe(false);
	});

	it("should validate all ChartComponent enum values", () => {
		const components = [
			"EquityCurve",
			"MonthlyChart",
			"SymbolDistributionChart",
			"DayOfWeekChart",
			"HourHeatmap",
			"SessionChart",
			"RMultipleChart",
			"MonteCarloChart",
			"CalendarHeatmap",
			"DrawdownTable",
			"SymbolTable",
			"DataTable",
		];

		for (const component of components) {
			const block = {
				type: "chart",
				component,
				dataRef: `${component.toLowerCase()}-data`,
			};
			const result = contentBlockSchema.safeParse(block);
			expect(result.success).toBe(true);
		}
	});
});

// =============================================================================
// DETERMINISTIC VALIDATOR
// =============================================================================

describe("runValidatorPhase", () => {
	it("should pass a report with all valid dataRefs", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"equity-data",
				{
					data: Array.from({ length: 30 }, (_, i) => ({
						date: `2025-01-${i + 1}`,
						equity: 10000 + i * 100,
					})),
					description: "Equity curve data",
					component: "EquityCurve",
				},
			],
			[
				"monthly-data",
				{
					data: Array.from({ length: 6 }, (_, i) => ({
						month: `2025-0${i + 1}`,
						pnl: 500 + i * 200,
					})),
					description: "Monthly P&L",
					component: "MonthlyChart",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Performance",
					blocks: [
						{
							type: "chart",
							component: "EquityCurve",
							dataRef: "equity-data",
						},
						{
							type: "chart",
							component: "MonthlyChart",
							dataRef: "monthly-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(0);
		// Both chart blocks should be preserved
		expect(result.report.sections[0]?.blocks).toHaveLength(2);
		expect(result.report.sections[0]?.blocks[0]?.type).toBe("chart");
		expect(result.report.sections[0]?.blocks[1]?.type).toBe("chart");
	});

	it("should replace chart block with prose when dataRef is missing", () => {
		const dataStore: DataStoreMap = new Map();

		const report = buildReport({
			sections: [
				{
					heading: "Missing Data Section",
					blocks: [
						{
							type: "chart",
							component: "EquityCurve",
							dataRef: "nonexistent-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("missing dataRef");
		expect(result.warnings[0]).toContain("nonexistent-data");
		// Chart block should be replaced with prose fallback
		const block = result.report.sections[0]?.blocks[0];
		expect(block?.type).toBe("prose");
		if (block?.type === "prose") {
			expect(block.content).toContain("omitted");
			expect(block.content).toContain("not found");
		}
	});

	it("should replace chart block with prose when data shape is incompatible (array for RMultipleChart)", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"r-multiple-data",
				{
					data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
					description: "Wrong shape — should be { buckets, stats }",
					component: "RMultipleChart",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Risk Analysis",
					blocks: [
						{
							type: "chart",
							component: "RMultipleChart",
							dataRef: "r-multiple-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("incompatible data shape");
		expect(result.warnings[0]).toContain("RMultipleChart");
		const block = result.report.sections[0]?.blocks[0];
		expect(block?.type).toBe("prose");
	});

	it("should replace chart block with prose when data shape is incompatible (non-object for EquityCurve)", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"equity-data",
				{
					data: "not an array",
					description: "Wrong shape — should be array",
					component: "EquityCurve",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Performance",
					blocks: [
						{
							type: "chart",
							component: "EquityCurve",
							dataRef: "equity-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("incompatible data shape");
		const block = result.report.sections[0]?.blocks[0];
		expect(block?.type).toBe("prose");
	});

	it("should replace chart block with prose when data shape is incompatible (array for MonteCarloChart)", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"monte-carlo-data",
				{
					data: [1, 2, 3],
					description: "Wrong shape — should be non-array object",
					component: "MonteCarloChart",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Simulation",
					blocks: [
						{
							type: "chart",
							component: "MonteCarloChart",
							dataRef: "monte-carlo-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("incompatible data shape");
		const block = result.report.sections[0]?.blocks[0];
		expect(block?.type).toBe("prose");
	});

	it("should replace chart block with prose when data is insufficient (below COMPONENT_MINIMUMS)", () => {
		// EquityCurve needs >= 5 data points (equity pattern matches minimum of 5)
		const dataStore: DataStoreMap = new Map([
			[
				"equity-data",
				{
					data: [
						{ date: "2025-01-01", equity: 10000 },
						{ date: "2025-01-02", equity: 10100 },
					],
					description: "Only 2 data points",
					component: "EquityCurve",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Performance",
					blocks: [
						{
							type: "chart",
							component: "EquityCurve",
							dataRef: "equity-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("insufficient data");
		expect(result.warnings[0]).toContain("2 points");
		const block = result.report.sections[0]?.blocks[0];
		expect(block?.type).toBe("prose");
		if (block?.type === "prose") {
			expect(block.content).toContain("2 data points");
		}
	});

	it("should pass RMultipleChart with correct { buckets, stats } shape and sufficient data", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"r-multiple-data",
				{
					data: {
						buckets: Array.from({ length: 15 }, (_, i) => ({
							range: `${i}-${i + 1}`,
							count: i * 2,
						})),
						stats: { mean: 1.5, median: 1.3, stdDev: 0.8 },
					},
					description: "R-multiple distribution",
					component: "RMultipleChart",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Risk",
					blocks: [
						{
							type: "chart",
							component: "RMultipleChart",
							dataRef: "r-multiple-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(0);
		expect(result.report.sections[0]?.blocks[0]?.type).toBe("chart");
	});

	it("should pass MonteCarloChart with correct non-array object shape", () => {
		// MonteCarloChart needs a non-array object with enough keys to pass sufficiency.
		// The dataRef "monte-carlo-data" matches "monte-carlo" pattern requiring 20+ keys.
		const simulationData: Record<string, unknown> = {};
		for (let i = 0; i < 25; i++) {
			simulationData[`sim_${i}`] = [10000 + i * 50];
		}
		const dataStore: DataStoreMap = new Map([
			[
				"monte-carlo-data",
				{
					data: simulationData,
					description: "Monte Carlo simulation results",
					component: "MonteCarloChart",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Simulation",
					blocks: [
						{
							type: "chart",
							component: "MonteCarloChart",
							dataRef: "monte-carlo-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(0);
		expect(result.report.sections[0]?.blocks[0]?.type).toBe("chart");
	});

	it("should not modify non-chart blocks", () => {
		const dataStore: DataStoreMap = new Map();

		const report = buildReport({
			sections: [
				{
					heading: "Analysis",
					blocks: [
						{ type: "prose", content: "Some analysis." },
						{
							type: "metrics",
							items: [
								{
									title: "Win Rate",
									value: "58%",
									tooltip: {
										what: "Win rate",
										why: "Consistency",
										benchmark: "50%+",
									},
								},
							],
						},
						{
							type: "callout",
							calloutType: "tip",
							content: "Keep it up!",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(0);
		expect(result.report.sections[0]?.blocks).toHaveLength(3);
		expect(result.report.sections[0]?.blocks[0]?.type).toBe("prose");
		expect(result.report.sections[0]?.blocks[1]?.type).toBe("metrics");
		expect(result.report.sections[0]?.blocks[2]?.type).toBe("callout");
	});

	it("should preserve executiveSummary and keyTakeaways unchanged", () => {
		const dataStore: DataStoreMap = new Map();

		const report = buildReport({
			executiveSummary: "This is the summary.",
			keyTakeaways: ["First takeaway", "Second takeaway"],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.report.executiveSummary).toBe("This is the summary.");
		expect(result.report.keyTakeaways).toEqual([
			"First takeaway",
			"Second takeaway",
		]);
	});

	it("should handle multiple sections with mixed valid and invalid chart blocks", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"equity-data",
				{
					data: Array.from({ length: 30 }, (_, i) => ({
						date: `2025-01-${i + 1}`,
						equity: 10000 + i * 100,
					})),
					description: "Equity data",
					component: "EquityCurve",
				},
			],
		]);

		const report = buildReport({
			sections: [
				{
					heading: "Good Section",
					blocks: [
						{
							type: "chart",
							component: "EquityCurve",
							dataRef: "equity-data",
						},
					],
				},
				{
					heading: "Bad Section",
					blocks: [
						{
							type: "chart",
							component: "MonthlyChart",
							dataRef: "missing-monthly-data",
						},
					],
				},
			],
		});

		const result = runValidatorPhase({ report, dataStore });

		expect(result.warnings).toHaveLength(1);
		// First section: chart preserved
		expect(result.report.sections[0]?.blocks[0]?.type).toBe("chart");
		// Second section: chart replaced with prose
		expect(result.report.sections[1]?.blocks[0]?.type).toBe("prose");
	});
});

// =============================================================================
// executeStoreReportData
// =============================================================================

describe("executeStoreReportData", () => {
	it("should store data with component metadata", () => {
		const dataStore: DataStoreMap = new Map();

		const result = executeStoreReportData(
			"equity-data",
			"Equity curve data",
			[{ date: "2025-01-01", equity: 10000 }],
			dataStore,
			"EquityCurve",
		);

		expect(result.success).toBe(true);
		const entry = dataStore.get("equity-data");
		expect(entry).toBeDefined();
		expect(entry?.component).toBe("EquityCurve");
		expect(entry?.description).toBe("Equity curve data");
		expect(Array.isArray(entry?.data)).toBe(true);
	});

	it("should store data without component when not specified", () => {
		const dataStore: DataStoreMap = new Map();

		const result = executeStoreReportData(
			"stats-data",
			"Overview statistics",
			{ winRate: 58.3 },
			dataStore,
		);

		expect(result.success).toBe(true);
		const entry = dataStore.get("stats-data");
		expect(entry).toBeDefined();
		expect(entry?.component).toBeUndefined();
		expect(entry?.description).toBe("Overview statistics");
	});

	it("should reject duplicate refIds", () => {
		const dataStore: DataStoreMap = new Map();

		executeStoreReportData("my-data", "First entry", [1, 2, 3], dataStore);
		const result = executeStoreReportData(
			"my-data",
			"Duplicate entry",
			[4, 5, 6],
			dataStore,
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain("already exists");
	});

	it("should reject empty refId", () => {
		const dataStore: DataStoreMap = new Map();

		const result = executeStoreReportData(
			"",
			"Empty key",
			[1, 2, 3],
			dataStore,
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain("non-empty");
	});

	it("should reject whitespace-only refId", () => {
		const dataStore: DataStoreMap = new Map();

		const result = executeStoreReportData(
			"   ",
			"Whitespace key",
			[1, 2, 3],
			dataStore,
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain("non-empty");
	});

	it("should include rowCount in result data for array data", () => {
		const dataStore: DataStoreMap = new Map();

		const result = executeStoreReportData(
			"array-data",
			"Array dataset",
			[1, 2, 3, 4, 5],
			dataStore,
			"EquityCurve",
		);

		expect(result.success).toBe(true);
		expect((result.data as Record<string, unknown>)?.rowCount).toBe(5);
	});

	it("should include component in result data when specified", () => {
		const dataStore: DataStoreMap = new Map();

		const result = executeStoreReportData(
			"chart-data",
			"Chart dataset",
			[1, 2],
			dataStore,
			"MonthlyChart",
		);

		expect(result.success).toBe(true);
		expect((result.data as Record<string, unknown>)?.component).toBe(
			"MonthlyChart",
		);
	});

	it("should not include component in result data when not specified", () => {
		const dataStore: DataStoreMap = new Map();

		const result = executeStoreReportData(
			"no-component",
			"No component",
			{ key: "value" },
			dataStore,
		);

		expect(result.success).toBe(true);
		expect((result.data as Record<string, unknown>)?.component).toBeUndefined();
	});
});
