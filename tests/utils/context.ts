import {
	type ClerkAuthLike,
	createTRPCContext,
	type TRPCContextOverrides,
} from "@/server/api/trpc";
import type { User } from "@/server/db/schema";
import { getTestDb } from "./db";

/**
 * Creates a test context for tRPC procedures.
 * Bypasses Clerk authentication and uses the test database.
 */
export async function createTestContext(
	clerkId: string,
	user?: User,
	clerkAuth?: ClerkAuthLike,
): Promise<Awaited<ReturnType<typeof createTRPCContext>>> {
	const db = getTestDb();

	const overrides: TRPCContextOverrides = {
		db,
		userId: clerkId,
		user,
		clerkAuth,
	};

	// Create context with mock headers and overrides
	return createTRPCContext({ headers: new Headers() }, overrides);
}

/**
 * Creates an unauthenticated test context.
 * Useful for testing public procedures or unauthorized access.
 */
export async function createUnauthenticatedTestContext(): Promise<
	Awaited<ReturnType<typeof createTRPCContext>>
> {
	const db = getTestDb();

	const overrides: TRPCContextOverrides = {
		db,
		userId: null,
	};

	return createTRPCContext({ headers: new Headers() }, overrides);
}
