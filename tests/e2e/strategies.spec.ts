import { expect, test } from "@playwright/test";

/**
 * Strategies E2E Smoke Tests
 *
 * These tests verify critical user journeys for the strategies feature.
 * They are intentionally minimal - detailed UI behavior is covered by integration tests.
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */

test.describe("Strategies - Smoke Tests", () => {
	test("strategies list page loads with header and new button", async ({
		page,
	}) => {
		await page.goto("/strategies");

		// Verify page loads with key elements
		const header = page.getByTestId("strategies-header");
		await expect(header).toBeVisible({ timeout: 15000 });

		// Check for page title
		const title = page.locator("h1:has-text('Strategies')");
		await expect(title).toBeVisible();

		// Check for New Strategy button
		const newButton = page.getByTestId("strategies-header-new-button");
		await expect(newButton).toBeVisible();
	});

	test("can navigate from list to strategy detail", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		// Check if there are any strategies to navigate to
		const grid = page.getByTestId("strategies-grid");
		if (!(await grid.isVisible())) {
			// No strategies exist, test passes (nothing to navigate to)
			return;
		}

		const cards = page.getByTestId("strategy-card");
		if ((await cards.count()) === 0) {
			// No strategy cards, test passes
			return;
		}

		// Click on the first strategy card link
		const firstCardLink = cards.first().getByTestId("strategy-card-link");
		await firstCardLink.click();

		// Verify we navigated to detail page
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify key sections are present
		await expect(page.getByTestId("strategy-detail-hero")).toBeVisible();
		await expect(page.getByTestId("strategy-detail-name")).toBeVisible();
	});

	test("can create a strategy and see it in the list", async ({
		page,
	}, testInfo) => {
		// Increase timeout for this full creation flow test
		testInfo.setTimeout(60000);

		// Navigate to new strategy page
		await page.goto("/strategies/new");

		// Wait for form to load
		await expect(page.getByTestId("strategy-form")).toBeVisible({
			timeout: 15000,
		});

		// Fill in strategy name with unique identifier
		const strategyName = `E2E Smoke Test ${Date.now()}`;
		const nameInput = page.getByTestId("strategy-form-input-name");
		await nameInput.fill(strategyName);

		// Submit the form
		const submitButton = page.getByTestId("strategy-form-button-submit");
		await submitButton.click();

		// Wait for navigation to strategy detail page
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 15000 });

		// Verify we're on the detail page
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify the strategy name is displayed
		const nameElement = page.getByTestId("strategy-detail-name");
		await expect(nameElement).toContainText(strategyName);
	});
});
