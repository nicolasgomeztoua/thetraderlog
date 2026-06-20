import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	ERR_SHARE_RESOURCE_NOT_COMPLETE,
	ERR_SHARE_RESOURCE_NOT_FOUND,
	MAX_SHARE_LINKS_PER_RESOURCE,
} from "@/lib/constants";
import {
	createTestCaller,
	createTestUser,
	createUnauthenticatedCaller,
	getTestDb,
	schema,
	setupTraderWithTrades,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("sharing router — trade share links", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;
	let publicCaller: Awaited<ReturnType<typeof createUnauthenticatedCaller>>;
	let userId: string;
	let tradeId: string;
	let secondTradeId: string;
	let otherTradeId: string;

	beforeAll(async () => {
		await truncateAllTables();

		const setup = await setupTraderWithTrades(2, {
			trade: { notes: "<p>Solid breakout trade</p>" },
		});
		caller = await createTestCaller(setup.user.clerkId, setup.user);
		userId = setup.user.id;
		tradeId = setup.trades[0]?.id ?? "";
		secondTradeId = setup.trades[1]?.id ?? "";

		const otherSetup = await setupTraderWithTrades(1, {
			user: { clerkId: "other-user-clerk-id" },
		});
		otherCaller = await createTestCaller(
			otherSetup.user.clerkId,
			otherSetup.user,
		);
		otherTradeId = otherSetup.trades[0]?.id ?? "";

		publicCaller = await createUnauthenticatedCaller();
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =========================================================================
	// CREATE LINK
	// =========================================================================

	describe("createLink", () => {
		it("creates a share link for the user's own trade", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "trade",
				resourceId: tradeId,
			});

			expect(link).toBeDefined();
			expect(link?.resourceType).toBe("trade");
			expect(link?.resourceId).toBe(tradeId);
			expect(link?.token).toHaveLength(24);
			expect(link?.isActive).toBe(true);
		});

		it("rejects creating a link for another user's trade", async () => {
			await expect(
				caller.sharing.createLink({
					resourceType: "trade",
					resourceId: otherTradeId,
				}),
			).rejects.toThrow(ERR_SHARE_RESOURCE_NOT_FOUND);
		});

		it("rejects creating a link for a nonexistent trade", async () => {
			await expect(
				caller.sharing.createLink({
					resourceType: "trade",
					resourceId: "tr-does-not-exist",
				}),
			).rejects.toThrow(ERR_SHARE_RESOURCE_NOT_FOUND);
		});

		it("enforces the per-resource link limit", async () => {
			for (let i = 1; i < MAX_SHARE_LINKS_PER_RESOURCE; i++) {
				await caller.sharing.createLink({
					resourceType: "trade",
					resourceId: tradeId,
				});
			}

			await expect(
				caller.sharing.createLink({
					resourceType: "trade",
					resourceId: tradeId,
				}),
			).rejects.toThrow();
		});
	});

	// =========================================================================
	// RESOLVE TOKEN (public)
	// =========================================================================

	describe("resolveToken", () => {
		it("returns the public trade payload without auth", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "trade",
				resourceId: secondTradeId,
			});

			const result = await publicCaller.sharing.resolveToken({
				token: link?.token ?? "",
			});

			expect(result.resourceType).toBe("trade");
			if (result.resourceType !== "trade") return;

			expect(result.trade.symbol).toBe("ES");
			expect(result.trade.direction).toBeDefined();
			expect(result.trade.entryPrice).toBeDefined();
			expect(result.trade.notes).toContain("Solid breakout trade");
			expect(Array.isArray(result.trade.executions)).toBe(true);
			expect(Array.isArray(result.trade.tags)).toBe(true);
			expect(result.trader).toBeDefined();
		});

		it("does not leak private fields in the trade payload", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "trade",
				resourceId: secondTradeId,
			});

			const result = await publicCaller.sharing.resolveToken({
				token: link?.token ?? "",
			});

			if (result.resourceType !== "trade") {
				throw new Error("expected trade payload");
			}

			expect(result.trade).not.toHaveProperty("id");
			expect(result.trade).not.toHaveProperty("userId");
			expect(result.trade).not.toHaveProperty("accountId");
			expect(result.trade).not.toHaveProperty("account");
			expect(result.trade).not.toHaveProperty("importSource");
			expect(result.trade).not.toHaveProperty("externalId");
			expect(result.trade).not.toHaveProperty("tradeHash");
			expect(result.trade).not.toHaveProperty("emotionalState");
			expect(result.trade).not.toHaveProperty("isReviewed");
		});

		it("increments the view count on each resolve", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "trade",
				resourceId: secondTradeId,
			});

			await publicCaller.sharing.resolveToken({ token: link?.token ?? "" });
			await publicCaller.sharing.resolveToken({ token: link?.token ?? "" });

			const links = await caller.sharing.getLinksForResource({
				resourceType: "trade",
				resourceId: secondTradeId,
			});
			const updated = links.find((l) => l.id === link?.id);
			expect(updated?.viewCount).toBeGreaterThanOrEqual(2);
		});

		it("rejects a revoked link", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "trade",
				resourceId: secondTradeId,
			});

			await caller.sharing.revokeLink({ linkId: link?.id ?? "" });

			await expect(
				publicCaller.sharing.resolveToken({ token: link?.token ?? "" }),
			).rejects.toThrow("revoked");
		});

		it("rejects an expired link", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "trade",
				resourceId: secondTradeId,
			});

			const db = getTestDb();
			await db
				.update(schema.shareLinks)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(schema.shareLinks.id, link?.id ?? ""));

			await expect(
				publicCaller.sharing.resolveToken({ token: link?.token ?? "" }),
			).rejects.toThrow("expired");
		});

		it("rejects an unknown token", async () => {
			await expect(
				publicCaller.sharing.resolveToken({ token: "nope-not-a-token" }),
			).rejects.toThrow();
		});

		it("returns not found after the trade is soft-deleted", async () => {
			const link = await otherCaller.sharing.createLink({
				resourceType: "trade",
				resourceId: otherTradeId,
			});

			await otherCaller.trades.delete({ id: otherTradeId });

			await expect(
				publicCaller.sharing.resolveToken({ token: link?.token ?? "" }),
			).rejects.toThrow(ERR_SHARE_RESOURCE_NOT_FOUND);
		});
	});

	// =========================================================================
	// TRADE CHART DATA (public)
	// =========================================================================

	describe("getTradeChartData", () => {
		it("rejects an unknown token", async () => {
			await expect(
				publicCaller.sharing.getTradeChartData({
					token: "nope-not-a-token",
					mode: "day",
				}),
			).rejects.toThrow();
		});

		it("rejects a revoked link", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "trade",
				resourceId: secondTradeId,
			});

			await caller.sharing.revokeLink({ linkId: link?.id ?? "" });

			await expect(
				publicCaller.sharing.getTradeChartData({
					token: link?.token ?? "",
					mode: "day",
				}),
			).rejects.toThrow("revoked");
		});

		it("rejects tokens that point to non-trade resources", async () => {
			const db = getTestDb();
			const [reportLink] = await db
				.insert(schema.shareLinks)
				.values({
					userId,
					token: "report-token-for-chart-test",
					resourceType: "report",
					resourceId: "ar-some-report",
				})
				.returning();

			await expect(
				publicCaller.sharing.getTradeChartData({
					token: reportLink?.token ?? "",
					mode: "day",
				}),
			).rejects.toThrow(ERR_SHARE_RESOURCE_NOT_FOUND);
		});
	});
});

