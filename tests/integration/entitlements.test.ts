/**
 * Integration tests for entitlement gates on AI, trade, and strategy endpoints.
 *
 * Verifies that:
 * - AI endpoints reject users without the required feature
 * - Trade mutations reject users without trade_management feature
 * - Read-only queries remain accessible without any plan
 * - Beta users bypass all entitlement gates
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	FEATURE_AI_CHAT,
	FEATURE_AI_REPORTS,
	FEATURE_CUSTOM_STRATEGIES,
	FEATURE_TRADE_MANAGEMENT,
} from "@/lib/constants/billing";
import { ERR_FEATURE_NOT_AVAILABLE } from "@/lib/constants/errors";
import type { ClerkAuthLike } from "@/server/api/trpc";
import type { Account, User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	FULL_ACCESS_AUTH,
	NO_ACCESS_AUTH,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

// =============================================================================
// MOCKS — AI endpoints require mocked external services
// =============================================================================

vi.mock("@/lib/ai/client", () => ({
	aiGenerateText: vi.fn().mockResolvedValue({
		text: "Mock AI response",
		totalTokens: 100,
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

vi.mock("@/lib/ai/context-builder", () => ({
	buildUserContext: vi.fn().mockResolvedValue("Mock user context"),
}));

vi.mock("@/lib/ai/schema-context", () => ({
	generateSchemaContext: vi.fn().mockReturnValue("Mock schema context"),
}));

vi.mock("@/trigger/generate-ai-report", () => ({
	generateAiReport: {
		trigger: vi.fn().mockResolvedValue({ id: "mock-trigger-id" }),
	},
}));

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Creates a ClerkAuthLike that grants access to specific features only.
 */
