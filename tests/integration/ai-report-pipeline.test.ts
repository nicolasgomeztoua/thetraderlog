/**
 * Integration tests for the AI report pipeline phases.
 *
 * Tests buildWriterContext, runValidatorPhase (component + dataRef validation),
 * and report template functions (getTemplate, getAllTemplates).
 *
 * Uses mocked compileMDX (RSC-only module) and mocked aiGenerateText
 * to test validator behavior in isolation.
 */

import { describe, expect, it, vi } from "vitest";

// =============================================================================
// MOCKS — Must be declared before module imports that use them
// =============================================================================

// Mock next-mdx-remote/rsc — compileMDX requires React Server Components
// which are unavailable in vitest. Default: compilation succeeds.
vi.mock("next-mdx-remote/rsc", () => ({
	compileMDX: vi.fn().mockResolvedValue({ content: null, frontmatter: {} }),
}));

// Mock remark-gfm (imported by validator)
vi.mock("remark-gfm", () => ({ default: [] }));

// Mock AI client — only needed if validator triggers auto-repair.
// Default mock returns the original content unchanged (simulating failed repair).
vi.mock("@/lib/ai/client", () => ({
	aiGenerateText: vi.fn().mockResolvedValue({
		text: "",
		totalTokens: 50,
		steps: [],
		finishReason: "stop",
	}),
}));

// =============================================================================
// IMPORTS — After mocks
// =============================================================================

import { compileMDX } from "next-mdx-remote/rsc";
import { aiGenerateText } from "@/lib/ai/client";
import { runValidatorPhase } from "@/lib/ai/report-pipeline/validator";
import { buildWriterContext } from "@/lib/ai/report-pipeline/writer-context";
import { getAllTemplates, getTemplate } from "@/lib/ai/report-templates/index";

// Fake LanguageModel for validator (never actually called when validation passes)
const fakeModel = {} as import("ai").LanguageModel;
const mockAiGenerateText = vi.mocked(aiGenerateText);

// =============================================================================
// buildWriterContext
// =============================================================================

