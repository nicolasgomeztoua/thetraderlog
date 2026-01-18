import path from "node:path";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

/**
 * Global setup for Playwright E2E tests with Clerk authentication.
 *
 * This file runs before all tests to:
 * 1. Initialize Clerk testing environment
 * 2. Sign in with test user credentials
 * 3. Save auth state for reuse in all browser tests
 *
 * Required environment variables:
 * - E2E_CLERK_USER_EMAIL: Test user email
 * - E2E_CLERK_USER_PASSWORD: Test user password
 */

// Setup must be run serially (required for Playwright's fully parallel mode)
setup.describe.configure({ mode: "serial" });

// Path to store authenticated state
const authFile = path.join(__dirname, "../../playwright/.clerk/user.json");

setup("configure Clerk testing", async () => {
	await clerkSetup();
});

setup("authenticate and save state", async ({ page }) => {
	const email = process.env.E2E_CLERK_USER_EMAIL;
	const password = process.env.E2E_CLERK_USER_PASSWORD;

	if (!email || !password) {
		throw new Error(
			"E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD environment variables are required.\n" +
				"See tests/e2e/README.md for setup instructions.",
		);
	}

	// Navigate to landing page to load Clerk
	await page.goto("/");

	// Sign in using Clerk testing helper
	await clerk.signIn({
		page,
		signInParams: {
			strategy: "password",
			identifier: email,
			password: password,
		},
	});

	// Navigate to protected page to verify authentication succeeded
	await page.goto("/dashboard");

	// Wait for dashboard to load (confirms auth worked)
	await page.waitForSelector('h1:has-text("Trading Overview")', {
		timeout: 15000,
	});

	// Save authentication state for all other tests
	await page.context().storageState({ path: authFile });
});