// =============================================================================
// CONVERSATION SHARE LINKS
// =============================================================================

// Secrets seeded into the conversation that must NEVER reach the public payload.
const SECRET_SQL =
	"SELECT * FROM trades WHERE user_id = 'us-supersecret' AND account_id = 'ac-private'";
const SECRET_SYSTEM = "INTERNAL SYSTEM PROMPT — DO NOT LEAK";

describe("sharing router — conversation share links", () => {
	let caller: TestCaller;
	let publicCaller: Awaited<ReturnType<typeof createUnauthenticatedCaller>>;
	let conversationId: string;
	let emptyConversationId: string;
	let otherConversationId: string;
	let ownerUserId: string;
	let attachmentKey: string;

	beforeAll(async () => {
		await truncateAllTables();
		const db = getTestDb();

		const owner = await createTestUser({ name: "Casey Trader" });
		ownerUserId = owner.id;
		caller = await createTestCaller(owner.clerkId, owner);

		const other = await createTestUser({ name: "Other Trader" });
		publicCaller = await createUnauthenticatedCaller();

		attachmentKey = `images/${ownerUserId}/ai-chat/private-broker-screenshot.png`;

		// A conversation with real content: a user turn (with a pasted screenshot),
		// an assistant turn (with a private SQL tool call + a propose_trade), and a
		// system turn that must be filtered from the public view.
		const [conversation] = await db
			.insert(schema.aiConversations)
			.values({
				userId: ownerUserId,
				title: "My ES analysis",
				model: "claude-sonnet-4-6",
				mode: "chat",
			})
			.returning();
		conversationId = conversation?.id ?? "";

		const base = Date.now();
		await db.insert(schema.aiMessages).values([
			{
				conversationId,
				role: "user",
				content: "Analyze my ES trades from this screenshot",
				attachments: [
					{
						key: attachmentKey,
						mimeType: "image/png",
						filename: "broker.png",
						size: 4242,
					},
				],
				createdAt: new Date(base),
			},
			{
				conversationId,
				role: "assistant",
				content: "Here is your analysis. You traded ES well this week.",
				toolCalls: JSON.stringify([
					{
						id: "call_1",
						function: { name: "run_query", arguments: SECRET_SQL },
					},
					{
						id: "call_2",
						function: {
							name: "propose_trade",
							arguments: JSON.stringify({
								symbol: "ES",
								direction: "long",
								entryPrice: "5000",
								quantity: "2",
							}),
						},
					},
				]),
				createdAt: new Date(base + 1000),
			},
			{
				conversationId,
				role: "system",
				content: SECRET_SYSTEM,
				createdAt: new Date(base + 2000),
			},
		]);

		// An empty conversation (no messages) — not shareable.
		const [empty] = await db
			.insert(schema.aiConversations)
			.values({ userId: ownerUserId, title: "Empty", mode: "chat" })
			.returning();
		emptyConversationId = empty?.id ?? "";

		// A conversation owned by another user.
		const [otherConversation] = await db
			.insert(schema.aiConversations)
			.values({ userId: other.id, title: "Other's chat", mode: "chat" })
			.returning();
		otherConversationId = otherConversation?.id ?? "";
		await db.insert(schema.aiMessages).values({
			conversationId: otherConversationId,
			role: "user",
			content: "private",
		});
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("createLink", () => {
		it("creates a share link for the user's own conversation", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "conversation",
				resourceId: conversationId,
			});

			expect(link?.resourceType).toBe("conversation");
			expect(link?.resourceId).toBe(conversationId);
			expect(link?.token).toHaveLength(24);
			expect(link?.isActive).toBe(true);
		});

		it("rejects creating a link for another user's conversation", async () => {
			await expect(
				caller.sharing.createLink({
					resourceType: "conversation",
					resourceId: otherConversationId,
				}),
			).rejects.toThrow(ERR_SHARE_RESOURCE_NOT_FOUND);
		});

		it("rejects creating a link for a nonexistent conversation", async () => {
			await expect(
				caller.sharing.createLink({
					resourceType: "conversation",
					resourceId: "cv-does-not-exist",
				}),
			).rejects.toThrow(ERR_SHARE_RESOURCE_NOT_FOUND);
		});

		it("rejects creating a link for an empty conversation", async () => {
			await expect(
				caller.sharing.createLink({
					resourceType: "conversation",
					resourceId: emptyConversationId,
				}),
			).rejects.toThrow(ERR_SHARE_RESOURCE_NOT_COMPLETE);
		});
	});

	describe("resolveToken", () => {
		it("returns the public conversation payload without auth", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "conversation",
				resourceId: conversationId,
			});

			const result = await publicCaller.sharing.resolveToken({
				token: link?.token ?? "",
			});

			expect(result.resourceType).toBe("conversation");
			if (result.resourceType !== "conversation") return;

			expect(result.title).toBe("My ES analysis");
			expect(result.model).toBe("claude-sonnet-4-6");
			expect(result.trader.name).toBe("Casey Trader");

			// system message filtered out → only the user + assistant turns remain,
			// in chronological order.
			expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant"]);

			const assistant = result.messages.find((m) => m.role === "assistant");
			expect(assistant?.toolNames).toContain("run_query");
			expect(assistant?.toolNames).not.toContain("propose_trade");
			expect(assistant?.proposal?.symbol).toBe("ES");
			expect(assistant?.proposal?.direction).toBe("long");
		});

		it("never leaks raw tool args, system prompts, or S3 keys", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "conversation",
				resourceId: conversationId,
			});

			const result = await publicCaller.sharing.resolveToken({
				token: link?.token ?? "",
			});
			if (result.resourceType !== "conversation") {
				throw new Error("expected conversation payload");
			}

			// No message exposes the raw tool-call JSON blob.
			for (const message of result.messages) {
				expect(message).not.toHaveProperty("toolCalls");
				for (const att of message.attachments) {
					expect(att).not.toHaveProperty("key");
					expect(att).toHaveProperty("url");
				}
			}

			// The serialized payload must not contain any private data: the generated
			// SQL, the system prompt, or the raw S3 object key.
			const serialized = JSON.stringify(result);
			expect(serialized).not.toContain("SELECT *");
			expect(serialized).not.toContain(SECRET_SQL);
			expect(serialized).not.toContain(SECRET_SYSTEM);
			expect(serialized).not.toContain(attachmentKey);
		});

		it("rejects a revoked conversation link", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "conversation",
				resourceId: conversationId,
			});

			await caller.sharing.revokeLink({ linkId: link?.id ?? "" });

			await expect(
				publicCaller.sharing.resolveToken({ token: link?.token ?? "" }),
			).rejects.toThrow("revoked");
		});

		it("rejects an expired conversation link", async () => {
			const link = await caller.sharing.createLink({
				resourceType: "conversation",
				resourceId: conversationId,
			});

			const db = getTestDb();
			await db
				.update(schema.shareLinks)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(schema.shareLinks.id, link?.id ?? ""));

			await expect(
				publicCaller.sharing.resolveToken({ token: link?.token ?? "" }),
			).rejects.toThrow("expired");
		});
	});
});
