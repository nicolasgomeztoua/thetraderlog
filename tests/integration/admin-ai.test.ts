/**
 * Integration tests for admin AI usage endpoints.
 *
 * Tests:
 * - listConversations returns conversations with user info
 * - filter by mode (chat vs report) works
 * - getConversation returns messages
 * - usageStats returns aggregated data
 * - non-admin rejected
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	ERR_ADMIN_CONVERSATION_NOT_FOUND,
	ERR_ADMIN_FORBIDDEN,
} from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	createUnauthenticatedCaller,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("admin AI endpoints", () => {
	let adminCaller: TestCaller;
	let adminUser: User;
	let regularUser: User;

	// Store conversation IDs for later tests
	let chatConvoId: string;
	let reportConvoId: string;

	beforeAll(async () => {
		await truncateAllTables();
		const db = getTestDb();

		// Create users
		adminUser = await createTestUser({
			role: "admin",
			email: "admin-ai@test.local",
			name: "Admin AI User",
		});
		adminCaller = await createTestCaller(adminUser.clerkId, adminUser);

		regularUser = await createTestUser({
			role: "user",
			email: "regular-ai@test.local",
			name: "Regular AI User",
		});
		// regularUser is used for seeding data only; auth tests create fresh users

		// Seed AI conversations and messages
		const [chatConvo] = await db
			.insert(schema.aiConversations)
			.values({
				userId: adminUser.id,
				title: "Chat Conversation",
				status: "complete",
				mode: "chat",
				model: "gpt-4",
			})
			.returning();
		chatConvoId = chatConvo?.id ?? "";

		const [reportConvo] = await db
			.insert(schema.aiConversations)
			.values({
				userId: regularUser.id,
				title: "Report Conversation",
				status: "active",
				mode: "report",
				model: "claude-3",
			})
			.returning();
		reportConvoId = reportConvo?.id ?? "";

		// Add a third conversation for pagination testing
		await db.insert(schema.aiConversations).values({
			userId: adminUser.id,
			title: "Another Chat",
			status: "active",
			mode: "chat",
			model: "gpt-4",
		});

		// Seed messages for chat conversation
		await db.insert(schema.aiMessages).values([
			{
				conversationId: chatConvoId,
				role: "user",
				content: "Analyze my trades",
				tokensUsed: 15,
			},
			{
				conversationId: chatConvoId,
				role: "assistant",
				content: "Here is your trade analysis...",
				model: "gpt-4",
				tokensUsed: 120,
			},
			{
				conversationId: chatConvoId,
				role: "user",
				content: "Tell me more",
				tokensUsed: 8,
			},
		]);

		// Seed messages for report conversation
		await db.insert(schema.aiMessages).values([
			{
				conversationId: reportConvoId,
				role: "user",
				content: "Generate weekly report",
				tokensUsed: 20,
			},
			{
				conversationId: reportConvoId,
				role: "assistant",
				content: "Weekly performance report...",
				model: "claude-3",
				tokensUsed: 250,
			},
		]);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("admin.ai.listConversations", () => {
		it("should return conversations with user info", async () => {
			const result = await adminCaller.admin.ai.listConversations({});

			expect(result.items.length).toBeGreaterThanOrEqual(3);
			expect(result.total).toBeGreaterThanOrEqual(3);

			// Check that user info is present on each item
			for (const item of result.items) {
				expect(item.user).toBeDefined();
				expect(item.user.id).toBeDefined();
				expect(item.user.name).toBeDefined();
				expect(item.user.email).toBeDefined();
			}
		});

		it("should include message count and token count", async () => {
			const result = await adminCaller.admin.ai.listConversations({});

			// Find the chat conversation (has 3 messages, 143 tokens)
			const chatItem = result.items.find((i) => i.id === chatConvoId);
			expect(chatItem).toBeDefined();
			expect(chatItem?.messageCount).toBe(3);
			expect(chatItem?.tokenCount).toBe(143);

			// Find the report conversation (has 2 messages, 270 tokens)
			const reportItem = result.items.find((i) => i.id === reportConvoId);
			expect(reportItem).toBeDefined();
			expect(reportItem?.messageCount).toBe(2);
			expect(reportItem?.tokenCount).toBe(270);
		});

		it("should filter by mode chat", async () => {
			const result = await adminCaller.admin.ai.listConversations({
				mode: "chat",
			});

			expect(result.items.length).toBe(2);
			for (const item of result.items) {
				expect(item.mode).toBe("chat");
			}
		});

		it("should filter by mode report", async () => {
			const result = await adminCaller.admin.ai.listConversations({
				mode: "report",
			});

			expect(result.items.length).toBe(1);
			expect(result.items[0]?.mode).toBe("report");
			expect(result.items[0]?.title).toBe("Report Conversation");
		});

		it("should filter by status", async () => {
			const result = await adminCaller.admin.ai.listConversations({
				status: "complete",
			});

			expect(result.items.length).toBe(1);
			expect(result.items[0]?.status).toBe("complete");
			expect(result.items[0]?.id).toBe(chatConvoId);
		});

		it("should support pagination", async () => {
			const page1 = await adminCaller.admin.ai.listConversations({
				page: 1,
				pageSize: 2,
			});

			expect(page1.items.length).toBe(2);
			expect(page1.total).toBe(3);
			expect(page1.totalPages).toBe(2);
			expect(page1.page).toBe(1);

			const page2 = await adminCaller.admin.ai.listConversations({
				page: 2,
				pageSize: 2,
			});

			expect(page2.items.length).toBe(1);
			expect(page2.page).toBe(2);
		});

		it("should sort by newest first", async () => {
			const result = await adminCaller.admin.ai.listConversations({});

			for (let i = 0; i < result.items.length - 1; i++) {
				const current = new Date(result.items[i]?.createdAt ?? 0).getTime();
				const next = new Date(result.items[i + 1]?.createdAt ?? 0).getTime();
				expect(current).toBeGreaterThanOrEqual(next);
			}
		});
	});

	describe("admin.ai.getConversation", () => {
		it("should return conversation with messages", async () => {
			const result = await adminCaller.admin.ai.getConversation({
				id: chatConvoId,
			});

			expect(result.id).toBe(chatConvoId);
			expect(result.title).toBe("Chat Conversation");
			expect(result.status).toBe("complete");
			expect(result.mode).toBe("chat");
			expect(result.model).toBe("gpt-4");

			// User info
			expect(result.user.id).toBe(adminUser.id);
			expect(result.user.name).toBe("Admin AI User");

			// Messages
			expect(result.messages.length).toBe(3);
			expect(result.messages[0]?.role).toBe("user");
			expect(result.messages[0]?.content).toBe("Analyze my trades");
			expect(result.messages[1]?.role).toBe("assistant");
			expect(result.messages[1]?.model).toBe("gpt-4");
			expect(result.messages[2]?.role).toBe("user");
		});

		it("should order messages by createdAt ascending", async () => {
			const result = await adminCaller.admin.ai.getConversation({
				id: chatConvoId,
			});

			for (let i = 0; i < result.messages.length - 1; i++) {
				const current = new Date(result.messages[i]?.createdAt ?? 0).getTime();
				const next = new Date(result.messages[i + 1]?.createdAt ?? 0).getTime();
				expect(current).toBeLessThanOrEqual(next);
			}
		});

		it("should throw NOT_FOUND for non-existent conversation", async () => {
			await expect(
				adminCaller.admin.ai.getConversation({ id: "nonexistent-id" }),
			).rejects.toThrow(ERR_ADMIN_CONVERSATION_NOT_FOUND);
		});
	});

	describe("admin.ai.usageStats", () => {
		it("should return total tokens used", async () => {
			const stats = await adminCaller.admin.ai.usageStats();

			// Total tokens: 15 + 120 + 8 + 20 + 250 = 413
			expect(stats.totalTokensUsed).toBe(413);
		});

		it("should return tokens by model", async () => {
			const stats = await adminCaller.admin.ai.usageStats();

			expect(stats.tokensByModel.length).toBeGreaterThanOrEqual(2);

			const gpt4 = stats.tokensByModel.find((m) => m.model === "gpt-4");
			expect(gpt4).toBeDefined();
			// gpt-4 tokens: 120 (assistant message)
			expect(gpt4?.tokens).toBe(120);

			const claude = stats.tokensByModel.find((m) => m.model === "claude-3");
			expect(claude).toBeDefined();
			// claude-3 tokens: 250 (assistant message)
			expect(claude?.tokens).toBe(250);
		});

		it("should return conversations by mode", async () => {
			const stats = await adminCaller.admin.ai.usageStats();

			const chatMode = stats.conversationsByMode.find((m) => m.mode === "chat");
			expect(chatMode).toBeDefined();
			expect(chatMode?.count).toBe(2);

			const reportMode = stats.conversationsByMode.find(
				(m) => m.mode === "report",
			);
			expect(reportMode).toBeDefined();
			expect(reportMode?.count).toBe(1);
		});

		it("should return daily usage for last 30 days", async () => {
			const stats = await adminCaller.admin.ai.usageStats();

			// All messages were created today, so we should have at least 1 day
			expect(stats.dailyUsage.length).toBeGreaterThanOrEqual(1);

			const today = stats.dailyUsage[0];
			expect(today).toBeDefined();
			expect(today?.tokens).toBeGreaterThan(0);
			expect(today?.messageCount).toBeGreaterThan(0);
		});

		it("should return zero tokens when no messages exist", async () => {
			await truncateAllTables();

			const freshAdmin = await createTestUser({
				role: "admin",
				email: "fresh-ai-admin@test.local",
				name: "Fresh AI Admin",
			});
			const freshCaller = await createTestCaller(
				freshAdmin.clerkId,
				freshAdmin,
			);

			const stats = await freshCaller.admin.ai.usageStats();
			expect(stats.totalTokensUsed).toBe(0);
			expect(stats.tokensByModel.length).toBe(0);
			expect(stats.conversationsByMode.length).toBe(0);
			expect(stats.dailyUsage.length).toBe(0);
		});
	});

	describe("auth", () => {
		it("should reject non-admin on listConversations", async () => {
			const newRegular = await createTestUser({
				role: "user",
				email: "nonadmin-ai@test.local",
				name: "Non-Admin AI",
			});
			const nonAdminCaller = await createTestCaller(
				newRegular.clerkId,
				newRegular,
			);

			await expect(
				nonAdminCaller.admin.ai.listConversations({}),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject non-admin on getConversation", async () => {
			const newRegular = await createTestUser({
				role: "user",
				email: "nonadmin-ai2@test.local",
				name: "Non-Admin AI 2",
			});
			const nonAdminCaller = await createTestCaller(
				newRegular.clerkId,
				newRegular,
			);

			await expect(
				nonAdminCaller.admin.ai.getConversation({ id: "any-id" }),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject non-admin on usageStats", async () => {
			const newRegular = await createTestUser({
				role: "user",
				email: "nonadmin-ai3@test.local",
				name: "Non-Admin AI 3",
			});
			const nonAdminCaller = await createTestCaller(
				newRegular.clerkId,
				newRegular,
			);

			await expect(nonAdminCaller.admin.ai.usageStats()).rejects.toThrow(
				ERR_ADMIN_FORBIDDEN,
			);
		});

		it("should reject unauthenticated on listConversations", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(unauthCaller.admin.ai.listConversations({})).rejects.toThrow(
				"UNAUTHORIZED",
			);
		});
	});
});
