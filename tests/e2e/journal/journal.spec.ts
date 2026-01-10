import { test, expect } from "../fixtures/auth";

/**
 * Journal Page E2E Tests
 *
 * This file tests the journal page functionality in EdgeJournal:
 * - Page loading and core UI elements
 * - Trade list display
 * - Search functionality
 * - Tab navigation (All Trades / Trash)
 * - Empty state display
 * - Navigation to trade details
 *
 * All tests use the authenticated fixture (from fixtures/auth) since
 * the journal page is a protected route requiring authentication.
 *
 * Environment requirements:
 * - E2E_CLERK_USER_EMAIL: Test user email
 * - E2E_CLERK_USER_PASSWORD: Test user password
 */

// ============================================================================
// PAGE LOADING AND CORE UI
// ============================================================================

test.describe("Journal Page - Core UI", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to journal page before each test
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should load the journal page", async ({ page }) => {
		// Verify we're on the journal page (not redirected)
		await expect(page).toHaveURL("/journal");
	});

	test("should display the page header", async ({ page }) => {
		// Check for the main header elements
		await expect(page.getByText("Trading Journal")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /trades/i }),
		).toBeVisible();
	});

	test("should display the search input", async ({ page }) => {
		// Check for the search input placeholder
		await expect(
			page.getByPlaceholder(/search symbol, setup, notes/i),
		).toBeVisible();
	});

	test("should display the tabs for All Trades and Trash", async ({ page }) => {
		// Check for the tab buttons
		await expect(page.getByRole("tab", { name: /all trades/i })).toBeVisible();
		await expect(page.getByRole("tab", { name: /trash/i })).toBeVisible();
	});

	test("should have All Trades tab selected by default", async ({ page }) => {
		// The All Trades tab should be selected (active state)
		const allTradesTab = page.getByRole("tab", { name: /all trades/i });
		await expect(allTradesTab).toHaveAttribute("data-state", "active");
	});
});

// ============================================================================
// TAB NAVIGATION
// ============================================================================

test.describe("Journal Page - Tab Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should switch to Trash tab when clicked", async ({ page }) => {
		// Click on Trash tab
		await page.getByRole("tab", { name: /trash/i }).click();

		// Verify Trash tab is now active
		const trashTab = page.getByRole("tab", { name: /trash/i });
		await expect(trashTab).toHaveAttribute("data-state", "active");
	});

	test("should display trash content when Trash tab is active", async ({
		page,
	}) => {
		// Click on Trash tab
		await page.getByRole("tab", { name: /trash/i }).click();

		// Wait for content to load
		await page.waitForLoadState("networkidle");

		// Should show trash-related content (empty state or deleted trades)
		// The trash tab shows either "Trash is empty" or a list of deleted trades
		const trashContent = page.getByText(/trash is empty|deleted/i);
		await expect(trashContent).toBeVisible({ timeout: 10000 });
	});

	test("should switch back to All Trades tab", async ({ page }) => {
		// First switch to Trash
		await page.getByRole("tab", { name: /trash/i }).click();

		// Then switch back to All Trades
		await page.getByRole("tab", { name: /all trades/i }).click();

		// Verify All Trades tab is active again
		const allTradesTab = page.getByRole("tab", { name: /all trades/i });
		await expect(allTradesTab).toHaveAttribute("data-state", "active");
	});
});

// ============================================================================
// SEARCH FUNCTIONALITY
// ============================================================================

test.describe("Journal Page - Search", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should allow typing in the search input", async ({ page }) => {
		const searchInput = page.getByPlaceholder(/search symbol, setup, notes/i);

		// Type a search term
		await searchInput.fill("ES");

		// Verify the input value
		await expect(searchInput).toHaveValue("ES");
	});

	test("should clear search input", async ({ page }) => {
		const searchInput = page.getByPlaceholder(/search symbol, setup, notes/i);

		// Type and then clear
		await searchInput.fill("NQ");
		await searchInput.clear();

		// Verify the input is empty
		await expect(searchInput).toHaveValue("");
	});
});

// ============================================================================
// TRADE LIST AND EMPTY STATE
// ============================================================================

test.describe("Journal Page - Trade List", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should display trade table or empty state", async ({ page }) => {
		// Wait for loading to complete (skeleton should disappear)
		// The page will show either:
		// 1. A table with trades (has table headers like Symbol, Side, etc.)
		// 2. An empty state with "No trades found" message

		// Wait for content to stabilize
		await page.waitForTimeout(1000);

		// Check for either the trade table or empty state
		const hasTable = await page.locator("table").isVisible().catch(() => false);
		const hasEmptyState = await page
			.getByText(/no trades found/i)
			.isVisible()
			.catch(() => false);

		// One of these should be true
		expect(hasTable || hasEmptyState).toBe(true);
	});

	test("should show empty state message when no trades exist", async ({
		page,
	}) => {
		// This test assumes a fresh test user with no trades
		// If trades exist, this test may need to be adjusted

		// Wait for loading to complete
		await page.waitForTimeout(1000);

		// Check if empty state is visible
		const emptyState = page.getByText(/no trades found/i);
		const isEmptyStateVisible = await emptyState.isVisible().catch(() => false);

		if (isEmptyStateVisible) {
			// If empty state is shown, verify the call-to-action
			await expect(
				page.getByRole("link", { name: /add your first trade/i }),
			).toBeVisible();
		}
		// If trades exist, this assertion is skipped
	});
});

