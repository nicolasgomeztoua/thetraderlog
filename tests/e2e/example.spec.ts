import { expect, test } from "@playwright/test";

/**
 * Example E2E Test File
 *
 * This file demonstrates basic Playwright test patterns for EdgeJournal.
 * These tests run WITHOUT authentication - they test public pages only.
 *
 * Key patterns shown:
 * 1. Using base @playwright/test for unauthenticated tests
 * 2. Using semantic locators (getByRole, getByText) over CSS selectors
 * 3. Using test.describe() for logical grouping
 * 4. Using test.beforeEach() for common setup
 * 5. Asserting page content and navigation
 *
 * For authenticated tests, import from '../fixtures/auth' instead:
 *   import { test, expect } from './fixtures/auth';
 */

test.describe("Marketing Page", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the public landing page before each test
		await page.goto("/");
	});

	test("should load the landing page", async ({ page }) => {
		// Verify the page title or a key element is visible
		await expect(page).toHaveURL("/");

		// Check for the main headline
		await expect(page.getByText("Find Your")).toBeVisible();
		await expect(page.getByText("Trading Edge")).toBeVisible();
	});

	test("should display the navbar with logo", async ({ page }) => {
		// Check for the EdgeJournal logo/brand
		await expect(
			page.getByRole("link", { name: /edgejournal/i }),
		).toBeVisible();
	});

	test("should display navigation links", async ({ page }) => {
		// Check for main navigation items (visible on desktop)
		// Using getByRole for semantic locators
		await expect(page.getByRole("link", { name: /features/i })).toBeVisible();
		await expect(page.getByRole("link", { name: /pricing/i })).toBeVisible();
	});

	test("should display call-to-action buttons when signed out", async ({
		page,
	}) => {
		// Check for sign-up and sign-in buttons
		await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
		await expect(
			page.getByRole("button", { name: /get started/i }),
		).toBeVisible();
	});

	test("should display the demo dashboard preview", async ({ page }) => {
		// Check for demo dashboard elements
		await expect(page.getByText("Net P&L")).toBeVisible();
		await expect(page.getByText("Win Rate")).toBeVisible();
	});

	test("should display stats section", async ({ page }) => {
		// Check for stats that appear on the landing page
		await expect(page.getByText("Avg Win Rate Gain")).toBeVisible();
		await expect(page.getByText("Trades Analyzed")).toBeVisible();
	});

	test("should display public beta status badge", async ({ page }) => {
		// Check for the status badge
		await expect(page.getByText(/now in public beta/i)).toBeVisible();
	});
});

test.describe("Public Page Navigation", () => {
	test("should navigate to anchor sections", async ({ page }) => {
		await page.goto("/");

		// Click on Features link and verify scroll to section
		await page.getByRole("link", { name: /features/i }).first().click();

		// URL should have the #features anchor
		await expect(page).toHaveURL("/#features");
	});

	test("should have working Watch Demo button", async ({ page }) => {
		await page.goto("/");

		// Click Watch Demo button
		await page.getByRole("link", { name: /watch demo/i }).click();

		// Should navigate to features section
		await expect(page).toHaveURL("/#features");
	});
});

test.describe("Unauthenticated Route Protection", () => {
	test("should redirect to sign-in when accessing /dashboard", async ({
		page,
	}) => {
		// Try to access protected route without authentication
		await page.goto("/dashboard");

		// Should be redirected to sign-in
		// Clerk redirects to its sign-in page
		await expect(page).toHaveURL(/sign-in/);
	});

	test("should redirect to sign-in when accessing /journal", async ({
		page,
	}) => {
		// Try to access protected route without authentication
		await page.goto("/journal");

		// Should be redirected to sign-in
		await expect(page).toHaveURL(/sign-in/);
	});

	test("should redirect to sign-in when accessing /analytics", async ({
		page,
	}) => {
		// Try to access protected route without authentication
		await page.goto("/analytics");

		// Should be redirected to sign-in
		await expect(page).toHaveURL(/sign-in/);
	});
});

test.describe("Page Performance", () => {
	test("should load the landing page within acceptable time", async ({
		page,
	}) => {
		const startTime = Date.now();
		await page.goto("/");
		const loadTime = Date.now() - startTime;

		// Page should load within 10 seconds (generous timeout for CI)
		expect(loadTime).toBeLessThan(10000);

		// Verify page actually loaded
		await expect(page.getByText("Find Your")).toBeVisible();
	});
});
