/**
 * Integration tests for AI tRPC router.
 *
 * Tests conversation CRUD, message sending with mocked OpenRouter,
 * report creation with mocked Trigger.dev, and user ownership isolation.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { aiGenerateText } from "@/lib/ai/client";
import {
	DEFAULT_CHAT_MODEL,
	DEFAULT_REPORT_MODEL,
	DEFAULT_VISION_MODEL,
} from "@/lib/constants/ai";
import {
	ERR_ACCESS_DENIED,
	ERR_CONVERSATION_NOT_FOUND,
	ERR_MESSAGE_NOT_FOUND,
	ERR_REPORT_NOT_FOUND,
} from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	FULL_ACCESS_AUTH,
	type TestCaller,
	truncateAllTables,
} from "../utils";

/** Build a mocked aiGenerateText result that emits a propose_trade tool call. */
function mockProposeTradeResult(input: Record<string, unknown>) {
	return {
		text: "Here's what I read off the chart — review and confirm.",
		totalTokens: 200,
		steps: [
			{ toolCalls: [{ toolCallId: "tc_1", toolName: "propose_trade", input }] },
		],
		finishReason: "stop",
	} as unknown as Awaited<ReturnType<typeof aiGenerateText>>;
}

// =============================================================================
// MOCKS — Must be declared before any module imports that use them
// =============================================================================

