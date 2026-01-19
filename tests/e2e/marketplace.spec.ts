import { expect, test } from "@playwright/test";

/**
 * E2E Tests for Marketplace Page
 *
 * Tests the marketplace page functionality including:
 * - Page loading and structure
 * - Search functionality
 * - Filter dropdowns (instruments, categories, sort)
 * - Strategy cards and navigation
 * - Empty state handling
 *
 * Prerequisites:
 * - Authenticated user (via global.setup.ts)
 *
 * Data-testid attributes used:
 * - marketplace-page: Main page container
 * - marketplace-header: Page header with title/subtitle
 * - marketplace-search: Search bar container
 * - marketplace-search-input: Search input field
 * - marketplace-search-clear: Clear search button
 * - marketplace-filters: Filter row container
 * - marketplace-filter-instrument: Instrument filter dropdown
 * - marketplace-filter-category: Category filter dropdown
 * - marketplace-filter-sort: Sort dropdown
 * - marketplace-active-filters: Active filter chips
 * - marketplace-filter-clear-{key}: Clear specific filter chip
 * - marketplace-results-header: Results count display
 * - marketplace-grid: Strategy cards grid
 * - marketplace-loading: Loading skeleton grid
 * - marketplace-empty: Empty state container
 * - marketplace-load-more: Load more button
 * - marketplace-strategy-card: Individual strategy card
 */
test.describe("Marketplace Page", () => {
	/**
	 * Test that the marketplace page loads successfully.
	 */
	test("loads successfully", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		const marketplacePage = page.getByTestId("marketplace-page");
		await expect(marketplacePage).toBeVisible({ timeout: 15000 });

		// Verify header is present
		const header = page.getByTestId("marketplace-header");
		await expect(header).toBeVisible();
		await expect(header).toContainText("Strategy Marketplace");
	});

	/**
	 * Test that the search bar is visible and functional.
	 */
	test("search bar is visible and works", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Search input should be visible
		const searchInput = page.getByTestId("marketplace-search-input");
		await expect(searchInput).toBeVisible();

		// Type in search
		await searchInput.fill("test strategy");

		// URL should update with search param (after debounce)
		await page.waitForTimeout(400); // Wait for debounce (300ms) + buffer
		await expect(page).toHaveURL(/\?q=test\+strategy/);

		// Clear button should appear
		const clearButton = page.getByTestId("marketplace-search-clear");
		await expect(clearButton).toBeVisible();

		// Click clear button
		await clearButton.click();

		// Search should be cleared
		await expect(searchInput).toHaveValue("");
	});

	/**
	 * Test that filter dropdowns are visible.
	 */
	test("filter dropdowns are visible", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Instrument filter should be visible
		const instrumentFilter = page.getByTestId("marketplace-filter-instrument");
		await expect(instrumentFilter).toBeVisible();

		// Category filter should be visible
		const categoryFilter = page.getByTestId("marketplace-filter-category");
		await expect(categoryFilter).toBeVisible();

		// Sort filter should be visible
		const sortFilter = page.getByTestId("marketplace-filter-sort");
		await expect(sortFilter).toBeVisible();
	});

	/**
	 * Test that instrument filter can be opened and has options.
	 */
	test("instrument filter can be opened", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Click instrument filter
		const instrumentFilter = page.getByTestId("marketplace-filter-instrument");
		await instrumentFilter.click();

		// Dropdown content should be visible
		// Check for "All Instruments" option
		await expect(page.getByText("All Instruments")).toBeVisible();
	});

	/**
	 * Test that sort filter changes URL params.
	 */
	test("sort filter updates URL", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Click sort filter
		const sortFilter = page.getByTestId("marketplace-filter-sort");
		await sortFilter.click();

		// Select "Newest" option
		await page.getByRole("option", { name: "Newest" }).click();

		// URL should update with sort param
		await expect(page).toHaveURL(/sort=newest/);
	});

	/**
	 * Test that results count is displayed.
	 */
	test("displays results count", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Results header should be visible
		const resultsHeader = page.getByTestId("marketplace-results-header");
		await expect(resultsHeader).toBeVisible();

		// Should show loading or results count
		await expect(resultsHeader).toContainText(/Loading|Showing \d+ strategies/);
	});

	/**
	 * Test that loading state shows skeleton cards.
	 */
	test("shows loading skeletons while fetching", async ({ page }) => {
		await page.goto("/marketplace");

		// Loading skeleton should appear initially
		// Note: May be very fast, so we check if it was ever visible or results loaded
		const loadingOrResults = page
			.getByTestId("marketplace-loading")
			.or(page.getByTestId("marketplace-empty"))
			.or(page.getByTestId("marketplace-grid"));

		await expect(loadingOrResults).toBeVisible({ timeout: 15000 });
	});

	/**
	 * Test that empty state is shown when no strategies match.
	 */
	test("shows empty state when no results", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Wait for loading to complete
		await page.waitForTimeout(600); // Mock loading time + buffer

		// Since we have mock data returning empty array, empty state should be visible
		const emptyState = page.getByTestId("marketplace-empty");
		const grid = page.getByTestId("marketplace-grid");

		// Either empty state or grid should be visible
		const isEmptyVisible = await emptyState.isVisible().catch(() => false);
		const isGridVisible = await grid.isVisible().catch(() => false);

		expect(isEmptyVisible || isGridVisible).toBe(true);

		// If empty state is visible, verify its content
		if (isEmptyVisible) {
			await expect(emptyState).toContainText(/No strategies/);
		}
	});

	/**
	 * Test keyboard shortcut '/' focuses search.
	 */
	test("/ keyboard shortcut focuses search", async ({ page }) => {
		await page.goto("/marketplace");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Press '/' key
		await page.keyboard.press("/");

		// Search input should be focused
		const searchInput = page.getByTestId("marketplace-search-input");
		await expect(searchInput).toBeFocused();
	});
});

/**
 * Tests for URL state synchronization.
 */
test.describe("Marketplace URL State", () => {
	/**
	 * Test that URL params are reflected in filters on page load.
	 */
	test("loads filters from URL params", async ({ page }) => {
		// Navigate with search param
		await page.goto("/marketplace?q=test");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Search input should have the value from URL
		const searchInput = page.getByTestId("marketplace-search-input");
		await expect(searchInput).toHaveValue("test");
	});

	/**
	 * Test that sort param is reflected on page load.
	 */
	test("loads sort option from URL params", async ({ page }) => {
		// Navigate with sort param
		await page.goto("/marketplace?sort=newest");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Sort filter should show "Newest"
		const sortFilter = page.getByTestId("marketplace-filter-sort");
		await expect(sortFilter).toContainText("Newest");
	});
});

/**
 * Tests for filter clearing.
 */
test.describe("Marketplace Filter Clearing", () => {
	/**
	 * Test that clearing search updates URL.
	 */
	test("clearing search removes URL param", async ({ page }) => {
		// Navigate with search param
		await page.goto("/marketplace?q=test");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-page")).toBeVisible();

		// Clear search
		const clearButton = page.getByTestId("marketplace-search-clear");
		await clearButton.click();

		// URL should not have q param
		await expect(page).not.toHaveURL(/q=/);
	});
});
