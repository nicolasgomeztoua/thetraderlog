import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Global setup for E2E tests
 *
 * This file is executed once before all tests run.
 * It initializes the Clerk testing environment which is required
 * before using any Clerk test helpers (like clerk.signIn()).
 *
 * IMPORTANT: clerkSetup() must be called before any tests that use
 * @clerk/testing helpers. It configures the testing token and
 * prepares the Clerk environment for automated testing.
 */
async function globalSetup() {
	console.log("\n🔐 Setting up Clerk testing environment...");

	await clerkSetup();

	console.log("✅ Clerk testing environment ready!\n");
}

export default globalSetup;
