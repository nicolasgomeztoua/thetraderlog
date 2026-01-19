import { expect, test } from "@playwright/test";

/**
 * E2E Tests for Strategies List Page
 *
 * Tests the strategies list page functionality including:
 * - Page loading and structure
 * - Strategy card display with cover images
 * - My Strategies section
 * - Downloaded from Marketplace section
 * - New strategy button
 * - Empty state
 *
 * Prerequisites:
 * - Authenticated user (via global.setup.ts)
 *
 * Data-testid attributes used:
 * - my-strategies-section: My Strategies section container
 * - downloaded-strategies-section: Downloaded strategies section container
 * - empty-downloaded-section: Empty downloaded state container
 * - strategy-card: Individual strategy card
 */
test.describe("Strategies List Page", () => {
	/**
	 * Test that the strategies page loads successfully.
	 */
	test("loads successfully", async ({ page }) => {
		await page.goto("/strategies");

		// Page should load
		await expect(page).toHaveURL("/strategies");

		// Header should be visible
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible({ timeout: 15000 });
	});

	/**
	 * Test that new strategy button is visible and works.
	 */
	test("new strategy button is visible and navigates", async ({ page }) => {
		await page.goto("/strategies");

		// New Strategy button should be visible
		const newButton = page.getByRole("link", { name: /New Strategy/i });
		await expect(newButton).toBeVisible();

		// Click should navigate
		await newButton.click();
		await expect(page).toHaveURL("/strategies/new");
	});

	/**
	 * Test that strategy cards display with cover images.
	 * Note: Marked as fixme because it requires strategies to exist.
	 */
	test.fixme("displays strategy cards with cover images", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Strategy cards should be visible
		const cards = page.getByTestId("strategy-card");
		await expect(cards.first()).toBeVisible();

		// Cards should have cover area (image or gradient)
		const firstCard = cards.first();
		await expect(firstCard).toBeVisible();
	});

	/**
	 * Test that My Strategies section displays.
	 * Note: Marked as fixme because it requires user's own strategies.
	 */
	test.fixme("displays My Strategies section", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// My Strategies section should be visible
		const myStrategiesSection = page.getByTestId("my-strategies-section");
		await expect(myStrategiesSection).toBeVisible();

		// Section should have heading
		await expect(myStrategiesSection).toContainText(/My Strategies/i);
	});

	/**
	 * Test that Downloaded section displays when user has downloads.
	 * Note: Marked as fixme because it requires downloaded strategies.
	 */
	test.fixme(
		"displays Downloaded from Marketplace section",
		async ({ page }) => {
			await page.goto("/strategies");

			// Wait for page to load
			await expect(
				page.getByRole("heading", { name: /Strategies/i }),
			).toBeVisible();

			// Downloaded section should be visible
			const downloadedSection = page.getByTestId(
				"downloaded-strategies-section",
			);
			await expect(downloadedSection).toBeVisible();

			// Section should have heading
			await expect(downloadedSection).toContainText(
				/Downloaded from Marketplace/i,
			);
		},
	);

	/**
	 * Test that downloaded cards show "Downloaded" badge.
	 * Note: Marked as fixme because it requires downloaded strategies.
	 */
	test.fixme("downloaded cards show Downloaded badge", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Find downloaded section
		const downloadedSection = page.getByTestId("downloaded-strategies-section");
		await expect(downloadedSection).toBeVisible();

		// Badge should be visible
		await expect(downloadedSection).toContainText(/Downloaded/);
	});

	/**
	 * Test that downloaded cards show "From [Source]" link.
	 * Note: Marked as fixme because it requires downloaded strategies.
	 */
	test.fixme("downloaded cards show source strategy link", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Find downloaded section
		const downloadedSection = page.getByTestId("downloaded-strategies-section");
		await expect(downloadedSection).toBeVisible();

		// "From" text should be visible
		await expect(downloadedSection).toContainText(/From/);
	});

	/**
	 * Test that empty downloaded state shows Browse Marketplace button.
	 * Note: This test requires user to have own strategies but no downloads.
	 */
	test.fixme(
		"shows empty downloaded state with marketplace link",
		async ({ page }) => {
			await page.goto("/strategies");

			// Wait for page to load
			await expect(
				page.getByRole("heading", { name: /Strategies/i }),
			).toBeVisible();

			// Empty downloaded section should be visible
			const emptySection = page.getByTestId("empty-downloaded-section");
			await expect(emptySection).toBeVisible();

			// Should have Browse Marketplace link
			const marketplaceLink = emptySection.getByRole("link", {
				name: /Browse Marketplace/i,
			});
			await expect(marketplaceLink).toBeVisible();
		},
	);

	/**
	 * Test that clicking a strategy card navigates to detail page.
	 * Note: Marked as fixme because it requires strategies to exist.
	 */
	test.fixme("clicking strategy card navigates to detail", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Click on strategy name link
		const strategyLink = page
			.getByTestId("strategy-card")
			.first()
			.getByRole("link");
		await strategyLink.click();

		// Should navigate to detail page
		await expect(page).toHaveURL(/\/strategies\/.+/);
	});

	/**
	 * Test that strategy card shows stats (trades, win rate, rules).
	 * Note: Marked as fixme because it requires strategies to exist.
	 */
	test.fixme("strategy card shows stats", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Find a strategy card
		const card = page.getByTestId("strategy-card").first();
		await expect(card).toBeVisible();

		// Should show stats labels
		await expect(card).toContainText(/Trades/i);
		await expect(card).toContainText(/Win Rate/i);
		await expect(card).toContainText(/Rules/i);
	});

	/**
	 * Test that card actions menu (more button) is visible on hover/mobile.
	 * Note: Marked as fixme because it requires strategies to exist.
	 */
	test.fixme("card actions menu is accessible", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Find a strategy card
		const card = page.getByTestId("strategy-card").first();
		await expect(card).toBeVisible();

		// Hover to reveal menu button
		await card.hover();

		// Click menu button (three dots)
		const menuButton = card.getByRole("button");
		await menuButton.click();

		// Menu should show options
		await expect(page.getByText(/Edit/i)).toBeVisible();
		await expect(page.getByText(/Duplicate/i)).toBeVisible();
		await expect(page.getByText(/Delete/i)).toBeVisible();
	});
});

