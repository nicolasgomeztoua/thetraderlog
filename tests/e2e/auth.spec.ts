import { expect, test } from "@playwright/test";

/**
 * Auth E2E Tests
 *
 * These tests verify authentication-related behavior, specifically that
 * unauthenticated users are redirected to sign-in when accessing protected routes.
 *
 * IMPORTANT: These tests use `test.use({ storageState: { cookies: [], origins: [] } })`
 * to clear auth state and test as an unauthenticated user.
 */
test.describe("Authentication", () => {
	// Override storageState to run tests without authentication
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user from /dashboard to sign-in", async ({
		page,
	}) => {
		// Navigate to protected route
		await page.goto("/dashboard");

		// Wait for redirect to complete
		// Clerk redirects to /sign-in for unauthenticated users
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		// Verify we're on the sign-in page
		expect(page.url()).toContain("/sign-in");

		// Verify sign-in page elements are visible
		// Clerk renders a sign-in form with email/password fields
		const signInContainer = page.locator('[class*="cl-signIn"]');
		await expect(signInContainer).toBeVisible({ timeout: 10000 });
	});

	test("redirects unauthenticated user from /journal to sign-in", async ({
		page,
	}) => {
		// Navigate to another protected route
		await page.goto("/journal");

		// Wait for redirect to sign-in
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		// Verify we're on the sign-in page
		expect(page.url()).toContain("/sign-in");
	});

	test("redirects unauthenticated user from /analytics to sign-in", async ({
		page,
	}) => {
		// Navigate to protected analytics route
		await page.goto("/analytics");

		// Wait for redirect to sign-in
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		// Verify we're on the sign-in page
		expect(page.url()).toContain("/sign-in");
	});
});
