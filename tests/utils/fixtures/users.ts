import { getTestDb, schema } from "../db";

export interface CreateTestUserOptions {
	clerkId?: string;
	email?: string;
	name?: string;
	role?: "user" | "admin";
}

let userCounter = 0;

/**
 * Creates a test user in the database.
 * Each call generates a unique user with a unique clerkId.
 */
export async function createTestUser(options: CreateTestUserOptions = {}) {
	const db = getTestDb();
	userCounter++;

	const clerkId = options.clerkId ?? `test_clerk_${userCounter}_${Date.now()}`;
	const email = options.email ?? `testuser${userCounter}@test.local`;
	const name = options.name ?? `Test User ${userCounter}`;
	const role = options.role ?? "user";

	const [user] = await db
		.insert(schema.users)
		.values({
			clerkId,
			email,
			name,
			role,
		})
		.returning();

	if (!user) {
		throw new Error("Failed to create test user");
	}

	return user;
}

/**
 * Resets the user counter.
 * Call this in beforeEach/afterAll if you want consistent IDs across test runs.
 */
export function resetUserCounter() {
	userCounter = 0;
}
