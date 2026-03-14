import { createCaller } from "@/server/api/root";
import type { ClerkAuthLike } from "@/server/api/trpc";
import type { User } from "@/server/db/schema";
import { createTestContext, createUnauthenticatedTestContext } from "./context";

/**
 * Mock ClerkAuth that grants access to all features and plans.
 * Use this for tests that aren't specifically testing entitlement gates.
 */
export const FULL_ACCESS_AUTH: ClerkAuthLike = {
	has: () => true,
	sessionClaims: {
		metadata: { features: { beta_access: true } },
	},
};

/**
 * Mock ClerkAuth that denies access to all features and plans.
 * Use this for entitlement gate rejection tests.
 */
export const NO_ACCESS_AUTH: ClerkAuthLike = { has: () => false };

/**
 * Creates a typed tRPC caller for integration tests.
 * The caller is authenticated as the specified user.
 */
export async function createTestCaller(
	clerkId: string,
	user?: User,
	clerkAuth?: ClerkAuthLike,
) {
	const ctx = await createTestContext(clerkId, user, clerkAuth);
	return createCaller(ctx);
}

/**
 * Creates an unauthenticated tRPC caller.
 * Useful for testing public procedures or unauthorized access scenarios.
 */
export async function createUnauthenticatedCaller() {
	const ctx = await createUnauthenticatedTestContext();
	return createCaller(ctx);
}

/**
 * Type helper for the test caller
 */
export type TestCaller = Awaited<ReturnType<typeof createTestCaller>>;
