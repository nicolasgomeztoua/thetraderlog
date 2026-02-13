/**
 * Integration tests for the updated report tRPC endpoints.
 *
 * Tests the MDX content/dataArtifacts flow: getReportContent, listReports
 * hasContent flag, and getReport content field (no pdfUrl/pdfKey).
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ERR_REPORT_NOT_FOUND } from "@/lib/constants/errors";
import {
	createTestCaller,
	createTestUser,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../utils";

// =============================================================================
// MOCKS
// =============================================================================

vi.mock("@/lib/ai/client", () => ({
	chatCompletion: vi.fn().mockResolvedValue({
		id: "mock-response-id",
		choices: [
			{
				index: 0,
				message: {
					role: "assistant",
					content: "Mock response",
					tool_calls: undefined,
				},
				finish_reason: "stop",
			},
		],
		usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
		model: "moonshotai/kimi-k2",
	}),
	chatCompletionStream: vi.fn(),
}));

vi.mock("@/lib/ai/context-builder", () => ({
	buildUserContext: vi.fn().mockResolvedValue("Mock user context"),
}));

vi.mock("@/lib/ai/schema-context", () => ({
	generateSchemaContext: vi.fn().mockReturnValue("Mock schema context"),
}));

vi.mock("@/trigger/generate-ai-report", () => ({
	generateAiReport: {
		trigger: vi.fn().mockResolvedValue({ id: "mock-trigger-task-id" }),
	},
}));

// =============================================================================
// TEST SUITE
// =============================================================================

describe("report viewer endpoints", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();

		const user = await createTestUser({ name: "Report Viewer User" });
		const otherUser = await createTestUser({ name: "Other Report User" });

		caller = await createTestCaller(user.clerkId, user);
		otherCaller = await createTestCaller(otherUser.clerkId, otherUser);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// Helper: create a report and update it with content + dataArtifacts
	async function createCompletedReport(options?: {
		content?: string;
		dataArtifacts?: Record<string, unknown>;
	}) {
		const report = await caller.ai.startReport({
			prompt: "Analyze my trading performance",
			title: "Test Report",
		});

		const db = getTestDb();
		const content =
			options?.content ??
			'# Report\n\n<MetricCard label="Win Rate" value="65%" />';
		const dataArtifacts = options?.dataArtifacts ?? {
			equityCurveData: [
				{ date: "2025-01-01", equity: 10000 },
				{ date: "2025-01-02", equity: 10500 },
			],
		};

		await db
			.update(schema.aiReports)
			.set({
				status: "complete",
				content,
				dataArtifacts,
				completedAt: new Date(),
				tokensUsed: 5000,
				chartsGenerated: 3,
			})
			.where(eq(schema.aiReports.id, report.id));

		return { ...report, content, dataArtifacts };
	}

	// =========================================================================
	// getReportContent
	// =========================================================================

	describe("getReportContent", () => {
		it("should return content and dataArtifacts for a completed report", async () => {
			const created = await createCompletedReport();

			const report = await caller.ai.getReportContent({
				reportId: created.id,
			});

			expect(report).toBeDefined();
			expect(report.id).toBe(created.id);
			expect(report.title).toBe("Test Report");
			expect(report.content).toBe(created.content);
			expect(report.dataArtifacts).toEqual(created.dataArtifacts);
			expect(report.status).toBe("complete");
			expect(report.completedAt).toBeDefined();
			expect(report.model).toBeDefined();
			expect(report.tokensUsed).toBe(5000);
			expect(report.chartsGenerated).toBe(3);
			expect(report.prompt).toBe("Analyze my trading performance");
		});

		it("should return all expected fields in the response shape", async () => {
			const created = await createCompletedReport();

			const report = await caller.ai.getReportContent({
				reportId: created.id,
			});

			expect(report).toHaveProperty("id");
			expect(report).toHaveProperty("title");
			expect(report).toHaveProperty("content");
			expect(report).toHaveProperty("dataArtifacts");
			expect(report).toHaveProperty("status");
			expect(report).toHaveProperty("createdAt");
			expect(report).toHaveProperty("completedAt");
			expect(report).toHaveProperty("model");
			expect(report).toHaveProperty("tokensUsed");
			expect(report).toHaveProperty("chartsGenerated");
			expect(report).toHaveProperty("prompt");
		});

		it("should return null content for a queued report", async () => {
			const report = await caller.ai.startReport({
				prompt: "Pending report",
			});

			const result = await caller.ai.getReportContent({
				reportId: report.id,
			});

			expect(result.content).toBeNull();
			expect(result.dataArtifacts).toBeNull();
			expect(result.status).toBe("queued");
		});

		it("should throw for a non-existent report", async () => {
			await expect(
				caller.ai.getReportContent({ reportId: "non-existent-id" }),
			).rejects.toThrow(ERR_REPORT_NOT_FOUND);
		});

		it("should reject access to another user's report", async () => {
			const created = await createCompletedReport();

			await expect(
				otherCaller.ai.getReportContent({ reportId: created.id }),
			).rejects.toThrow(ERR_REPORT_NOT_FOUND);
		});
	});

	// =========================================================================
	// listReports — hasContent flag
	// =========================================================================

	describe("listReports hasContent flag", () => {
		it("should include hasContent: true for reports with content", async () => {
			await createCompletedReport();

			const result = await caller.ai.listReports({ limit: 100 });
			const withContent = result.items.filter((r) => r.hasContent);

			expect(withContent.length).toBeGreaterThan(0);
			for (const report of withContent) {
				expect(report.hasContent).toBe(true);
			}
		});

		it("should include hasContent: false for reports without content", async () => {
			// startReport creates a queued report with no content
			await caller.ai.startReport({ prompt: "No content yet" });

			const result = await caller.ai.listReports({ limit: 100 });
			const withoutContent = result.items.filter((r) => !r.hasContent);

			expect(withoutContent.length).toBeGreaterThan(0);
			for (const report of withoutContent) {
				expect(report.hasContent).toBe(false);
			}
		});
	});

	// =========================================================================
	// getReport — content field, no pdfUrl/pdfKey
	// =========================================================================

	describe("getReport content field", () => {
		it("should include content field in the response", async () => {
			const created = await createCompletedReport({
				content: "# Full Report\n\nDetailed analysis here.",
			});

			const report = await caller.ai.getReport({
				reportId: created.id,
			});

			expect(report).toBeDefined();
			expect(report.content).toBe("# Full Report\n\nDetailed analysis here.");
		});

		it("should not include pdfUrl or pdfKey fields", async () => {
			const created = await createCompletedReport();

			const report = await caller.ai.getReport({
				reportId: created.id,
			});

			// These columns were removed in US-001 schema migration
			expect(report).not.toHaveProperty("pdfUrl");
			expect(report).not.toHaveProperty("pdfKey");
		});

		it("should include dataArtifacts in the response", async () => {
			const artifacts = {
				winRateBySymbol: [
					{ symbol: "ES", winRate: 0.65 },
					{ symbol: "NQ", winRate: 0.58 },
				],
			};
			const created = await createCompletedReport({
				dataArtifacts: artifacts,
			});

			const report = await caller.ai.getReport({
				reportId: created.id,
			});

			expect(report.dataArtifacts).toEqual(artifacts);
		});
	});
});
