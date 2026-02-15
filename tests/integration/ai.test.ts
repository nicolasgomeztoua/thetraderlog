/**
 * Integration tests for AI tRPC router.
 *
 * Tests conversation CRUD, message sending with mocked OpenRouter,
 * report creation with mocked Trigger.dev, and user ownership isolation.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAT_MODEL, DEFAULT_REPORT_MODEL } from "@/lib/constants/ai";
import {
	ERR_CONVERSATION_NOT_FOUND,
	ERR_REPORT_NOT_FOUND,
} from "@/lib/constants/errors";
import {
	createTestCaller,
	createTestUser,
	type TestCaller,
	truncateAllTables,
} from "../utils";

// =============================================================================
// MOCKS — Must be declared before any module imports that use them
// =============================================================================

// Mock OpenRouter client — return a simple text response by default
vi.mock("@/lib/ai/client", () => ({
	chatCompletion: vi.fn().mockResolvedValue({
		id: "mock-response-id",
		choices: [
			{
				index: 0,
				message: {
					role: "assistant",
					content: "This is a mock AI response about your trading data.",
					tool_calls: undefined,
				},
				finish_reason: "stop",
			},
		],
		usage: {
			prompt_tokens: 100,
			completion_tokens: 50,
			total_tokens: 150,
		},
		model: "moonshotai/kimi-k2",
	}),
	chatCompletionStream: vi.fn(),
}));

// Mock context builders — return static strings to avoid DB lookups
vi.mock("@/lib/ai/context-builder", () => ({
	buildUserContext: vi.fn().mockResolvedValue("Mock user context for testing"),
}));

vi.mock("@/lib/ai/schema-context", () => ({
	generateSchemaContext: vi
		.fn()
		.mockReturnValue("Mock schema context for testing"),
}));

// Mock Trigger.dev report task
vi.mock("@/trigger/generate-ai-report", () => ({
	generateAiReport: {
		trigger: vi.fn().mockResolvedValue({
			id: "mock-trigger-task-id",
		}),
	},
}));

// =============================================================================
// TEST SUITE
// =============================================================================

describe("ai router", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();

		// Create two users to test ownership isolation
		const user = await createTestUser({ name: "AI Test User" });
		const otherUser = await createTestUser({ name: "Other User" });

		caller = await createTestCaller(user.clerkId, user);
		otherCaller = await createTestCaller(otherUser.clerkId, otherUser);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =========================================================================
	// createConversation
	// =========================================================================

	describe("createConversation", () => {
		it("should create a conversation in chat mode", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			expect(conversation).toBeDefined();
			expect(conversation.id).toBeDefined();
			expect(conversation.mode).toBe("chat");
			expect(conversation.status).toBe("active");
		});

		it("should create a conversation in report mode", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "report",
				initialPrompt: "Analyze my trading performance",
			});

			expect(conversation).toBeDefined();
			expect(conversation.mode).toBe("report");
			expect(conversation.model).toBe(DEFAULT_CHAT_MODEL);
			expect(conversation.initialPrompt).toBe("Analyze my trading performance");
		});

		it("should use default model when none specified", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			expect(conversation.model).toBe("moonshotai/kimi-k2");
		});
	});

	// =========================================================================
	// sendMessage
	// =========================================================================

	describe("sendMessage", () => {
		it("should save user message and return assistant response", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			const response = await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "What was my best trading day?",
			});

			expect(response).toBeDefined();
			expect(response?.role).toBe("assistant");
			expect(response?.content).toBe(
				"This is a mock AI response about your trading data.",
			);
			expect(response?.model).toBe("moonshotai/kimi-k2");
			expect(response?.tokensUsed).toBe(150);
		});

		it("should set conversation title from first user message", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Show me my P&L this week",
			});

			const updated = await caller.ai.getConversation({
				conversationId: conversation.id,
			});

			expect(updated.title).toBe("Show me my P&L this week");
		});

		it("should truncate long messages for conversation title", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			const longMessage = "A".repeat(200);
			await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: longMessage,
			});

			const updated = await caller.ai.getConversation({
				conversationId: conversation.id,
			});

			expect(updated.title?.length).toBeLessThanOrEqual(100);
			expect(updated.title?.endsWith("...")).toBe(true);
		});

		it("should reject sending to another user's conversation", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			await expect(
				otherCaller.ai.sendMessage({
					conversationId: conversation.id,
					content: "Trying to access someone else's chat",
				}),
			).rejects.toThrow(ERR_CONVERSATION_NOT_FOUND);
		});
	});

	// =========================================================================
	// getConversation
	// =========================================================================

	describe("getConversation", () => {
		it("should return conversation with messages ordered by createdAt", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			// Send a message (creates both user + assistant messages)
			await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "First question",
			});

			const result = await caller.ai.getConversation({
				conversationId: conversation.id,
			});

			expect(result).toBeDefined();
			expect(result.id).toBe(conversation.id);
			expect(result.messages.length).toBe(2); // user + assistant
			expect(result.messages[0]?.role).toBe("user");
			expect(result.messages[0]?.content).toBe("First question");
			expect(result.messages[1]?.role).toBe("assistant");
		});

		it("should reject fetching another user's conversation", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			await expect(
				otherCaller.ai.getConversation({
					conversationId: conversation.id,
				}),
			).rejects.toThrow(ERR_CONVERSATION_NOT_FOUND);
		});
	});

	// =========================================================================
	// listConversations
	// =========================================================================

	describe("listConversations", () => {
		it("should return only the current user's conversations", async () => {
			// Create conversations for both users
			await caller.ai.createConversation({ mode: "chat" });
			await otherCaller.ai.createConversation({ mode: "chat" });

			const result = await caller.ai.listConversations({ limit: 100 });
			const otherResult = await otherCaller.ai.listConversations({
				limit: 100,
			});

			// Each user should only see their own conversations
			// caller has created multiple conversations throughout the test suite
			expect(result.items.length).toBeGreaterThan(0);
			expect(otherResult.items.length).toBeGreaterThan(0);

			// Verify no cross-contamination: conversation IDs shouldn't overlap
			const callerIds = new Set(result.items.map((c) => c.id));
			const otherIds = new Set(otherResult.items.map((c) => c.id));
			for (const id of callerIds) {
				expect(otherIds.has(id)).toBe(false);
			}
		});

		it("should return conversations in most-recent-first order", async () => {
			const result = await caller.ai.listConversations({ limit: 100 });

			for (let i = 1; i < result.items.length; i++) {
				const prev = new Date(result.items[i - 1]?.createdAt ?? 0).getTime();
				const curr = new Date(result.items[i]?.createdAt ?? 0).getTime();
				expect(prev).toBeGreaterThanOrEqual(curr);
			}
		});
	});

	// =========================================================================
	// deleteConversation
	// =========================================================================

	describe("deleteConversation", () => {
		it("should delete a conversation and its messages", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			// Send a message to create messages
			await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "A message to delete",
			});

			// Delete the conversation
			const result = await caller.ai.deleteConversation({
				conversationId: conversation.id,
			});
			expect(result.success).toBe(true);

			// Verify conversation is gone
			await expect(
				caller.ai.getConversation({
					conversationId: conversation.id,
				}),
			).rejects.toThrow(ERR_CONVERSATION_NOT_FOUND);
		});

		it("should reject deleting another user's conversation", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			await expect(
				otherCaller.ai.deleteConversation({
					conversationId: conversation.id,
				}),
			).rejects.toThrow(ERR_CONVERSATION_NOT_FOUND);
		});
	});

	// =========================================================================
	// startReport
	// =========================================================================

	describe("startReport", () => {
		it("should create a report with conversation and initial message", async () => {
			const result = await caller.ai.startReport({
				prompt: "Analyze my win rate trends over the last month",
			});

			expect(result).toBeDefined();
			expect(result.id).toBeDefined();
			expect(result.status).toBe("queued");
			expect(result.prompt).toBe(
				"Analyze my win rate trends over the last month",
			);
			expect(result.triggerTaskId).toBe("mock-trigger-task-id");
		});

		it("should use default report model when none specified", async () => {
			const result = await caller.ai.startReport({
				prompt: "Generate a report",
			});

			expect(result.model).toBe(DEFAULT_REPORT_MODEL);
		});

		it("should use custom title when provided", async () => {
			const result = await caller.ai.startReport({
				prompt: "Analyze my performance this quarter",
				title: "Q1 Performance Report",
			});

			expect(result.title).toBe("Q1 Performance Report");
		});

		it("should auto-generate title from prompt when not provided", async () => {
			const result = await caller.ai.startReport({
				prompt: "Analyze my win rate by symbol and session for January",
			});

			expect(result.title).toBe(
				"Analyze my win rate by symbol and session for January",
			);
		});
	});

	// =========================================================================
	// getReport & getReportStatus
	// =========================================================================

	describe("getReport", () => {
		it("should return report with conversation and messages", async () => {
			const created = await caller.ai.startReport({
				prompt: "Deep analysis of my risk management",
			});

			const report = await caller.ai.getReport({
				reportId: created.id,
			});

			expect(report).toBeDefined();
			expect(report.id).toBe(created.id);
			expect(report.conversation).toBeDefined();
			expect(report.conversation.messages.length).toBe(1); // Initial prompt message
			expect(report.conversation.messages[0]?.role).toBe("user");
			expect(report.conversation.messages[0]?.content).toBe(
				"Deep analysis of my risk management",
			);
		});

		it("should reject fetching another user's report", async () => {
			const created = await caller.ai.startReport({
				prompt: "My report",
			});

			await expect(
				otherCaller.ai.getReport({ reportId: created.id }),
			).rejects.toThrow(ERR_REPORT_NOT_FOUND);
		});
	});

	describe("getReportStatus", () => {
		it("should return lightweight status fields only", async () => {
			const created = await caller.ai.startReport({
				prompt: "Status check report",
			});

			const status = await caller.ai.getReportStatus({
				reportId: created.id,
			});

			expect(status).toBeDefined();
			expect(status.id).toBe(created.id);
			expect(status.status).toBe("queued");
			expect(status.completedAt).toBeNull();
		});

		it("should return progress fields with correct defaults", async () => {
			const created = await caller.ai.startReport({
				prompt: "Progress defaults report",
			});

			const status = await caller.ai.getReportStatus({
				reportId: created.id,
			});

			expect(status.progressStage).toBe("queued");
			expect(status.currentRound).toBe(0);
			expect(status.totalToolCalls).toBe(0);
			expect(status.chartsGenerated).toBe(0);
		});

		it("should include progressStage in response shape", async () => {
			const created = await caller.ai.startReport({
				prompt: "Shape check report",
			});

			const status = await caller.ai.getReportStatus({
				reportId: created.id,
			});

			expect(status).toHaveProperty("progressStage");
			expect(status).toHaveProperty("currentRound");
			expect(status).toHaveProperty("totalToolCalls");
			expect(status).toHaveProperty("chartsGenerated");
		});

		it("should reject fetching another user's report status", async () => {
			const created = await caller.ai.startReport({
				prompt: "Another report",
			});

			await expect(
				otherCaller.ai.getReportStatus({ reportId: created.id }),
			).rejects.toThrow(ERR_REPORT_NOT_FOUND);
		});
	});

	// =========================================================================
	// listReports
	// =========================================================================

	describe("listReports", () => {
		it("should return only the current user's reports", async () => {
			// Create a report for the other user too
			await otherCaller.ai.startReport({
				prompt: "Other user's report",
			});

			const result = await caller.ai.listReports({ limit: 100 });
			const otherResult = await otherCaller.ai.listReports({ limit: 100 });

			expect(result.items.length).toBeGreaterThan(0);
			expect(otherResult.items.length).toBeGreaterThan(0);

			// Verify no cross-contamination
			const callerIds = new Set(result.items.map((r) => r.id));
			const otherIds = new Set(otherResult.items.map((r) => r.id));
			for (const id of callerIds) {
				expect(otherIds.has(id)).toBe(false);
			}
		});
	});

	// =========================================================================
	// Auth rejection
	// =========================================================================

	describe("authentication", () => {
		it("should reject unauthenticated requests to createConversation", async () => {
			const { createUnauthenticatedCaller } = await import("../utils");
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.ai.createConversation({ mode: "chat" }),
			).rejects.toThrow("UNAUTHORIZED");
		});
	});
});
