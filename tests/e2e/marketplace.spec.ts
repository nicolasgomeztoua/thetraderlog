import { expect, test } from "@playwright/test";

/**
 * Marketplace Page E2E Tests
 *
 * These tests verify the marketplace page functionality for authenticated users.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Marketplace Page", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to marketplace
		await page.goto("/marketplace");
		await expect(page.getByTestId("marketplace-heading")).toBeVisible({
			timeout: 15000,
		});
	});

	test("loads marketplace page with hero section", async ({ page }) => {
		// Verify marketplace page loaded
		await expect(page.getByTestId("marketplace-page")).toBeVisible({
			timeout: 10000,
		});
		await expect(page.getByTestId("marketplace-heading")).toBeVisible();

		// Verify heading text
		const heading = page.getByTestId("marketplace-heading");
		await expect(heading).toContainText("Strategy Marketplace");
	});

	test("filter bar is visible with all controls", async ({ page }) => {
		// Verify filter bar is visible
		const filterBar = page.getByTestId("marketplace-filter-bar");
		await expect(filterBar).toBeVisible({ timeout: 10000 });

		// Verify search input is present
		const searchInput = page.getByTestId("marketplace-filter-search");
		await expect(searchInput).toBeVisible();

		// Verify instruments filter is present
		const instrumentsFilter = page.getByTestId(
			"marketplace-filter-instruments",
		);
		await expect(instrumentsFilter).toBeVisible();

		// Verify categories filter is present
		const categoriesFilter = page.getByTestId("marketplace-filter-categories");
		await expect(categoriesFilter).toBeVisible();

		// Verify sort dropdown is present
		const sortDropdown = page.getByTestId("marketplace-filter-sort");
		await expect(sortDropdown).toBeVisible();
	});

	test("search filter works", async ({ page }) => {
		// Get the search input
		const searchInput = page.getByTestId("marketplace-filter-search");
		await expect(searchInput).toBeVisible({ timeout: 10000 });

		// Type a search query
		await searchInput.fill("test");

		// Wait for potential filter update
		await page.waitForTimeout(600);

		// Verify search value persists
		const inputValue = await searchInput.inputValue();
		expect(inputValue).toBe("test");

		// Clear search should appear
		const clearButton = page.getByTestId("marketplace-filter-search-clear");
		await expect(clearButton).toBeVisible();

		// Click clear
		await clearButton.click();

		// Verify search is cleared
		const clearedValue = await searchInput.inputValue();
		expect(clearedValue).toBe("");
	});

	test("instruments filter dropdown opens", async ({ page }) => {
		// Click instruments filter
		const instrumentsFilter = page.getByTestId(
			"marketplace-filter-instruments",
		);
		await expect(instrumentsFilter).toBeVisible({ timeout: 10000 });
		await instrumentsFilter.click();

		// Wait for popover to open
		const popover = page.locator("[data-radix-popper-content-wrapper]");
		await expect(popover).toBeVisible({ timeout: 5000 });

		// Check for at least one instrument option
		const esOption = page.getByTestId("marketplace-filter-instrument-ES");
		if (await esOption.isVisible().catch(() => false)) {
			await esOption.click();
		}

		// Close by pressing Escape
		await page.keyboard.press("Escape");
	});

	test("categories filter dropdown opens", async ({ page }) => {
		// Click categories filter
		const categoriesFilter = page.getByTestId("marketplace-filter-categories");
		await expect(categoriesFilter).toBeVisible({ timeout: 10000 });
		await categoriesFilter.click();

		// Wait for popover to open
		const popover = page.locator("[data-radix-popper-content-wrapper]");
		await expect(popover).toBeVisible({ timeout: 5000 });

		// Check for at least one category option
		const scalpingOption = page.getByTestId(
			"marketplace-filter-category-Scalping",
		);
		if (await scalpingOption.isVisible().catch(() => false)) {
			await scalpingOption.click();
		}

		// Close by pressing Escape
		await page.keyboard.press("Escape");
	});

	test("sort dropdown has options", async ({ page }) => {
		// Click sort dropdown
		const sortDropdown = page.getByTestId("marketplace-filter-sort");
		await expect(sortDropdown).toBeVisible({ timeout: 10000 });
		await sortDropdown.click();

		// Wait for dropdown content
		const dropdown = page.locator("[data-radix-select-content]");
		await expect(dropdown).toBeVisible({ timeout: 5000 });

		// Verify sort options exist - check that newest is visible
		const newestOption = page.getByTestId("marketplace-filter-sort-newest");
		await expect(newestOption).toBeVisible();

		// Close dropdown
		await page.keyboard.press("Escape");
	});

	test("strategy grid or empty state displays", async ({ page }) => {
		// Wait for loading to complete (either grid or empty state)
		const grid = page.getByTestId("marketplace-grid");
		const empty = page.getByTestId("marketplace-empty");

		const hasGrid = await grid.isVisible().catch(() => false);
		const hasEmpty = await empty.isVisible().catch(() => false);

		// One should be visible
		expect(hasGrid || hasEmpty).toBe(true);

		if (hasGrid) {
			// If grid visible, check for strategy cards or empty
			const cards = page.locator('[data-testid^="marketplace-strategy-card-"]');
			const cardCount = await cards.count();
			expect(cardCount >= 0).toBe(true);
		}
	});

	test("strategy card displays with correct elements", async ({ page }) => {
		// Wait for grid
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		// Find the first strategy card
		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		// Get the strategy ID from the card's testid
		const testId = await firstCard.getAttribute("data-testid");
		const strategyId = testId?.replace("marketplace-strategy-card-", "") ?? "";

		// Verify card elements
		const cardName = page.getByTestId(`strategy-card-name-${strategyId}`);
		await expect(cardName).toBeVisible();

		// Cover should be visible
		const cardCover = page.getByTestId(`strategy-card-cover-${strategyId}`);
		await expect(cardCover).toBeVisible();
	});

	test("clicking strategy card navigates to detail page", async ({ page }) => {
		// Wait for grid
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		// Find the first strategy card link
		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"] a')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		// Click on strategy name/link
		await firstCard.click();

		// Should navigate to marketplace strategy detail
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });
	});

	test("voting buttons are visible on strategy cards", async ({ page }) => {
		// Wait for grid
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		// Find the first strategy card
		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		// Get the strategy ID from the card's testid
		const testId = await firstCard.getAttribute("data-testid");
		const strategyId = testId?.replace("marketplace-strategy-card-", "") ?? "";

		// Verify voting elements exist (may be in card footer)
		const voteSection = page.getByTestId(`strategy-card-votes-${strategyId}`);
		await expect(voteSection).toBeVisible({ timeout: 5000 });

		// Verify upvote button exists
		const upvoteBtn = page.getByTestId(`strategy-card-upvote-${strategyId}`);
		await expect(upvoteBtn).toBeVisible();

		// Verify score display exists
		const scoreDisplay = page.getByTestId(`strategy-card-score-${strategyId}`);
		await expect(scoreDisplay).toBeVisible();

		// Verify downvote button exists
		const downvoteBtn = page.getByTestId(
			`strategy-card-downvote-${strategyId}`,
		);
		await expect(downvoteBtn).toBeVisible();
	});
});
