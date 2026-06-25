/**
 * Integration tests for the deleteReport tRPC endpoint.
 *
 * Verifies ownership enforcement, cascade deletion (report + backing
 * conversation + messages), and cancel-on-delete for in-flight reports.
 */

import { runs } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { ERR_REPORT_NOT_FOUND } from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	FULL_ACCESS_AUTH,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../utils";

// =============================================================================
// MOCKS
// =============================================================================

vi.mock("@/lib/ai/client", () => ({
	aiGenerateText: vi.fn().mockResolvedValue({
		text: "Mock response",
		totalTokens: 150,
		steps: [],
		finishReason: "stop",
	}),
	aiStreamText: vi.fn(),
	OpenRouterError: class OpenRouterError extends Error {},
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

describe("deleteReport endpoint", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;
	let cancelSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(async () => {
		await truncateAllTables();

		const user = await createTestUser({ name: "Delete Report User" });
		const userWithBeta = {
			...user,
			publicMetadata: { beta: true },
		} as unknown as User;
		const otherUser = await createTestUser({ name: "Other Delete User" });
		const otherWithBeta = {
			...otherUser,
			publicMetadata: { beta: true },
		} as unknown as User;

		caller = await createTestCaller(
			user.clerkId,
			userWithBeta,
			FULL_ACCESS_AUTH,
		);
		otherCaller = await createTestCaller(
			otherUser.clerkId,
			otherWithBeta,
			FULL_ACCESS_AUTH,
		);

		// runs.cancel hits the Trigger.dev API — stub it so delete stays local.
		// biome-ignore lint/suspicious/noExplicitAny: test stub for external SDK
		cancelSpy = vi.spyOn(runs, "cancel").mockResolvedValue({} as any);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	afterEach(() => {
		cancelSpy.mockClear();
	});

	async function startReport() {
		return caller.ai.startReport({
			prompt: "Analyze my trading performance",
			title: "Test Report",
		});
	}

	it("deletes a report and cascades to its conversation + messages", async () => {
		const report = await startReport();
		const db = getTestDb();
		// Take it out of the active state so no cancel is attempted.
		await db
			.update(schema.aiReports)
			.set({ status: "complete" })
			.where(eq(schema.aiReports.id, report.id));

		const result = await caller.ai.deleteReport({ reportId: report.id });
		expect(result).toEqual({ success: true });

		const stillReport = await db.query.aiReports.findFirst({
			where: eq(schema.aiReports.id, report.id),
		});
		expect(stillReport).toBeUndefined();

		const stillConversation = await db.query.aiConversations.findFirst({
			where: eq(schema.aiConversations.id, report.conversationId),
		});
		expect(stillConversation).toBeUndefined();

		const remainingMessages = await db.query.aiMessages.findMany({
			where: eq(schema.aiMessages.conversationId, report.conversationId),
		});
		expect(remainingMessages).toHaveLength(0);

		expect(cancelSpy).not.toHaveBeenCalled();
	});

	it("cancels the in-flight run when deleting an active report", async () => {
		const report = await startReport(); // status "queued" + triggerTaskId

		await caller.ai.deleteReport({ reportId: report.id });

		expect(cancelSpy).toHaveBeenCalledWith("mock-trigger-task-id");

		const db = getTestDb();
		const stillReport = await db.query.aiReports.findFirst({
			where: eq(schema.aiReports.id, report.id),
		});
		expect(stillReport).toBeUndefined();
	});

	it("rejects deleting another user's report", async () => {
		const report = await startReport();

		await expect(
			otherCaller.ai.deleteReport({ reportId: report.id }),
		).rejects.toThrow(ERR_REPORT_NOT_FOUND);

		// The report must still exist.
		const db = getTestDb();
		const stillReport = await db.query.aiReports.findFirst({
			where: eq(schema.aiReports.id, report.id),
		});
		expect(stillReport).toBeDefined();

		expect(cancelSpy).not.toHaveBeenCalled();
	});
});
