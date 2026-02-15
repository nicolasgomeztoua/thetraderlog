/**
 * Integration tests for the AI report pipeline.
 *
 * Tests buildWriterContext and report template functions (getTemplate, getAllTemplates).
 *
 * Note: Structured report schema validation, deterministic validator, and
 * store_report_data tests are covered in structured-report.test.ts (US-013).
 */

import { describe, expect, it } from "vitest";

import type { DataStoreMap } from "@/lib/ai/report-pipeline/report-schema";
import { buildWriterContext } from "@/lib/ai/report-pipeline/writer-context";
import { getAllTemplates, getTemplate } from "@/lib/ai/report-templates/index";

// =============================================================================
// buildWriterContext
// =============================================================================

describe("buildWriterContext", () => {
	it("should include data summaries for dataStore entries", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"equity-data",
				{
					data: [
						{ date: "2025-01-01", equity: 10000 },
						{ date: "2025-01-02", equity: 10500 },
					],
					description: "Equity curve data",
					component: "EquityCurve",
				},
			],
			[
				"overview-stats",
				{
					data: { winRate: 58.3, totalPnl: 1234.56 },
					description: "Overview statistics",
				},
			],
		]);

		const result = buildWriterContext({
			dataStore,
			plan: "Analyze monthly performance",
		});

		// Should contain the plan
		expect(result).toContain("Analyze monthly performance");
		// Should contain data summaries with refIds
		expect(result).toContain("equity-data");
		expect(result).toContain("overview-stats");
		// Should show array preview
		expect(result).toContain("array of 2 items");
		// Should show object keys
		expect(result).toContain("winRate");
		expect(result).toContain("totalPnl");
	});

	it("should include JSON formatting rules", () => {
		const dataStore: DataStoreMap = new Map();

		const result = buildWriterContext({
			dataStore,
			plan: "Test plan",
		});

		expect(result).toContain("Formatting Rules");
		expect(result).toContain("NO LaTeX");
		expect(result).toContain("DataRef Accuracy");
	});

	it("should exclude database schema and SQL docs", () => {
		const dataStore: DataStoreMap = new Map();

		const result = buildWriterContext({
			dataStore,
			plan: "Test plan",
		});

		expect(result).not.toContain("CREATE TABLE");
		expect(result).not.toContain("SELECT");
		expect(result).not.toContain("tRPC");
		expect(result).not.toContain("protectedProcedure");
	});

	it("should handle empty dataStore gracefully", () => {
		const dataStore: DataStoreMap = new Map();

		const result = buildWriterContext({
			dataStore,
			plan: "Test plan",
		});

		expect(result).toContain("No datasets were gathered");
	});

	it("should truncate array previews to 3 rows for large arrays", () => {
		const largeArray = Array.from({ length: 20 }, (_, i) => ({
			day: i,
			pnl: i * 100,
		}));
		const dataStore: DataStoreMap = new Map([
			[
				"large-data",
				{
					data: largeArray,
					description: "Large dataset",
				},
			],
		]);

		const result = buildWriterContext({
			dataStore,
			plan: "Test plan",
		});

		expect(result).toContain("array of 20 items");
		expect(result).toContain("17 more rows");
	});

	it("should show full data for small arrays", () => {
		const smallArray = Array.from({ length: 10 }, (_, i) => ({
			day: i,
			pnl: i * 100,
		}));
		const dataStore: DataStoreMap = new Map([
			[
				"small-data",
				{
					data: smallArray,
					description: "Small dataset",
				},
			],
		]);

		const result = buildWriterContext({
			dataStore,
			plan: "Test plan",
		});

		expect(result).toContain("array of 10 items");
		expect(result).toContain("FULL DATA");
	});

	it("should show component type hints when available", () => {
		const dataStore: DataStoreMap = new Map([
			[
				"equity-data",
				{
					data: [{ date: "2025-01-01", equity: 10000 }],
					description: "Equity curve",
					component: "EquityCurve",
				},
			],
		]);

		const result = buildWriterContext({
			dataStore,
			plan: "Test plan",
		});

		expect(result).toContain("equity-data");
		expect(result).toContain("EquityCurve");
	});
});

// =============================================================================
// Report Templates
// =============================================================================

describe("getTemplate", () => {
	it("should return the monthly-review template with correct structure", () => {
		const template = getTemplate("monthly-review");

		expect(template).toBeDefined();
		expect(template?.id).toBe("monthly-review");
		expect(template?.name).toBe("Monthly Review");
		expect(template?.description).toBeTruthy();
		expect(template?.sections.length).toBeGreaterThan(0);
		expect(template?.plannerHint).toBeTruthy();

		// Verify section structure
		for (const section of template?.sections ?? []) {
			expect(section.title).toBeTruthy();
			expect(section.description).toBeTruthy();
			expect(Array.isArray(section.suggestedDataSources)).toBe(true);
			expect(Array.isArray(section.suggestedComponents)).toBe(true);
		}
	});

	it("should return the risk-audit template with correct structure", () => {
		const template = getTemplate("risk-audit");

		expect(template).toBeDefined();
		expect(template?.id).toBe("risk-audit");
		expect(template?.name).toBe("Risk Audit");
		expect(template?.sections.length).toBeGreaterThan(0);
		expect(template?.plannerHint).toBeTruthy();
	});

	it("should return the strategy-comparison template with correct structure", () => {
		const template = getTemplate("strategy-comparison");

		expect(template).toBeDefined();
		expect(template?.id).toBe("strategy-comparison");
		expect(template?.name).toBe("Strategy Comparison");
		expect(template?.sections.length).toBeGreaterThan(0);
		expect(template?.plannerHint).toBeTruthy();
	});

	it("should return undefined for unknown template ids", () => {
		expect(getTemplate("unknown-template")).toBeUndefined();
		expect(getTemplate("")).toBeUndefined();
	});
});

describe("getAllTemplates", () => {
	it("should return all 3 templates", () => {
		const templates = getAllTemplates();

		expect(templates).toHaveLength(3);
	});

	it("should return templates with unique ids", () => {
		const templates = getAllTemplates();
		const ids = templates.map((t) => t.id);
		const uniqueIds = new Set(ids);

		expect(uniqueIds.size).toBe(templates.length);
	});

	it("should include all expected template ids", () => {
		const templates = getAllTemplates();
		const ids = templates.map((t) => t.id);

		expect(ids).toContain("monthly-review");
		expect(ids).toContain("risk-audit");
		expect(ids).toContain("strategy-comparison");
	});
});