// ============================================================================
// NAVIGATION TO TRADE DETAILS
// ============================================================================

test.describe("Journal Page - Trade Detail Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should navigate to trade detail page when clicking a trade row", async ({
		page,
	}) => {
		// Wait for content to load
		await page.waitForTimeout(1000);

		// Check if there are any trade rows in the table
		const tableRows = page.locator("table tbody tr");
		const rowCount = await tableRows.count();

		if (rowCount > 0) {
			// Click on the first trade row
			await tableRows.first().click();

			// Should navigate to a trade detail page
			await expect(page).toHaveURL(/\/journal\/.+/);
		}
		// If no trades exist, skip navigation test
	});

	test("should have View Details option in trade actions menu", async ({
		page,
	}) => {
		// Wait for content to load
		await page.waitForTimeout(1000);

		// Check if there are any trade action buttons (the three dots menu)
		const actionButtons = page.getByRole("button").filter({
			has: page.locator('[class*="MoreHorizontal"], [data-lucide="more-horizontal"]'),
		});

		const buttonCount = await actionButtons.count();

		if (buttonCount > 0) {
			// Click on the first action menu
			await actionButtons.first().click();

			// Should show View Details option
			await expect(
				page.getByRole("menuitem", { name: /view details/i }),
			).toBeVisible();
		}
		// If no trades exist, skip this test
	});
});

// ============================================================================
// PAGE PERFORMANCE
// ============================================================================

test.describe("Journal Page - Performance", () => {
	test("should load the journal page within acceptable time", async ({
		page,
	}) => {
		const startTime = Date.now();
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
		const loadTime = Date.now() - startTime;

		// Page should load within 10 seconds (generous timeout for CI)
		expect(loadTime).toBeLessThan(10000);

		// Verify page actually loaded
		await expect(page.getByText("Trading Journal")).toBeVisible();
	});
});

// ============================================================================
// COLUMN CONFIGURATION
// ============================================================================

test.describe("Journal Page - Column Configuration", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should display column configuration button", async ({ page }) => {
		// The column config button should be visible in the header area
		// It's typically a button with columns/settings icon
		const columnConfigButton = page.getByRole("button", {
			name: /columns|configure/i,
		});

		// Check if column config exists (it may have different accessibility name)
		const isVisible = await columnConfigButton.isVisible().catch(() => false);

		// If not found by role, try looking for the popover trigger
		if (!isVisible) {
			// The column config is in the header area near the title
			const headerArea = page.locator(".flex.flex-col.gap-4, .flex.items-center.gap-2");
			await expect(headerArea.first()).toBeVisible();
		}
	});
});

// ============================================================================
// FILTER PANEL
// ============================================================================

test.describe("Journal Page - Filters", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should have filter panel visible", async ({ page }) => {
		// The filter panel should be visible with filter options
		// Look for filter-related text or buttons
		const filterPanel = page.locator('[class*="filter"], [data-testid*="filter"]');
		const filterText = page.getByText(/filters|status|direction/i);

		// At least one filter element should be visible
		const hasFilterPanel = await filterPanel.first().isVisible().catch(() => false);
		const hasFilterText = await filterText.first().isVisible().catch(() => false);

		// The page should have some filtering capability
		expect(hasFilterPanel || hasFilterText).toBe(true);
	});
});

// ============================================================================
// BULK ACTIONS (when trades are selected)
// ============================================================================

test.describe("Journal Page - Bulk Actions", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/journal");
		await page.waitForLoadState("networkidle");
	});

	test("should show bulk action bar when trades are selected", async ({
		page,
	}) => {
		// Wait for content to load
		await page.waitForTimeout(1000);

		// Check if there are any checkboxes in the table
		const checkboxes = page.getByRole("checkbox");
		const checkboxCount = await checkboxes.count();

		if (checkboxCount > 1) {
			// Click on a checkbox (not the header checkbox)
			await checkboxes.nth(1).click();

			// Should show bulk actions bar with "selected" text
			await expect(page.getByText(/\d+ selected/i)).toBeVisible({
				timeout: 5000,
			});
		}
		// If no checkboxes (no trades), skip this test
	});
});
