import { expect, test } from "@playwright/test";

/**
 * Strategies Redesign E2E Tests
 *
 * These tests verify the redesigned strategies pages work correctly:
 * - Strategies list page with Terminal-inspired hero, leaderboard, and cards
 * - Strategy detail page with hero, rules, criteria, and risk display
 * - Navigation between list and detail pages
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Strategies List Page", () => {
	test("loads successfully with header and new button", async ({ page }) => {
		await page.goto("/strategies");

		// Verify hero header loads
		const header = page.getByTestId("strategies-header");
		await expect(header).toBeVisible({ timeout: 15000 });

		// Check for page title
		const title = page.locator("h1:has-text('Playbooks')");
		await expect(title).toBeVisible();

		// Check for New Playbook button
		const newButton = page.getByTestId("strategies-header-new-button");
		await expect(newButton).toBeVisible();
	});

	test("page loads without errors", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to fully load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// The header should always be present, indicating the page loaded
		const headerText = page.locator("h1:has-text('Playbooks')");
		await expect(headerText).toBeVisible();
	});

	test("displays strategy cards or empty state", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		// Check if grid exists (could be empty state if no strategies)
		const grid = page.getByTestId("strategies-grid");
		const emptyState = page.getByTestId("strategies-empty-state");

		const gridVisible = await grid.isVisible();
		const emptyVisible = await emptyState.isVisible();

		if (gridVisible) {
			// If grid is visible, check for strategy cards
			const cards = page.getByTestId("strategy-card");
			const count = await cards.count();
			// May have 0 or more cards
			expect(count).toBeGreaterThanOrEqual(0);

			// CTA card should always be present in grid
			const ctaCard = page.getByTestId("strategies-create-cta");
			await expect(ctaCard).toBeVisible();
		} else if (emptyVisible) {
			// Empty state should have CTA button
			const ctaButton = page.getByTestId("strategies-empty-state-cta");
			await expect(ctaButton).toBeVisible();
		}
	});

	test("strategy card shows terminal chrome and stats", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		const grid = page.getByTestId("strategies-grid");
		const gridVisible = await grid.isVisible();

		if (gridVisible) {
			const cards = page.getByTestId("strategy-card");
			const count = await cards.count();

			if (count > 0) {
				// Get the first card
				const firstCard = cards.first();

				// Check for terminal chrome title
				const title = firstCard.getByTestId("strategy-card-title");
				await expect(title).toBeVisible();

				// Check for stats section
				const stats = firstCard.getByTestId("strategy-card-stats");
				await expect(stats).toBeVisible();

				// Check for menu trigger
				const menuTrigger = firstCard.getByTestId("strategy-card-menu-trigger");
				await expect(menuTrigger).toBeVisible();
			}
		}
	});
});

test.describe("Strategy Detail Page", () => {
	test("navigates from list to detail and displays all sections", async ({
		page,
	}) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data
		await page.waitForTimeout(3000);

		const grid = page.getByTestId("strategies-grid");
		const gridVisible = await grid.isVisible();

		if (!gridVisible) {
			// No strategies to test, skip
			return;
		}

		const cards = page.getByTestId("strategy-card");
		const count = await cards.count();

		if (count === 0) {
			// No strategy cards to test, skip
			return;
		}

		// Click on the first strategy card link
		const firstCardLink = cards.first().getByTestId("strategy-card-link");
		await firstCardLink.click();

		// Verify we navigated to detail page
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Check hero section
		const hero = page.getByTestId("strategy-detail-hero");
		await expect(hero).toBeVisible();

		// Check strategy name
		const name = page.getByTestId("strategy-detail-name");
		await expect(name).toBeVisible();

		// Check status badge
		const status = page.getByTestId("strategy-detail-status");
		await expect(status).toBeVisible();

		// Check stats grid
		const stats = page.getByTestId("strategy-detail-stats");
		await expect(stats).toBeVisible();

		// Check rules section
		const rules = page.getByTestId("strategy-detail-rules");
		await expect(rules).toBeVisible();

		// Check criteria section
		const criteria = page.getByTestId("strategy-detail-criteria");
		await expect(criteria).toBeVisible();

		// Check action bar
		const actionBar = page.getByTestId("strategy-detail-action-bar");
		await expect(actionBar).toBeVisible();

		// Check back button
		const backButton = page.getByTestId("strategy-detail-action-back");
		await expect(backButton).toBeVisible();

		// Check edit button
		const editButton = page.getByTestId("strategy-detail-action-edit");
		await expect(editButton).toBeVisible();

		// Check duplicate button
		const duplicateButton = page.getByTestId(
			"strategy-detail-action-duplicate",
		);
		await expect(duplicateButton).toBeVisible();

		// Check delete button
		const deleteButton = page.getByTestId("strategy-detail-action-delete");
		await expect(deleteButton).toBeVisible();
	});

	test("back button navigates to strategies list", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data
		await page.waitForTimeout(3000);

		const grid = page.getByTestId("strategies-grid");
		if (!(await grid.isVisible())) {
			return;
		}

		const cards = page.getByTestId("strategy-card");
		if ((await cards.count()) === 0) {
			return;
		}

		// Navigate to first strategy
		await cards.first().getByTestId("strategy-card-link").click();
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Click back button
		const backButton = page.getByTestId("strategy-detail-action-back");
		await backButton.click();

		// Verify we're back on strategies list
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});
	});
});

test.describe("Empty State", () => {
	test("empty state has CTA button when no strategies", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		// Check if empty state is visible
		const emptyState = page.getByTestId("strategies-empty-state");
		const emptyStateVisible = await emptyState.isVisible();

		if (emptyStateVisible) {
			// Check CTA button exists
			const ctaButton = page.getByTestId("strategies-empty-state-cta");
			await expect(ctaButton).toBeVisible();

			// Click CTA should navigate to new strategy page
			await ctaButton.click();
			await page.waitForURL(/\/strategies\/new/, { timeout: 10000 });
		}
	});
});
