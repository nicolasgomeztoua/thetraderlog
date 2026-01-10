import { clerk } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";

/**
 * Authentication Setup Project
 *
 * This file runs as a Playwright "setup" project before the main tests.
 * It authenticates a test user and saves the session state to .auth/user.json
 * so that all subsequent tests can reuse the authenticated state.
 *
 * IMPORTANT:
 * - clerkSetup() is called in global-setup.ts and must complete before this runs
 * - You MUST navigate to a page that loads Clerk BEFORE calling clerk.signIn()
 * - Test user must exist in your Clerk instance
 *
 * Required environment variables:
 * - E2E_CLERK_USER_EMAIL: Email of the test user in Clerk
 *
 * The test user must:
 * - Exist in your Clerk development/test instance
 * - No password required - uses Clerk's direct email sign-in for testing
 */

const AUTH_STATE_PATH = ".auth/user.json";

setup("authenticate", async ({ page }) => {
	// Validate required environment variables
	const email = process.env.E2E_CLERK_USER_EMAIL;

	if (!email) {
		throw new Error(
			"E2E test credentials not configured. " +
				"Please set E2E_CLERK_USER_EMAIL environment variable.",
		);
	}

	// CRITICAL: Navigate to a page that loads Clerk BEFORE calling signIn
	// This ensures Clerk's JavaScript is loaded and the testing environment is ready
	await page.goto("/");

	// Wait for Clerk to be fully loaded
	await page.waitForLoadState("networkidle");

	// Sign in using Clerk's testing helper with direct email lookup
	// This bypasses password auth - uses CLERK_SECRET_KEY to create session
	await clerk.signIn({
		page,
		emailAddress: email,
	});

	// Verify authentication worked by navigating to a protected route
	await page.goto("/dashboard");
	await expect(page).toHaveURL("/dashboard");

	// Save authentication state for reuse by other tests
	// This avoids re-authenticating for every test, making tests faster
	await page.context().storageState({ path: AUTH_STATE_PATH });
});