test.describe("Strategies Page - Empty State", () => {
	/**
	 * Test that empty state shows when no strategies exist.
	 * Note: This test requires a fresh user with no strategies.
	 */
	test.fixme("shows empty state when no strategies", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Empty state should show
		await expect(page.getByText(/No strategies yet/i)).toBeVisible();

		// Should have create and browse buttons
		await expect(
			page.getByRole("link", { name: /Create Strategy/i }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: /Browse Marketplace/i }),
		).toBeVisible();
	});

	/**
	 * Test that empty state Create Strategy button works.
	 * Note: This test requires a fresh user with no strategies.
	 */
	test.fixme(
		"empty state Create Strategy navigates correctly",
		async ({ page }) => {
			await page.goto("/strategies");

			// Wait for empty state
			await expect(page.getByText(/No strategies yet/i)).toBeVisible();

			// Click Create Strategy
			await page.getByRole("link", { name: /Create Strategy/i }).click();

			// Should navigate to new strategy page
			await expect(page).toHaveURL("/strategies/new");
		},
	);

	/**
	 * Test that empty state Browse Marketplace button works.
	 * Note: This test requires a fresh user with no strategies.
	 */
	test.fixme(
		"empty state Browse Marketplace navigates correctly",
		async ({ page }) => {
			await page.goto("/strategies");

			// Wait for empty state
			await expect(page.getByText(/No strategies yet/i)).toBeVisible();

			// Click Browse Marketplace
			await page.getByRole("link", { name: /Browse Marketplace/i }).click();

			// Should navigate to marketplace
			await expect(page).toHaveURL("/marketplace");
		},
	);
});

test.describe("Strategies Page - Performance Comparison", () => {
	/**
	 * Test that performance comparison table displays.
	 * Note: Requires strategies with trades.
	 */
	test.fixme("displays performance comparison table", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(
			page.getByRole("heading", { name: /Strategies/i }),
		).toBeVisible();

		// Performance comparison section should be visible
		await expect(page.getByText(/Performance Comparison/i)).toBeVisible();

		// Table headers should be visible
		await expect(page.getByText(/Strategy/)).toBeVisible();
		await expect(page.getByText(/Win Rate/)).toBeVisible();
		await expect(page.getByText(/Total P&L/)).toBeVisible();
	});
});
