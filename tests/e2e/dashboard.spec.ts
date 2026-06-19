import { expect, test } from "@playwright/test";

/**
 * Dashboard E2E Tests (Legacy - Basic)
 *
 * These tests verify basic dashboard page functionality.
 * More comprehensive tests are in command-center.spec.ts.
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Dashboard", () => {
	test("loads successfully when authenticated", async ({ page }) => {
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Verify page loads without error by checking for the main heading
		const heading = page.getByTestId("dashboard-heading-overview");
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test("displays Command Center grid layout", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Wait for page to load
		await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible({
			timeout: 15000,
		});

		// Wait for content to load
		await page.waitForTimeout(3000);

		// Verify Command Center grid is present
		const grid = page.getByTestId("command-center-grid");
		await expect(grid).toBeVisible({ timeout: 15000 });
	});

	test("displays journal status widget", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Wait for page to load
		await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible({
			timeout: 15000,
		});

		// Wait for content to load
		await page.waitForTimeout(3000);

		// Verify journal status widget is present
		const journalStatus = page.getByTestId("widget-journal-status");
		await expect(journalStatus).toBeVisible({ timeout: 15000 });

		// Wait for hero to load (either shows "Start Journal" or "Continue/View Journal")
		const actionButton = journalStatus.getByRole("button", {
			name: /start|continue|view/i,
		});
		await expect(actionButton).toBeVisible({ timeout: 15000 });
	});
});