describe("buildWriterContext", () => {
	it("should include data summaries for dataStore entries", () => {
		const dataStore = new Map<string, unknown>([
			[
				"equity-data",
				[
					{ date: "2025-01-01", equity: 10000 },
					{ date: "2025-01-02", equity: 10500 },
				],
			],
			["overview-stats", { winRate: 58.3, totalPnl: 1234.56 }],
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

	it("should include the MDX component catalog", () => {
		const result = buildWriterContext({
			dataStore: new Map(),
			plan: "Test plan",
		});

		expect(result).toContain("MDX Component Catalog");
		expect(result).toContain("EquityCurve");
		expect(result).toContain("MetricGrid");
		expect(result).toContain("MetricCard");
		expect(result).toContain("Callout");
		expect(result).toContain("MonteCarloChart");
	});

	it("should include formatting rules", () => {
		const result = buildWriterContext({
			dataStore: new Map(),
			plan: "Test plan",
		});

		expect(result).toContain("Formatting Rules");
		expect(result).toContain("NO LaTeX");
		expect(result).toContain("pipe-delimited markdown tables");
	});

	it("should exclude database schema and SQL docs", () => {
		const result = buildWriterContext({
			dataStore: new Map(),
			plan: "Test plan",
		});

		expect(result).not.toContain("CREATE TABLE");
		expect(result).not.toContain("SELECT");
		expect(result).not.toContain("tRPC");
		expect(result).not.toContain("protectedProcedure");
	});

	it("should handle empty dataStore gracefully", () => {
		const result = buildWriterContext({
			dataStore: new Map(),
			plan: "Test plan",
		});

		expect(result).toContain("No datasets were gathered");
	});

	it("should truncate array previews to 3 rows", () => {
		const largeArray = Array.from({ length: 20 }, (_, i) => ({
			day: i,
			pnl: i * 100,
		}));
		const dataStore = new Map<string, unknown>([["large-data", largeArray]]);

		const result = buildWriterContext({
			dataStore,
			plan: "Test plan",
		});

		expect(result).toContain("array of 20 items");
		expect(result).toContain("17 more rows");
	});
});

// =============================================================================
// runValidatorPhase
// =============================================================================

describe("runValidatorPhase", () => {
	it("should return valid for correct MDX with known components and valid dataRefs", async () => {
		const content = `# Performance Report

<MetricGrid>
  <MetricCard title="Win Rate" value="58.3%" tooltip={{ what: "Win percentage", why: "Core metric", benchmark: "Above 50%" }} />
</MetricGrid>

<EquityCurve dataRef="equity-data" />

<Callout type="tip">Your best day is Tuesday.</Callout>`;

		const result = await runValidatorPhase({
			content,
			dataStoreKeys: ["equity-data"],
			model: fakeModel,
		});

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.content).toBe(content);
	});

	it("should detect missing dataRef on chart components", async () => {
		const content = `# Report

<EquityCurve />`;

		// Mock repair to return the same broken content (repair fails to fix)
		mockAiGenerateText.mockResolvedValue({
			text: content,
			totalTokens: 50,
			steps: [],
			finishReason: "stop",
		} as Awaited<ReturnType<typeof aiGenerateText>>);

		const result = await runValidatorPhase({
			content,
			dataStoreKeys: ["equity-data"],
			model: fakeModel,
		});

		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(
			result.errors.some((e) => e.includes("missing required dataRef")),
		).toBe(true);
	});

	it("should detect non-existent dataRef keys", async () => {
		const content = `# Report

<EquityCurve dataRef="non-existent-key" />`;

		// Mock repair to return the same broken content
		mockAiGenerateText.mockResolvedValue({
			text: content,
			totalTokens: 50,
			steps: [],
			finishReason: "stop",
		} as Awaited<ReturnType<typeof aiGenerateText>>);

		const result = await runValidatorPhase({
			content,
			dataStoreKeys: ["equity-data", "monthly-data"],
			model: fakeModel,
		});

		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors.some((e) => e.includes("non-existent data key"))).toBe(
			true,
		);
	});

	it("should detect invalid component names", async () => {
		const content = `# Report

<FakeComponent dataRef="equity-data" />
<AnotherFake />`;

		// Mock repair to return the same broken content
		mockAiGenerateText.mockResolvedValue({
			text: content,
			totalTokens: 50,
			steps: [],
			finishReason: "stop",
		} as Awaited<ReturnType<typeof aiGenerateText>>);

		const result = await runValidatorPhase({
			content,
			dataStoreKeys: ["equity-data"],
			model: fakeModel,
		});

		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors.some((e) => e.includes("Unknown MDX component"))).toBe(
			true,
		);
		expect(result.errors.some((e) => e.includes("FakeComponent"))).toBe(true);
	});

	it("should detect MDX compilation errors", async () => {
		// Make compileMDX throw for this test and all repair re-validation attempts
		const mockCompileMDX = vi.mocked(compileMDX);
		mockCompileMDX
			.mockRejectedValueOnce(new Error("Unexpected token in MDX"))
			.mockRejectedValueOnce(new Error("Unexpected token in MDX"))
			.mockRejectedValueOnce(new Error("Unexpected token in MDX"));

		const content = `# Report

<Callout type="tip">Valid content</Callout>`;

		// Mock repair to return content that still fails compilation
		mockAiGenerateText.mockResolvedValue({
			text: content,
			totalTokens: 50,
			steps: [],
			finishReason: "stop",
		} as Awaited<ReturnType<typeof aiGenerateText>>);

		const result = await runValidatorPhase({
			content,
			dataStoreKeys: [],
			model: fakeModel,
		});

		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors.some((e) => e.includes("MDX compilation error"))).toBe(
			true,
		);
	});

	it("should return tokensUsed: 0 when validation passes without repair", async () => {
		const content = `# Report

<Callout type="tip">All good</Callout>`;

		const result = await runValidatorPhase({
			content,
			dataStoreKeys: [],
			model: fakeModel,
		});

		expect(result.valid).toBe(true);
		expect(result.tokensUsed).toBe(0);
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
