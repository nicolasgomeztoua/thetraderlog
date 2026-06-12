import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	ERR_SHARE_RESOURCE_NOT_FOUND,
	MAX_SHARE_LINKS_PER_RESOURCE,
} from "@/lib/constants";
import {
	createTestCaller,
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