function withFeatures(...features: string[]) {
	return {
		has: ({ feature }: { feature?: string; plan?: string }) => {
			if (feature) return features.includes(feature);
			return false;
		},
	};
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe("entitlement gates", () => {
	let user: User;
	let account: Account;
	let noAccessCaller: TestCaller;
	let fullAccessCaller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		user = setup.user;
		account = setup.account;
		noAccessCaller = await createTestCaller(user.clerkId, user, NO_ACCESS_AUTH);
		fullAccessCaller = await createTestCaller(
			user.clerkId,
			user,
			FULL_ACCESS_AUTH,
		);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =========================================================================
	// AI ROUTER GATES
	// =========================================================================

	describe("ai.sendMessage", () => {
		it("should reject users without ai_chat feature", async () => {
			// createConversation also requires ai_chat, so create with full access first
			const conversation = await fullAccessCaller.ai.createConversation({
				mode: "chat",
			});

			await expect(
				noAccessCaller.ai.sendMessage({
					conversationId: conversation.id,
					content: "Hello",
				}),
			).rejects.toThrow(ERR_FEATURE_NOT_AVAILABLE);
		});

		it("should allow users with ai_chat feature", async () => {
			const chatCaller = await createTestCaller(
				user.clerkId,
				user,
				withFeatures(FEATURE_AI_CHAT),
			);
			const conversation = await chatCaller.ai.createConversation({
				mode: "chat",
			});

			const result = await chatCaller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Hello",
			});

			expect(result).toBeDefined();
			expect(result?.role).toBe("assistant");
		});
	});

	describe("ai.startReport", () => {
		it("should reject users without ai_reports feature", async () => {
			await expect(
				noAccessCaller.ai.startReport({
					prompt: "Analyze my trades",
				}),
			).rejects.toThrow(ERR_FEATURE_NOT_AVAILABLE);
		});

		it("should allow users with ai_reports feature", async () => {
			const reportCaller = await createTestCaller(
				user.clerkId,
				user,
				withFeatures(FEATURE_AI_REPORTS),
			);

			const result = await reportCaller.ai.startReport({
				prompt: "Analyze my trades",
			});

			expect(result).toBeDefined();
			expect(result.status).toBe("queued");
		});
	});

	describe("ai.generatePdf", () => {
		it("should reject users without pdf_export feature", async () => {
			// Create a report with full access first, then try to generate PDF without access
			const report = await fullAccessCaller.ai.startReport({
				prompt: "PDF test report",
			});

			await expect(
				noAccessCaller.ai.generatePdf({ reportId: report.id }),
			).rejects.toThrow(ERR_FEATURE_NOT_AVAILABLE);
		});
	});

	// =========================================================================
	// TRADE ROUTER GATES
	// =========================================================================

	describe("trades.create", () => {
		it("should reject users without trade_management feature", async () => {
			await expect(
				noAccessCaller.trades.create({
					symbol: "ES",
					instrumentType: "futures",
					direction: "long",
					entryPrice: "5000.00",
					quantity: "1",
					accountId: account.id,
					entryTime: new Date().toISOString(),
				}),
			).rejects.toThrow(ERR_FEATURE_NOT_AVAILABLE);
		});

		it("should allow users with trade_management feature", async () => {
			const tradeCaller = await createTestCaller(
				user.clerkId,
				user,
				withFeatures(FEATURE_TRADE_MANAGEMENT),
			);

			const trade = await tradeCaller.trades.create({
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				entryPrice: "5000.00",
				quantity: "1",
				accountId: account.id,
				entryTime: new Date().toISOString(),
			});

			expect(trade).toBeDefined();
		});
	});

	describe("trades.batchImport", () => {
		it("should reject users without csv_import_export feature", async () => {
			await expect(
				noAccessCaller.trades.batchImport({
					accountId: account.id,
					trades: [
						{
							symbol: "NQ",
							direction: "long",
							entryPrice: "15000.00",
							exitPrice: "15010.00",
							entryTime: new Date().toISOString(),
							exitTime: new Date(Date.now() + 3600000).toISOString(),
							quantity: "1",
							profit: "200.00",
						},
					],
				}),
			).rejects.toThrow(ERR_FEATURE_NOT_AVAILABLE);
		});
	});

	// =========================================================================
	// STRATEGY ROUTER GATES
	// =========================================================================

	describe("strategies.create", () => {
		it("should reject users without custom_strategies feature", async () => {
			await expect(
				noAccessCaller.strategies.create({
					name: "My Strategy",
				}),
			).rejects.toThrow(ERR_FEATURE_NOT_AVAILABLE);
		});

		it("should allow users with custom_strategies feature", async () => {
			const strategyCaller = await createTestCaller(
				user.clerkId,
				user,
				withFeatures(FEATURE_CUSTOM_STRATEGIES),
			);

			const strategy = await strategyCaller.strategies.create({
				name: "Entitlement Test Strategy",
			});

			expect(strategy).toBeDefined();
			expect(strategy?.name).toBe("Entitlement Test Strategy");
		});
	});

	// =========================================================================
	// READ-ONLY QUERIES (SHOULD REMAIN ACCESSIBLE)
	// =========================================================================

	describe("read-only access without any plan", () => {
		it("should allow trades.getAll without any features", async () => {
			const result = await noAccessCaller.trades.getAll({
				accountId: account.id,
			});

			expect(result).toBeDefined();
			expect(result.items).toBeDefined();
		});

		it("should allow ai.listConversations without any features", async () => {
			const result = await noAccessCaller.ai.listConversations({
				limit: 10,
			});

			expect(result).toBeDefined();
			expect(result.items).toBeDefined();
		});

		it("should allow ai.listReports without any features", async () => {
			const result = await noAccessCaller.ai.listReports({ limit: 10 });

			expect(result).toBeDefined();
			expect(result.items).toBeDefined();
		});

		it("should allow strategies.getAll without any features", async () => {
			const result = await noAccessCaller.strategies.getAll();

			expect(result).toBeDefined();
		});
	});

	// =========================================================================
	// BETA USER BYPASS
	// =========================================================================

	describe("beta user bypass (via publicMetadata)", () => {
		let betaCaller: TestCaller;

		/**
		 * ClerkAuth that grants beta via sessionClaims.metadata (publicMetadata)
		 * but denies all features/plans via has() — proving beta truly bypasses gates.
		 */
		const BETA_AUTH: ClerkAuthLike = {
			has: () => false,
			sessionClaims: {
				metadata: { features: { beta_access: true } },
			},
		};

		beforeAll(async () => {
			const betaUser = await createTestUser({ name: "Beta Tester" });
			betaCaller = await createTestCaller(
				betaUser.clerkId,
				betaUser,
				BETA_AUTH,
			);
		});

		it("should allow beta user to access AI chat", async () => {
			const conversation = await betaCaller.ai.createConversation({
				mode: "chat",
			});

			const result = await betaCaller.ai.sendMessage({
				conversationId: conversation.id,
				content: "Beta test message",
			});

			expect(result).toBeDefined();
			expect(result?.role).toBe("assistant");
		});

		it("should allow beta user to create trades", async () => {
			// Beta user needs an account first
			const betaAccount = await betaCaller.accounts.create({
				name: "Beta Account",
				platform: "other",
				accountType: "demo",
				initialBalance: "10000",
			});

			const trade = await betaCaller.trades.create({
				symbol: "ES",
				instrumentType: "futures",
				direction: "long",
				entryPrice: "5000.00",
				quantity: "1",
				accountId: betaAccount?.id ?? "",
				entryTime: new Date().toISOString(),
			});

			expect(trade).toBeDefined();
		});

		it("should allow beta user to create strategies", async () => {
			const strategy = await betaCaller.strategies.create({
				name: "Beta Strategy",
			});

			expect(strategy).toBeDefined();
			expect(strategy?.name).toBe("Beta Strategy");
		});
	});
});
