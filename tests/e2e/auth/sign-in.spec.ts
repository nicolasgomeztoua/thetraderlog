import { clerk } from "@clerk/testing/playwright";
import { expect, test as base } from "@playwright/test";
import { test as authenticatedTest } from "../fixtures/auth";

/**
 * Authentication Flow E2E Tests
 *
 * This file tests the authentication flows in EdgeJournal:
 * - Unauthenticated access to protected routes
 * - Sign-in flow and redirect to dashboard
 * - Authenticated access to protected routes
 * - Sign-out flow
 * - Session persistence across pages
 *
 * Tests are split between:
 * - base test (from @playwright/test): for unauthenticated scenarios
 * - authenticatedTest (from fixtures/auth): for authenticated scenarios
 *
 * Environment requirements:
 * - E2E_CLERK_USER_EMAIL: Test user email
 * - E2E_CLERK_USER_PASSWORD: Test user password
 */

// ============================================================================
// UNAUTHENTICATED ACCESS TESTS
// ============================================================================

base.describe("Unauthenticated Access", () => {
	base("should redirect /dashboard to sign-in page", async ({ page }) => {
		// Attempt to access protected dashboard route
		await page.goto("/dashboard");

		// Should be redirected to Clerk sign-in page
		await expect(page).toHaveURL(/sign-in/);
	});

	base("should redirect /journal to sign-in page", async ({ page }) => {
		// Attempt to access protected journal route
		await page.goto("/journal");

		// Should be redirected to Clerk sign-in page
		await expect(page).toHaveURL(/sign-in/);
	});

	base("should redirect /analytics to sign-in page", async ({ page }) => {
		// Attempt to access protected analytics route
		await page.goto("/analytics");

		// Should be redirected to Clerk sign-in page
		await expect(page).toHaveURL(/sign-in/);
	});

	base("should redirect /ai to sign-in page", async ({ page }) => {
		// Attempt to access protected AI insights route
		await page.goto("/ai");

		// Should be redirected to Clerk sign-in page
		await expect(page).toHaveURL(/sign-in/);
	});

	base("should allow access to public landing page", async ({ page }) => {
		// Landing page should be accessible without authentication
		await page.goto("/");

		// Should stay on landing page (not redirect)
		await expect(page).toHaveURL("/");

		// Verify landing page content loads
		await expect(page.getByText("Find Your")).toBeVisible();
	});
});

// ============================================================================
// SIGN-IN FLOW TESTS
// ============================================================================

base.describe("Sign-In Flow", () => {
	base("should display sign-in form when accessing protected route", async ({
		page,
	}) => {
		// Navigate to a protected route
		await page.goto("/dashboard");

		// Should be redirected to sign-in
		await expect(page).toHaveURL(/sign-in/);

		// Wait for Clerk sign-in form to load
		await page.waitForLoadState("networkidle");

		// Verify sign-in elements are present
		// Clerk provides various sign-in options
		const emailInput = page.locator('input[name="identifier"]');
		await expect(emailInput).toBeVisible({ timeout: 10000 });
	});

	base(
		"should successfully sign in and redirect to dashboard",
		async ({ page }) => {
			const email = process.env.E2E_CLERK_USER_EMAIL;
			const password = process.env.E2E_CLERK_USER_PASSWORD;

			// Skip test if credentials not configured
			if (!email || !password) {
				base.skip();
				return;
			}

			// Navigate to landing page first (required for Clerk to load)
			await page.goto("/");
			await page.waitForLoadState("networkidle");

			// Sign in using Clerk testing helper
			await clerk.signIn({
				page,
				signInParams: {
					strategy: "password",
					identifier: email,
					password: password,
				},
			});

			// Navigate to dashboard after sign-in
			await page.goto("/dashboard");

			// Verify we can access the dashboard (not redirected to sign-in)
			await expect(page).toHaveURL("/dashboard");

			// Verify dashboard content loads
			await expect(page.getByText(/dashboard|overview|account/i)).toBeVisible({
				timeout: 10000,
			});
		},
	);
});

// ============================================================================
// AUTHENTICATED ACCESS TESTS
// ============================================================================

authenticatedTest.describe("Authenticated Access", () => {
	authenticatedTest(
		"should access dashboard without redirect",
		async ({ page }) => {
			// Navigate to dashboard (using stored auth state)
			await page.goto("/dashboard");

			// Should stay on dashboard (authenticated)
			await expect(page).toHaveURL("/dashboard");
		},
	);

	authenticatedTest(
		"should access journal page without redirect",
		async ({ page }) => {
			// Navigate to journal page
			await page.goto("/journal");

			// Should stay on journal page (authenticated)
			await expect(page).toHaveURL("/journal");
		},
	);

	authenticatedTest(
		"should access analytics page without redirect",
		async ({ page }) => {
			// Navigate to analytics page
			await page.goto("/analytics");

			// Should stay on analytics page (authenticated)
			await expect(page).toHaveURL("/analytics");
		},
	);

	authenticatedTest("should access AI page without redirect", async ({ page }) => {
		// Navigate to AI insights page
		await page.goto("/ai");

		// Should stay on AI page (authenticated)
		await expect(page).toHaveURL("/ai");
	});

	authenticatedTest(
		"should navigate between protected routes",
		async ({ page }) => {
			// Start at dashboard
			await page.goto("/dashboard");
			await expect(page).toHaveURL("/dashboard");

			// Navigate to journal
			await page.goto("/journal");
			await expect(page).toHaveURL("/journal");

			// Navigate to analytics
			await page.goto("/analytics");
			await expect(page).toHaveURL("/analytics");

			// Navigate back to dashboard
			await page.goto("/dashboard");
			await expect(page).toHaveURL("/dashboard");
		},
	);

	authenticatedTest(
		"should maintain session across page navigation",
		async ({ page }) => {
			// Navigate to dashboard
			await page.goto("/dashboard");
			await expect(page).toHaveURL("/dashboard");

			// Reload the page
			await page.reload();

			// Should still be on dashboard (session maintained)
			await expect(page).toHaveURL("/dashboard");
		},
	);
});

// ============================================================================
// SIGN-OUT FLOW TESTS
// ============================================================================

authenticatedTest.describe("Sign-Out Flow", () => {
	authenticatedTest(
		"should sign out and redirect to landing page",
		async ({ page }) => {
			// Start authenticated on dashboard
			await page.goto("/dashboard");
			await expect(page).toHaveURL("/dashboard");

			// Sign out using Clerk testing helper
			await clerk.signOut({ page });

			// After sign-out, try to access dashboard
			await page.goto("/dashboard");

			// Should be redirected to sign-in
			await expect(page).toHaveURL(/sign-in/);
		},
	);
});

// ============================================================================
// SESSION PERSISTENCE TESTS
// ============================================================================

authenticatedTest.describe("Session Persistence", () => {
	authenticatedTest(
		"should persist authentication after page reload",
		async ({ page }) => {
			// Navigate to a protected route
			await page.goto("/dashboard");
			await expect(page).toHaveURL("/dashboard");

			// Hard reload the page
			await page.reload();
			await page.waitForLoadState("networkidle");

			// Should still be authenticated
			await expect(page).toHaveURL("/dashboard");
		},
	);

	authenticatedTest(
		"should access all protected routes with single authentication",
		async ({ page }) => {
			// Define all protected routes to test
			const protectedRoutes = [
				"/dashboard",
				"/journal",
				"/analytics",
				"/ai",
			];

			// Access each route and verify no redirect
			for (const route of protectedRoutes) {
				await page.goto(route);
				await expect(page).toHaveURL(route);
			}
		},
	);
});
