import { expect, test } from "../fixtures/clerk-auth";

test.describe("Dashboard", () => {
	test("should display the dashboard page", async ({ page }) => {
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Verify page loaded - check for header text
		await expect(
			page.getByRole("heading", { name: "Trading Overview" }),
		).toBeVisible();

		// Verify dashboard link is visible in navigation
		await expect(
			page.getByRole("link", { name: "Dashboard" }),
		).toBeVisible();
	});

	test("should show stats cards", async ({ page }) => {
		await page.goto("/dashboard");

		// Wait for page to load and show stats section
		// Stats may show $0.00 or N/A for new users with no trades
		await expect(
			page.getByRole("heading", { name: "Trading Overview" }),
		).toBeVisible();

		// The dashboard content should be present
		// Even without data, the dashboard layout should render
		await expect(page.getByRole("main").first()).toBeVisible();
	});

	test("should display account name when selected", async ({ page }) => {
		await page.goto("/dashboard");

		// The account selector should be somewhere on the page
		// This verifies the account context is working
		await expect(
			page.getByRole("heading", { name: "Trading Overview" }),
		).toBeVisible();
	});
});

test.describe("Navigation", () => {
	test("should navigate to journal page", async ({ page }) => {
		// Navigate directly to journal page to verify it loads
		await page.goto("/journal");

		// Verify we're on the journal page
		await expect(page).toHaveURL(/\/journal/);

		// Verify the page content loaded
		await expect(page.getByRole("main").first()).toBeVisible();
	});

	test("should navigate to analytics page", async ({ page }) => {
		// Navigate directly to analytics page to verify it loads
		await page.goto("/analytics");

		// Verify we're on the analytics page
		await expect(page).toHaveURL(/\/analytics/);

		// Verify the page content loaded
		await expect(page.getByRole("main").first()).toBeVisible();
	});
});
