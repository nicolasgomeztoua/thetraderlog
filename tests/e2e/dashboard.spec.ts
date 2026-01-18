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
		const heading = page.locator('h1:has-text("Trading Overview")');
		await expect(heading).toBeVisible({ timeout: 15000 });

		// Verify the page has the correct title structure
		const dashboardLabel = page.locator('text="Dashboard"');
		await expect(dashboardLabel).toBeVisible();
	});

	test("displays stats grid section", async ({ page }) => {
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Wait for page to load
		await expect(page.locator('h1:has-text("Trading Overview")')).toBeVisible();

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
			await expect(statCard).toBeVisible({ timeout: 10000 });
		}
	});

	test("displays start journal hero section", async ({ page }) => {
		// Navigate to dashboard
		await page.goto("/dashboard");

		// Wait for page to load
		await expect(page.locator('h1:has-text("Trading Overview")')).toBeVisible();

		// The hero section should display either "Start My Journal" button
		// or "Journal Started" text (depending on state)
		const startButton = page.locator('button:has-text("Start")');
		const journalStarted = page.locator('text="Journal Started"');
		const openJournalButton = page.locator('button:has-text("Journal")');

		// Either the start button OR the journal started indicator should be visible
		const isStartButtonVisible = await startButton
			.isVisible()
			.catch(() => false);
		const isJournalStartedVisible = await journalStarted
			.isVisible()
			.catch(() => false);
		const isOpenJournalVisible = await openJournalButton
			.isVisible()
			.catch(() => false);

		expect(
			isStartButtonVisible || isJournalStartedVisible || isOpenJournalVisible,
		).toBeTruthy();
	});
});
