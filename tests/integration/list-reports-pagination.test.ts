/**
 * Integration tests for listReports keyset pagination.
 *
 * Guards against the off-by-one that drops the boundary report, and verifies
 * the (createdAt, id) tiebreaker handles reports sharing a timestamp.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

vi.mock("@/lib/ai/client", () => ({
	aiGenerateText: vi
		.fn()
		.mockResolvedValue({ text: "", totalTokens: 0, steps: [] }),
	aiStreamText: vi.fn(),
	OpenRouterError: class OpenRouterError extends Error {},
}));
vi.mock("@/lib/ai/context-builder", () => ({
	buildUserContext: vi.fn().mockResolvedValue("ctx"),
}));
vi.mock("@/lib/ai/schema-context", () => ({
	generateSchemaContext: vi.fn().mockReturnValue("schema"),
}));
vi.mock("@/trigger/generate-ai-report", () => ({
	generateAiReport: { trigger: vi.fn().mockResolvedValue({ id: "trig" }) },
}));

describe("listReports pagination", () => {
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const user = await createTestUser({ name: "Pagination User" });
		const beta = { ...user, publicMetadata: { beta: true } } as unknown as User;
		caller = await createTestCaller(user.clerkId, beta, FULL_ACCESS_AUTH);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	/** Create a completed report stamped with an explicit createdAt. */
	async function makeReport(createdAt: Date): Promise<string> {
		const r = await caller.ai.startReport({ prompt: "p", title: "t" });
		await getTestDb()
			.update(schema.aiReports)
			.set({ status: "complete", createdAt })
			.where(eq(schema.aiReports.id, r.id));
		return r.id;
	}

	async function collectAll(limit: number): Promise<string[]> {
		const ids: string[] = [];
		let cursor: string | undefined;
		for (let i = 0; i < 20; i++) {
			const page = await caller.ai.listReports({
				limit,
				...(cursor ? { cursor } : {}),
			});
			ids.push(...page.items.map((x) => x.id));
			if (!page.nextCursor) break;
			cursor = page.nextCursor;
		}
		return ids;
	}

	it("returns every report across page boundaries with no drops or dupes", async () => {
		await truncateAllTables();
		const user = await createTestUser({ name: "Pagination User A" });
		const beta = { ...user, publicMetadata: { beta: true } } as unknown as User;
		caller = await createTestCaller(user.clerkId, beta, FULL_ACCESS_AUTH);

		const base = Date.now();
		const created: string[] = [];
		for (let i = 0; i < 5; i++) {
			created.push(await makeReport(new Date(base - i * 60_000)));
		}

		const paged = await collectAll(2); // forces 3 page boundaries
		expect(new Set(paged)).toEqual(new Set(created));
		expect(paged).toHaveLength(created.length);
	});

	it("handles reports that share an identical createdAt (tiebreaker)", async () => {
		await truncateAllTables();
		const user = await createTestUser({ name: "Pagination User B" });
		const beta = { ...user, publicMetadata: { beta: true } } as unknown as User;
		caller = await createTestCaller(user.clerkId, beta, FULL_ACCESS_AUTH);

		const sameTime = new Date(Date.now() - 5 * 60_000);
		const created: string[] = [];
		for (let i = 0; i < 3; i++) {
			created.push(await makeReport(sameTime));
		}

		const paged = await collectAll(2);
		expect(new Set(paged)).toEqual(new Set(created));
		expect(paged).toHaveLength(created.length);
	});
});
