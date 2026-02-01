import { expect, test } from "@playwright/test";

/**
 * Dashboard E2E Tests
 *
 * These tests verify the dashboard page loads correctly for authenticated users.
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

	test("displays stats grid section", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Wait for page to load
		await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible({
			timeout: 15000,
		});

		// Wait for stats to load from API
		await page.waitForTimeout(3000);

		// Verify stats section labels are present
		// These are the stat card titles that should always be visible
		const expectedStatLabels = [
			"Net P&L",
			"Win Rate",
			"Profit Factor",
			"Avg Win",
			"Avg Loss",
		];

		for (const label of expectedStatLabels) {
			const statCard = page.locator(`text="${label}"`);
			await expect(statCard).toBeVisible({ timeout: 15000 });
		}
	});

	test("displays start journal hero section", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Wait for page to load
		await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible({
			timeout: 15000,
		});

		// Use data-testid for hero section
		const heroSection = page.getByTestId("dashboard-hero-journal");
		await expect(heroSection).toBeVisible({ timeout: 15000 });

		// Wait for hero to load (either shows "Ready to start" or "Journal Started")
		// One of these buttons/text should appear after loading completes
		const startButton = heroSection.getByRole("button", {
			name: /start|journal/i,
		});
		await expect(startButton).toBeVisible({ timeout: 15000 });
	});
});