// Mock Vercel AI SDK client — return a simple text response by default
vi.mock("@/lib/ai/client", () => ({
	aiGenerateText: vi.fn().mockResolvedValue({
		text: "This is a mock AI response about your trading data.",
		totalTokens: 150,
		steps: [],
		finishReason: "stop",
	}),
	aiStreamText: vi.fn(),
	OpenRouterError: class OpenRouterError extends Error {
		statusCode: number;
		retryable: boolean;
		constructor(message: string, statusCode: number, retryable = false) {
			super(message);
			this.name = "OpenRouterError";
			this.statusCode = statusCode;
			this.retryable = retryable;
		}
	},
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

// Mock S3 so the multimodal message-build path runs under vitest (the real
// isS3Configured() returns false outside the Bun runtime, which would otherwise
// skip image assembly entirely and leave the vision path untested).
vi.mock("@/lib/storage/s3", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/storage/s3")>()),
	isS3Configured: () => true,
	getPresignedDownloadUrl: (key: string) => `https://s3.test/${key}`,
}));

// =============================================================================
// TEST SUITE
// =============================================================================

describe("ai router", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;
	let testUserId: string;

	beforeAll(async () => {
		await truncateAllTables();

		// Create two users to test ownership isolation
		// Beta metadata bypasses usage limits (these tests test AI CRUD, not billing)
		const user = await createTestUser({ name: "AI Test User" });
		testUserId = user.id;
		const userWithBeta = {
			...user,
			publicMetadata: { beta: true },
		} as unknown as User;
		const otherUser = await createTestUser({ name: "Other User" });
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

		it("should create a conversation with initialPrompt", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
				initialPrompt: "Analyze my trading performance",
			});

			expect(conversation).toBeDefined();
			expect(conversation.mode).toBe("chat");
			expect(conversation.model).toBe(DEFAULT_CHAT_MODEL);
			expect(conversation.initialPrompt).toBe("Analyze my trading performance");
		});

		it("should use default model when none specified", async () => {
			const conversation = await caller.ai.createConversation({
				mode: "chat",
			});

			expect(conversation.model).toBe(DEFAULT_CHAT_MODEL);
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
			expect(response?.model).toBe(DEFAULT_CHAT_MODEL);
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
	// sendMessage — chart image attachments (vision)
	// =========================================================================

	describe("sendMessage with chart images", () => {
		it("should persist attachments and route to the vision model", async () => {
			const conversation = await caller.ai.createConversation({ mode: "chat" });
			const key = `images/${testUserId}/ai-chat/chart.png`;

			const response = await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Log this trade",
				imageAttachments: [
					{ key, mimeType: "image/png", filename: "chart.png", size: 4242 },
				],
			});

			// Image-bearing turn uses the vision model, not the chat default.
			expect(response?.model).toBe(DEFAULT_VISION_MODEL);

			// The model actually receives a multimodal message with an image part.
			const callArgs = vi.mocked(aiGenerateText).mock.lastCall?.[0];
			const sentUser = callArgs?.messages.find((m) => m.role === "user");
			expect(Array.isArray(sentUser?.content)).toBe(true);
			const parts = Array.isArray(sentUser?.content) ? sentUser.content : [];
			expect(parts.some((p) => p.type === "image")).toBe(true);

			const updated = await caller.ai.getConversation({
				conversationId: conversation.id,
			});
			const userMessage = updated.messages.find((m) => m.role === "user");
			expect(userMessage?.attachments).toHaveLength(1);
			expect(userMessage?.attachments?.[0]?.key).toBe(key);
		});

		it("should NOT re-send a prior chart on a later text-only turn (routes to chat model)", async () => {
			const conversation = await caller.ai.createConversation({ mode: "chat" });

			// Turn 1: paste a chart → vision model.
			await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Log this",
				imageAttachments: [
					{
						key: `images/${testUserId}/ai-chat/turn1.png`,
						mimeType: "image/png",
						size: 3000,
					},
				],
			});

			// Turn 2: text-only follow-up → must use the chat (text) model and carry
			// no image parts (the old chart is not re-sent).
			const followUp = await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Actually entry was 5012.50",
			});

			expect(followUp?.model).toBe(DEFAULT_CHAT_MODEL);
			const callArgs = vi.mocked(aiGenerateText).mock.lastCall?.[0];
			const hasAnyImage = (callArgs?.messages ?? []).some(
				(m) =>
					Array.isArray(m.content) && m.content.some((p) => p.type === "image"),
			);
			expect(hasAnyImage).toBe(false);
		});

		it("should allow an image-only message (no text)", async () => {
			const conversation = await caller.ai.createConversation({ mode: "chat" });
			const key = `images/${testUserId}/ai-chat/only.png`;

			const response = await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "",
				imageAttachments: [{ key, mimeType: "image/png", size: 1000 }],
			});

			expect(response?.role).toBe("assistant");
			expect(response?.model).toBe(DEFAULT_VISION_MODEL);
		});

		it("should reject image keys not owned by the user", async () => {
			const conversation = await caller.ai.createConversation({ mode: "chat" });

			await expect(
				caller.ai.sendMessage({
					conversationId: conversation.id,
					content: "sneaky",
					imageAttachments: [
						{ key: "images/someone-else/ai-chat/x.png", mimeType: "image/png" },
					],
				}),
			).rejects.toThrow(ERR_ACCESS_DENIED);
		});

		it("should store a propose_trade proposal in the assistant toolCalls", async () => {
			vi.mocked(aiGenerateText).mockResolvedValueOnce(
				mockProposeTradeResult({
					symbol: "NQ",
					direction: "short",
					entryPrice: "29555.25",
					isClosed: false,
					lowConfidenceFields: ["entryPrice"],
				}),
			);

			const conversation = await caller.ai.createConversation({ mode: "chat" });
			const response = await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Log this",
				imageAttachments: [
					{
						key: `images/${testUserId}/ai-chat/p.png`,
						mimeType: "image/png",
						size: 2000,
					},
				],
			});

			expect(response?.toolCalls).toBeTruthy();
			const toolCalls = JSON.parse(response?.toolCalls ?? "[]") as {
				function: { name: string; arguments: string };
			}[];
			const propose = toolCalls.find(
				(tc) => tc.function.name === "propose_trade",
			);
			expect(propose).toBeDefined();
			const args = JSON.parse(propose?.function.arguments ?? "{}");
			expect(args.symbol).toBe("NQ");
			expect(args.direction).toBe("short");
		});
	});

	// =========================================================================
	// markProposalLogged
	// =========================================================================

	describe("markProposalLogged", () => {
		it("should record the logged tradeId on the message", async () => {
			const conversation = await caller.ai.createConversation({ mode: "chat" });
			const assistant = await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Log this trade",
			});

			await caller.ai.markProposalLogged({
				messageId: assistant?.id ?? "",
				tradeId: "trade_test_123",
			});

			const updated = await caller.ai.getConversation({
				conversationId: conversation.id,
			});
			const marked = updated.messages.find((m) => m.id === assistant?.id);
			expect(marked?.loggedTradeId).toBe("trade_test_123");
		});

		it("should reject marking a message in another user's conversation", async () => {
			const conversation = await caller.ai.createConversation({ mode: "chat" });
			const assistant = await caller.ai.sendMessage({
				conversationId: conversation.id,
				content: "My private trade",
			});

			await expect(
				otherCaller.ai.markProposalLogged({
					messageId: assistant?.id ?? "",
					tradeId: "trade_hijack",
				}),
			).rejects.toThrow(ERR_ACCESS_DENIED);
		});

		it("should throw for a non-existent message", async () => {
			await expect(
				caller.ai.markProposalLogged({
					messageId: "nonexistent_message_id",
					tradeId: "trade_x",
				}),
			).rejects.toThrow(ERR_MESSAGE_NOT_FOUND);
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
